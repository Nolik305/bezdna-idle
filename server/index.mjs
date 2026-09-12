import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import { Pool } from "pg";

// Load .env into process.env so the server does not depend on pm2/process manager env_file.
try {
  const envPath = new URL("./.env", import.meta.url);
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch { /* .env optional */ }

const port = Number(process.env.PORT || 3001);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  query_timeout: 10000,
  statement_timeout: 10000,
  max: 10,
});
// Без слушателя 'error' на Pool обрыв idle-соединения с БД роняет весь процесс.
// Логируем и продолжаем — сервер останется живым, новые запросы переподключат пул.
pool.on("error", (err) => console.error("[pool] connection error:", err.message));
const allowedOrigins = (process.env.CORS_ORIGIN || "https://vk.ru").split(",").map(s => s.trim());
const rateBuckets = new Map();
const lastDuelAt = new Map(); // vk_user_id -> timestamp последнего отчёта дуэли (анти-фарм MMR)
const DUEL_MIN_INTERVAL_MS = 10_000;
const REWARDED_AD_REWARDS = {
  offline_bonus: { gold: 2000, xp: 500 },
};
const LOGIN_REWARDS = [
  { gold: 500, gems: 5, potions: 2 },
  { gold: 1200, gems: 10, potions: 2 },
  { gold: 2500, gems: 15, potions: 3 },
  { gold: 5000, gems: 25, potions: 4 },
  { gold: 9000, gems: 40, potions: 5 },
  { gold: 15000, gems: 60, potions: 7 },
  { gold: 30000, gems: 150, potions: 10 },
];

function allowedRequest(key, limit = 600) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= 60_000) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

function safeText(value, maxLength = 80) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, maxLength);
}

function safeAvatar(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.toString().slice(0, 500) : null;
  } catch { return null; }
}

function profileBody(body) {
  const classId = body?.class_id === "archer" ? "archer" : body?.class_id === "mage" ? "mage" : null;
  const level = Number(body?.level);
  if (!classId || !Number.isInteger(level) || level < 1 || level > 9999) return null;
  const classFactor = classId === "archer" ? 0.94 : 1;
  const power = Math.round(10 * classFactor * Math.pow(1.16, level - 1));
  return { classId, level, power };
}

function validGameState(game) {
  const hero = game?.hero;
  const finiteNonNegative = value => Number.isFinite(value) && value >= 0;
  return Boolean(
    game && game.v === 1 && hero &&
    (hero.classId === "mage" || hero.classId === "archer") &&
    Number.isInteger(hero.level) && hero.level >= 1 && hero.level <= 9999 &&
    finiteNonNegative(hero.gold) && finiteNonNegative(hero.gems) &&
    finiteNonNegative(hero.potions) && Array.isArray(game.inv) && game.inv.length <= 40 &&
    game.battle && game.daily && game.activity && game.totals
  );
}

function stateLooksSafe(game, previous) {
  if (!previous) return true;
  const prevHero = previous.hero || {};
  const prevTotals = previous.totals || {};
  const hero = game.hero;
  const totals = game.totals;
  return (
    hero.level <= Number(prevHero.level || 1) + 10 &&
    hero.gold >= 0 && hero.gems >= 0 && hero.potions >= 0 &&
    totals.kills >= Number(prevTotals.kills || 0) &&
    totals.goldEarned >= Number(prevTotals.goldEarned || 0) &&
    totals.items >= Number(prevTotals.items || 0) &&
    totals.kills - Number(prevTotals.kills || 0) <= 10000
  );
}

function json(res, status, payload) {
  const requestOrigin = res._corsOrigin;
  let allowOrigin;
  if (requestOrigin && (allowedOrigins.includes("*") || allowedOrigins.includes(requestOrigin))) {
    allowOrigin = requestOrigin;
  } else {
    allowOrigin = allowedOrigins[0] || "*";
  }
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-headers": "content-type, x-vk-launch-params",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  });
  res.end(JSON.stringify(payload));
}

// Максимальный размер тела — согласован с лимитом сейва (PUT /api/state допускает
// до 512КБ). Раньше readBody резал на 64КБ, из-за чего заявленный лимит сейва был
// недостижим и крупные сейвы падали с ошибкой.
const MAX_BODY = 640 * 1024;
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let tooLarge = false;
    const onData = (chunk) => {
      if (tooLarge) return; // не копим тело после превышения лимита
      body += chunk;
      if (body.length > MAX_BODY) {
        tooLarge = true;
        body = "";
        const err = new Error("payload too large");
        err.status = 413;
        cleanup();
        reject(err);
        // Разрываем соединение: клиент перестанет слать остаток, слушатели уже сняты.
        req.destroy();
      }
    };
    const onEnd = () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { const e = new Error("invalid json"); e.status = 400; cleanup(); reject(e); }
    };
    const onError = (e) => { cleanup(); reject(e); };
    const cleanup = () => {
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      req.removeListener("error", onError);
    };
    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
  });
}

function verifyLaunchParams(raw) {
  const params = new URLSearchParams(raw || "");
  const sign = params.get("sign");
  const appSecret = process.env.VK_APP_SECRET;
  if (!sign || !appSecret) return null;
  const signed = [...params.entries()]
    .filter(([key]) => key.startsWith("vk_"))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const expected = crypto.createHmac("sha256", appSecret).update(signed).digest("base64url");
  const actual = Buffer.from(sign);
  const calculated = Buffer.from(expected);
  const validSignature = actual.length === calculated.length && crypto.timingSafeEqual(actual, calculated);
  const appIdMatches = Number(params.get("vk_app_id")) === Number(process.env.VK_APP_ID);
  const timestamp = Number(params.get("vk_ts"));
  const timestampFresh = Number.isFinite(timestamp) && Math.abs(Date.now() / 1000 - timestamp) < 24 * 3600;
  return validSignature && appIdMatches && timestampFresh ? Number(params.get("vk_user_id")) || null : null;
}

function userId(req) {
  return verifyLaunchParams(req.headers["x-vk-launch-params"]);
}

const adminIds = new Set((process.env.ADMIN_VK_IDS || "835693694").split(",").map(s => Number(s.trim())).filter(Boolean));
function isAdmin(id) {
  return adminIds.has(Number(id));
}

/* ---- Чат: лимиты и модерация ---- */
const chatThrottle = new Map(); // vk_user_id -> { last, hourStart, hourCount }
let chatLastPrune = 0; // для периодической уборки старых сообщений
const CHAT_MIN_INTERVAL_MS = 2000;
const CHAT_MAX_PER_HOUR = 90;
const CHAT_MAX_LEN = 200;
const BAD_WORDS = ["хуй","хуя","хуё","пизд","бля","бляд","ебал","ебать","ебан","залуп","мудак","мудач","гандон","пидор","петух","шлюх","сука","сучка","охуе","нахуй","похуй","гнид","тварь","ублюд","долбоеб","долбоёб","срать","говно","дерьмо","мразь","козёл"];
function filterText(raw) {
  let t = String(raw || "").replace(/[<>]/g, "").trim().slice(0, CHAT_MAX_LEN);
  if (!t) return "";
  for (const w of BAD_WORDS) {
    const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    if (re.test(t)) t = t.replace(re, "***");
  }
  return t.trim();
}
function chatAllowed(userId) {
  const now = Date.now();
  const rec = chatThrottle.get(userId);
  if (!rec || now - rec.last < CHAT_MIN_INTERVAL_MS) {
    const base = rec && now - rec.last >= CHAT_MIN_INTERVAL_MS ? rec : { hourStart: now, hourCount: 0 };
    chatThrottle.set(userId, { last: now, hourStart: base.hourStart, hourCount: base.hourCount + 1 });
    if (rec && now - rec.last < CHAT_MIN_INTERVAL_MS) return { ok: false, code: "too_fast" };
    return { ok: true };
  }
  let hourStart = rec.hourStart, hourCount = rec.hourCount;
  if (now - hourStart >= 3600_000) { hourStart = now; hourCount = 0; }
  if (hourCount >= CHAT_MAX_PER_HOUR) return { ok: false, code: "hourly_limit" };
  chatThrottle.set(userId, { last: now, hourStart, hourCount: hourCount + 1 });
  return { ok: true };
}

// Проверка бана: вернуть время окончания бана (мс) или 0, если не забанен.
async function chatBanUntil(pool, userId) {
  const res = await pool.query(
    "SELECT banned_until FROM chat_bans WHERE vk_user_id = $1 AND (banned_until IS NULL OR banned_until > now()) ORDER BY banned_until DESC NULLS FIRST LIMIT 1",
    [userId]
  );
  if (!res.rowCount) return 0;
  const until = res.rows[0].banned_until;
  return until == null ? Infinity : new Date(until).getTime();
}

const server = http.createServer(async (req, res) => {
  res._corsOrigin = req.headers.origin;
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true });
  if (req.url?.startsWith("/api/") && !allowedRequest(req.socket.remoteAddress || "unknown")) {
    return json(res, 429, { error: "rate_limited" });
  }

  try {
    if (req.method === "POST" && req.url === "/api/auth/vk") {
      const id = userId(req);
      if (!id) return json(res, 401, { error: "invalid_vk_launch_params" });
      const body = await readBody(req);
      const result = await pool.query(`
        INSERT INTO players (vk_user_id, first_name, last_name, avatar_url)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (vk_user_id) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          avatar_url = EXCLUDED.avatar_url,
          updated_at = now()
        RETURNING vk_user_id, first_name, last_name, avatar_url, mmr, wins, losses, state
      `, [id, safeText(body.first_name, 80), safeText(body.last_name, 80), safeAvatar(body.avatar_url)]);
      return json(res, 200, result.rows[0]);
    }

    // Публичный: кастомный контент для пула дропа игры (без авторизации).
    if (req.method === "GET" && req.url === "/api/custom/items") {
      const result = await pool.query(
        "SELECT id, kind, name, data, drop_chance FROM custom_content WHERE enabled = true ORDER BY kind, name"
      );
      return json(res, 200, { items: result.rows });
    }

    // Публичный: серверный конфиг баланса (без авторизации). Клиент качает при старте.
    if (req.method === "GET" && req.url === "/api/balance") {
      const result = await pool.query("SELECT config FROM game_config WHERE id = 1");
      return json(res, 200, { config: result.rows[0]?.config || {} });
    }

    const id = userId(req);
    if (!id) return json(res, 401, { error: "invalid_vk_launch_params" });

    if (req.method === "GET" && req.url === "/api/me") {
      const result = await pool.query("SELECT vk_user_id, first_name, last_name, avatar_url, mmr, wins, losses, state FROM players WHERE vk_user_id = $1", [id]);
      return result.rowCount ? json(res, 200, result.rows[0]) : json(res, 404, { error: "player_not_found" });
    }

    if (req.method === "GET" && req.url === "/api/profile") {
      const result = await pool.query("SELECT state->'profile' AS profile FROM players WHERE vk_user_id = $1", [id]);
      const profile = result.rows[0]?.profile;
      return result.rowCount ? json(res, 200, { profile: profile || null }) : json(res, 404, { error: "player_not_found" });
    }

    if (req.method === "GET" && req.url === "/api/state") {
      const result = await pool.query("SELECT state->'game' AS game, state_revision FROM players WHERE vk_user_id = $1", [id]);
      return result.rowCount
        ? json(res, 200, { state: result.rows[0].game || null, revision: Number(result.rows[0].state_revision) || 0 })
        : json(res, 404, { error: "player_not_found" });
    }

    if (req.method === "PUT" && req.url === "/api/state") {
      const body = await readBody(req);
      const game = body?.state;
      const baseRevision = Number(body?.baseRevision);
      if (!Number.isSafeInteger(baseRevision) || baseRevision < 0) {
        return json(res, 400, { error: "invalid_revision" });
      }
      if (!validGameState(game) || JSON.stringify(game).length > 512 * 1024) {
        return json(res, 400, { error: "invalid_game_state" });
      }
      // Защита от потери прогресса (двухступенчатая, работает независимо от клиента):
      //
      // 1) Пустой "новый" сейв не должен затирать реальный прогресс. Это защищает
      //    от ситуации, когда на устройстве очистился localStorage / открылся новый
      //    домен и игра предложила создать персонажа — такой пустой сейв НЕ должен
      //    перезаписать существующее облачное состояние. Осознанный "СБРОСИТЬ
      //    ПРОГРЕСС" помечает сейв флагом meta.cloudReset и обходит эту защиту.
      const isEmptySave = (g) => {
        const level = Number(g?.hero?.level) || 0;
        const kills = Number(g?.totals?.kills) || 0;
        const inv = Array.isArray(g?.inv) ? g.inv.length : 0;
        const gold = Number(g?.hero?.gold) || 0;
        return level <= 1 && kills <= 0 && inv === 0 && gold <= 100;
      };
      const incomingEmpty = isEmptySave(game);
      const explicitReset = Boolean(game?.meta?.cloudReset);
      const currentState = await pool.query(
        "SELECT state->'game' AS game FROM players WHERE vk_user_id = $1",
        [id]
      );
      if (!currentState.rowCount) return json(res, 404, { error: "player_not_found" });
      if (!stateLooksSafe(game, currentState.rows[0].game) && !explicitReset) {
        return json(res, 400, { error: "invalid_progress_delta" });
      }
      if (incomingEmpty && !explicitReset) {
        const cur = await pool.query(
          "SELECT state->'game' AS g FROM players WHERE vk_user_id = $1",
          [id]
        );
        if (cur.rowCount) {
          const curGame = cur.rows[0]?.g;
          if (curGame && !isEmptySave(curGame)) {
            // В облаке реальный прогресс, а пришёл пустой сейв без явного сброса —
            // отклоняем, чтобы не потерять прогресс.
            const revision = await pool.query("SELECT state_revision FROM players WHERE vk_user_id = $1", [id]);
            return json(res, 409, { error: "empty_save_conflict", revision: Number(revision.rows[0]?.state_revision) || 0 });
          }
        }
      }
      // 2) Last-write-wins: более свежий сейв не должен затираться более старым.
      //    Сравниваем время последнего сохранения (meta.savedAt, как запасной
      //    вариант lastSeen) — принимаем запись, только если она не старее
      //    уже сохранённой. Сейв, присланный совсем без метки времени, тоже
      //    отклоняем, если в облаке уже есть сейв с меткой (старый клиент не
      //    должен перезаписывать современный сейв).
      const updated = await pool.query(`
        UPDATE players
        SET state = jsonb_set(state, '{game}', $2::jsonb, true),
            state_revision = state_revision + 1,
            updated_at = now()
        WHERE vk_user_id = $1 AND state_revision = $3
        RETURNING state_revision
      `, [id, JSON.stringify(game), baseRevision]);
      if (!updated.rowCount) {
        const current = await pool.query("SELECT state_revision FROM players WHERE vk_user_id = $1", [id]);
        if (!current.rowCount) return json(res, 404, { error: "player_not_found" });
        return json(res, 409, { error: "state_revision_conflict", revision: Number(current.rows[0].state_revision) || 0 });
      }
      return json(res, 200, { ok: true, revision: Number(updated.rows[0].state_revision) });
    }

    if (req.method === "POST" && req.url === "/api/activity/claim") {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query("SELECT state->'game' AS game FROM players WHERE vk_user_id = $1 FOR UPDATE", [id]);
        if (!result.rowCount || !result.rows[0].game) {
          await client.query("ROLLBACK");
          return json(res, 409, { error: "game_state_not_initialized" });
        }
        const game = result.rows[0].game;
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const activity = game.activity || { day: 1, claimed: [], lastClaimDate: "" };
        if (activity.lastClaimDate === today) {
          await client.query("ROLLBACK");
          return json(res, 409, { error: "already_claimed" });
        }
        const day = activity.lastClaimDate && activity.lastClaimDate !== yesterday ? 1 : Math.max(1, Math.min(7, activity.day || 1));
        const reward = LOGIN_REWARDS[day - 1];
        game.hero.gold += reward.gold;
        game.hero.gems += reward.gems;
        game.hero.potions += reward.potions;
        game.totals.goldEarned += reward.gold;
        game.activity = { day: day >= 7 ? 1 : day + 1, claimed: day >= 7 ? [] : [...(activity.claimed || []), day], lastClaimDate: today };
        game.modal = null;
        const updated = await client.query("UPDATE players SET state = jsonb_set(state, '{game}', $2::jsonb, true), state_revision = state_revision + 1, updated_at = now() WHERE vk_user_id = $1 RETURNING state_revision", [id, JSON.stringify(game)]);
        await client.query("COMMIT");
        return json(res, 200, { state: game, day, reward, revision: Number(updated.rows[0].state_revision) });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    if (req.method === "GET" && req.url === "/api/leaderboard") {
      const result = await pool.query("SELECT vk_user_id, first_name, last_name, avatar_url, mmr, wins, losses FROM players ORDER BY mmr DESC, updated_at ASC LIMIT 100");
      return json(res, 200, { items: result.rows });
    }

    if (req.method === "POST" && req.url === "/api/profile/sync") {
      const body = await readBody(req);
      const profile = profileBody(body);
      if (!profile) return json(res, 400, { error: "invalid_profile" });
      const current = await pool.query("SELECT state->'profile' AS profile FROM players WHERE vk_user_id = $1", [id]);
      if (!current.rowCount) return json(res, 404, { error: "player_not_found" });
      const previous = current.rows[0].profile || {};
      const previousLevel = Number.isInteger(previous.level) ? previous.level : 1;
      const acceptedLevel = Math.max(previousLevel, Math.min(profile.level, previousLevel + 5));
      const acceptedClass = previous.classId === "mage" || previous.classId === "archer" ? previous.classId : profile.classId;
      const acceptedProfile = profileBody({ class_id: acceptedClass, level: acceptedLevel });
      await pool.query(`
        UPDATE players
        SET state = jsonb_set(state, '{profile}', $2::jsonb, true), updated_at = now()
        WHERE vk_user_id = $1
      `, [id, JSON.stringify(acceptedProfile)]);
      return json(res, 200, { ok: true, profile: acceptedProfile });
    }

    if (req.method === "GET" && req.url?.startsWith("/api/party/bots")) {
      const url = new URL(req.url, "http://localhost");
      const tier = Math.max(1, Math.min(5, Number(url.searchParams.get("tier") || 1)));
      const minLevel = [12, 18, 25, 32, 40][tier - 1];
      const result = await pool.query(`
        SELECT first_name, last_name, state->'profile' AS profile
        FROM players
        WHERE vk_user_id <> $1
          AND updated_at > now() - interval '30 days'
          AND (state->'profile'->>'level') ~ '^[0-9]+$'
          AND ((state->'profile'->>'level')::int) >= $2
        ORDER BY random()
        LIMIT 3
      `, [id, minLevel]);
      const bots = result.rows.map(row => ({
        name: safeText(`${row.first_name} ${row.last_name}`, 40) || "Герой",
        classId: row.profile?.classId === "archer" ? "archer" : "mage",
        level: Number(row.profile?.level) || minLevel,
        power: Number(row.profile?.power) || 0,
        source: "server",
      }));
      return json(res, 200, { bots });
    }

    if (req.method === "POST" && req.url === "/api/rewards/claim") {
      const body = await readBody(req);
      const eventId = String(body.event_id || "");
      const rewardKind = String(body.reward_kind || "offline_bonus").slice(0, 40);
      if (!crypto.randomUUID || !/^[0-9a-f-]{36}$/i.test(eventId)) return json(res, 400, { error: "invalid_event_id" });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const player = await client.query("SELECT vk_user_id FROM players WHERE vk_user_id = $1 FOR UPDATE", [id]);
        if (!player.rowCount) {
          await client.query("ROLLBACK");
          return json(res, 404, { error: "player_not_found" });
        }
        const limits = await client.query(`
          SELECT COUNT(*)::int AS total, EXTRACT(EPOCH FROM (now() - MAX(created_at)))::int AS since_last
          FROM reward_events
          WHERE vk_user_id = $1 AND kind = 'rewarded_ad' AND reward->>'kind' = $2 AND created_at > now() - interval '24 hours'
        `, [id, rewardKind]);
        const total = limits.rows[0]?.total || 0;
        const sinceLast = limits.rows[0]?.since_last;
        if (total >= 5) {
          await client.query("ROLLBACK");
          return json(res, 429, { error: "ad_daily_limit", limit: 5 });
        }
        if (sinceLast != null && sinceLast < 300) {
          await client.query("ROLLBACK");
          return json(res, 429, { error: "ad_cooldown", retry_after: 300 - sinceLast });
        }
        const reward = REWARDED_AD_REWARDS[rewardKind] || REWARDED_AD_REWARDS.offline_bonus;
        const result = await client.query(`
          INSERT INTO reward_events (event_id, vk_user_id, kind, reward)
          VALUES ($1, $2, 'rewarded_ad', $3::jsonb)
          ON CONFLICT (event_id) DO NOTHING
          RETURNING event_id
        `, [eventId, id, JSON.stringify({ kind: rewardKind })]);
        await client.query("COMMIT");
        return json(res, result.rowCount ? 201 : 409, { granted: Boolean(result.rowCount), reward: result.rowCount ? reward : null });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    /* ---- Дуэли: сезоны и награды за ранг ---- */
    // id сезона = 'YYYY-MM' (совпадает с сезонными ивентами)
    const seasonId = () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };
    // ранг по MMR и дневная награда за него
    const rankDefs = [
      { min: 0,    name: "Новичок",       gold: 300,  gems: 0 },
      { min: 900,  name: "Боец",          gold: 600,  gems: 0 },
      { min: 1150, name: "Гладиатор",     gold: 1000, gems: 1 },
      { min: 1400, name: "Чемпион",       gold: 1500, gems: 2 },
      { min: 1650, name: "Мастер",        gold: 2200, gems: 3 },
      { min: 1900, name: "Легенда Бездны", gold: 3500, gems: 5 },
    ];
    const rankOf = (mmr) => { for (let i = rankDefs.length - 1; i >= 0; i--) if (mmr >= rankDefs[i].min) return rankDefs[i]; return rankDefs[0]; };
    // Проверка смены сезона: если сезон изменился — сброс MMR до 1000, награда за лучший ранг сезона в inbox.
    const checkSeason = async (client, id) => {
      const res = await client.query("SELECT mmr, mmr_season, season_best_mmr FROM players WHERE vk_user_id = $1 FOR UPDATE", [id]);
      if (!res.rowCount) return { seasonChanged: false };
      const row = res.rows[0];
      const nowSeason = seasonId();
      if (row.mmr_season && row.mmr_season !== nowSeason) {
        const best = Math.max(Number(row.season_best_mmr) || 1000, Number(row.mmr) || 1000);
        const r = rankOf(best);
        // награда за лучший ранг сезона
        await client.query("INSERT INTO inbox (vk_user_id, item) VALUES ($1, $2::jsonb)", [id, JSON.stringify({ kind: "season_rank", rank: r.name, gold: r.gold, gems: r.gems })]);
        await client.query("UPDATE players SET mmr = 1000, mmr_season = $2, season_best_mmr = 1000 WHERE vk_user_id = $1", [id, nowSeason]);
        return { seasonChanged: true, reward: r, best };
      }
      if (!row.mmr_season) {
        await client.query("UPDATE players SET mmr_season = $2, season_best_mmr = GREATEST($3, COALESCE(season_best_mmr, 0)) WHERE vk_user_id = $1", [id, nowSeason, Number(row.mmr) || 1000]);
      }
      return { seasonChanged: false };
    };

    if (req.method === "GET" && req.url?.startsWith("/api/duel/opponent")) {
      const url = new URL(req.url, "http://localhost");
      const myMmr = Number(url.searchParams.get("mmr") || 1000);
      const band = Math.max(120, Math.min(500, Number(url.searchParams.get("band") || 250)));
      // Реальный игрок (не сам), активный недавно, с профилем, MMR в диапазоне ±band.
      // Сначала пробуем узкий диапазон, если пусто — расширяем, чтобы чаще попадались реальные игроки.
      let result = await pool.query(`
        SELECT vk_user_id, first_name, last_name, avatar_url, mmr,
               state->'profile' AS profile, wins, losses
        FROM players
        WHERE vk_user_id <> $1
          AND updated_at > now() - interval '14 days'
          AND state->'profile'->>'level' ~ '^[0-9]+$'
          AND mmr BETWEEN $2 AND $3
        ORDER BY abs(mmr - $4) ASC, updated_at DESC
        LIMIT 8
      `, [id, myMmr - band, myMmr + band, myMmr]);
      if (!result.rows.length) {
        const wide = band + 550; // расширенный поиск (±800)
        result = await pool.query(`
          SELECT vk_user_id, first_name, last_name, avatar_url, mmr,
                 state->'profile' AS profile, wins, losses
          FROM players
          WHERE vk_user_id <> $1
            AND updated_at > now() - interval '14 days'
            AND state->'profile'->>'level' ~ '^[0-9]+$'
            AND mmr BETWEEN $2 AND $3
          ORDER BY abs(mmr - $4) ASC, updated_at DESC
          LIMIT 8
        `, [id, myMmr - wide, myMmr + wide, myMmr]);
      }
      let opponent = null;
      if (result.rows.length) {
        const pick = result.rows[Math.floor(Math.random() * result.rows.length)];
        const profile = pick.profile || {};
        const classId = profile.classId === "archer" ? "archer" : "mage";
        const level = Number.isInteger(profile.level) ? Math.min(9999, Math.max(1, profile.level)) : 1;
        const power = Number(profile.power) || Math.round(10 * (classId === "archer" ? 0.94 : 1) * Math.pow(1.16, level - 1));
        opponent = {
          id: pick.vk_user_id,
          name: safeText(`${pick.first_name} ${pick.last_name}`, 40) || "Герой",
          classId,
          level,
          power,
          mmr: Number(pick.mmr) || 1000,
          wins: Number(pick.wins) || 0,
          losses: Number(pick.losses) || 0,
        };
      }
      return json(res, 200, { opponent });
    }

    if (req.method === "POST" && req.url === "/api/duel/result") {
      const body = await readBody(req);
      const opponentId = Number(body?.opponent_id);
      if (typeof body?.win !== "boolean") return json(res, 400, { error: "invalid_result" });
      const win = body.win;
      if (!Number.isInteger(opponentId) || opponentId <= 0) return json(res, 400, { error: "invalid_opponent" });
      // Анти-фарм MMR: нельзя дуэлить сам с собой и нельзя слать отчёты чаще, чем
      // раз в DUEL_MIN_INTERVAL_MS (клиент не может провести честную дуэль быстрее).
      if (opponentId === id) return json(res, 400, { error: "cannot_duel_self" });
      const nowMs = Date.now();
      const lastDuel = lastDuelAt.get(id);
      if (lastDuel && nowMs - lastDuel < DUEL_MIN_INTERVAL_MS) {
        return json(res, 429, { error: "duel_too_fast" });
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const firstId = Math.min(id, opponentId);
        const secondId = Math.max(id, opponentId);
        const locked = await client.query("SELECT vk_user_id, mmr FROM players WHERE vk_user_id IN ($1, $2) ORDER BY vk_user_id FOR UPDATE", [firstId, secondId]);
        if (locked.rowCount !== 2) { await client.query("ROLLBACK"); return json(res, 404, { error: "opponent_not_found" }); }
        const mine = locked.rows.find(row => Number(row.vk_user_id) === id);
        const foe = locked.rows.find(row => Number(row.vk_user_id) === opponentId);

        const myMmr = mine.mmr;
        const foeMmr = foe.mmr;
        // ELO: ожидаемый результат, дельта для меня; соперник получает зеркальную.
        const expected = 1 / (1 + Math.pow(10, (foeMmr - myMmr) / 400));
        const K = 24;
        const myDelta = Math.round(K * (win ? 1 : 0) - K * expected);
        const myNew = Math.max(0, myMmr + myDelta);
        const foeNew = Math.max(0, foeMmr - myDelta);
        const actualDelta = myNew - myMmr;

        await client.query(`
          UPDATE players
          SET mmr = $2, wins = wins + $3, losses = losses + $4, season_best_mmr = GREATEST(COALESCE(season_best_mmr, 0), $2), updated_at = now()
          WHERE vk_user_id = $1
        `, [id, myNew, win ? 1 : 0, win ? 0 : 1]);
        await client.query(`
          UPDATE players
          SET mmr = $2, wins = wins + $3, losses = losses + $4, season_best_mmr = GREATEST(COALESCE(season_best_mmr, 0), $2), updated_at = now()
          WHERE vk_user_id = $1
        `, [opponentId, foeNew, win ? 0 : 1, win ? 1 : 0]);
        await client.query("COMMIT");
        lastDuelAt.set(id, Date.now());
        return json(res, 200, {
          delta: actualDelta,
          mmr: myNew,
          opponent_mmr: foeNew,
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    // Проверка смены сезона MMR (клиент зовёт при входе в арену). Если сезон сменился — сброс + награда.
    if (req.method === "POST" && req.url === "/api/duel/season-check") {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const info = await checkSeason(client, id);
        const row = await client.query("SELECT mmr, mmr_season, season_best_mmr FROM players WHERE vk_user_id = $1", [id]);
        const mmr = row.rows[0]?.mmr ?? 1000;
        const season = row.rows[0]?.mmr_season ?? seasonId();
        const best = row.rows[0]?.season_best_mmr ?? mmr;
        await client.query("COMMIT");
        return json(res, 200, {
          seasonChanged: Boolean(info.seasonChanged),
          reward: info.reward ?? null,
          mmr,
          season,
          best: Math.max(best, mmr),
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    // Ежедневная награда за текущий ранг MMR (раз в сутки).
    if (req.method === "POST" && req.url === "/api/duel/rank-reward") {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await checkSeason(client, id);
        const row = await client.query("SELECT mmr, to_char(rank_reward_date, 'YYYY-MM-DD') AS rank_reward_date FROM players WHERE vk_user_id = $1 FOR UPDATE", [id]);
        if (!row.rowCount) { await client.query("ROLLBACK"); return json(res, 404, { error: "player_not_found" }); }
        const today = new Date().toISOString().slice(0, 10);
        if (row.rows[0].rank_reward_date === today) { await client.query("ROLLBACK"); return json(res, 409, { error: "already_claimed" }); }
        const r = rankOf(Number(row.rows[0].mmr) || 1000);
        await client.query("INSERT INTO inbox (vk_user_id, item) VALUES ($1, $2::jsonb)", [id, JSON.stringify({ kind: "rank_reward", rank: r.name, gold: r.gold, gems: r.gems })]);
        await client.query("UPDATE players SET rank_reward_date = $2 WHERE vk_user_id = $1", [id, today]);
        await client.query("COMMIT");
        return json(res, 200, { ok: true, rank: r.name, gold: r.gold, gems: r.gems });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    /* ================= КАСТОМНЫЙ КОНТЕНТ (админка) ================= */

    // Публично: выданные игроку предметы
    if (req.method === "GET" && req.url === "/api/inbox") {      const result = await pool.query(
        "SELECT id, item FROM inbox WHERE vk_user_id = $1 AND claimed = false ORDER BY created_at ASC",
        [id]
      );
      return json(res, 200, { items: result.rows.map(r => r.item) });
    }

    // Забрать предметы из inbox
    if (req.method === "POST" && req.url === "/api/inbox/claim") {
      const result = await pool.query(
        "UPDATE inbox SET claimed = true WHERE vk_user_id = $1 AND claimed = false RETURNING item",
        [id]
      );
      return json(res, 200, { items: result.rows.map(r => r.item) });
    }

    /* ---- Чат ---- */
    if (req.method === "GET" && req.url === "/api/chat/messages") {
      const result = await pool.query(`
        SELECT id, vk_user_id, user_name, text, created_at
        FROM chat_messages ORDER BY id DESC LIMIT 100
      `);
      const messages = result.rows.reverse().map(r => ({
        id: Number(r.id),
        userId: Number(r.vk_user_id),
        userName: r.user_name,
        text: r.text,
        ts: new Date(r.created_at).getTime(),
        me: Number(r.vk_user_id) === id,
        admin: isAdmin(Number(r.vk_user_id)),
      }));
      return json(res, 200, { messages });
    }

    if (req.method === "POST" && req.url === "/api/chat/send") {
      const banUntil = await chatBanUntil(pool, id);
      if (banUntil > 0) {
        const forever = banUntil === Infinity;
        return json(res, 403, { error: "banned", until: forever ? null : banUntil });
      }
      const throttle = chatAllowed(id);
      if (!throttle.ok) return json(res, 429, { error: throttle.code });
      const body = await readBody(req);
      const text = filterText(body?.text);
      if (!text) return json(res, 400, { error: "empty" });
      // имя из профиля игрока (если есть)
      const nameRes = await pool.query(
        "SELECT first_name, last_name FROM players WHERE vk_user_id = $1", [id]
      );
      const row = nameRes.rows[0];
      const userName = [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim().slice(0, 40) || "Бродяга";
      const inserted = await pool.query(`
        INSERT INTO chat_messages (vk_user_id, user_name, text) VALUES ($1, $2, $3) RETURNING id, created_at
      `, [id, userName, text]);
      // умеренная уборка: раз в час удаляем сообщения старше 3 дней
      if (!chatLastPrune || Date.now() - chatLastPrune > 3600_000) {
        chatLastPrune = Date.now();
        await pool.query(`DELETE FROM chat_messages WHERE created_at < now() - interval '3 days'`).catch(() => {});
      }
      const created = new Date(inserted.rows[0].created_at).getTime();
      return json(res, 200, { ok: true, id: Number(inserted.rows[0].id), ts: created, userName, me: true, admin: isAdmin(id) });
    }

    if (req.method === "DELETE" && req.url?.startsWith("/api/chat/message")) {
      const url = new URL(req.url, "http://localhost");
      const mid = Number(url.searchParams.get("id"));
      if (!Number.isInteger(mid) || mid <= 0) return json(res, 400, { error: "missing_id" });
      // удалить можно своё сообщение (или любое — админу)
      const result = isAdmin(id)
        ? await pool.query("DELETE FROM chat_messages WHERE id = $1 RETURNING id", [mid])
        : await pool.query("DELETE FROM chat_messages WHERE id = $1 AND vk_user_id = $2 RETURNING id", [mid, id]);
      return json(res, 200, { ok: result.rowCount > 0 });
    }

    /* ---- Гильдии ---- */
    // Уровень гильдии из опыта: level = floor(sqrt(xp/40)) + 1
    const guildLevel = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 40)) + 1;

    // Моя гильдия (с участниками) или null
    if (req.method === "GET" && req.url === "/api/guild/mine") {
      const mem = await pool.query(
        `SELECT gm.guild_id, gm.role, gm.goal_claimed FROM guild_members gm WHERE gm.vk_user_id = $1`,
        [id]
      );
      if (!mem.rows.length) return json(res, 200, { guild: null });
      const gid = mem.rows[0].guild_id;
      const g = await pool.query(
        `SELECT id, name, tag, owner_id, xp, goal_key, goal_value, goal_target, created_at FROM guilds WHERE id = $1`, [gid]
      );
      const guild = g.rows[0];
      if (!guild) return json(res, 200, { guild: null });
      const members = await pool.query(
        `SELECT gm.vk_user_id, gm.role, gm.goal_claimed, p.first_name, p.last_name, p.avatar_url,
                (p.state->'profile'->>'level')::int AS level
         FROM guild_members gm JOIN players p ON p.vk_user_id = gm.vk_user_id
         WHERE gm.guild_id = $1 ORDER BY (gm.role = 'owner') DESC, gm.joined_at ASC`,
        [gid]
      );
      return json(res, 200, {
        guild: {
          id: guild.id,
          name: guild.name,
          tag: guild.tag,
          ownerId: Number(guild.owner_id),
          xp: Number(guild.xp),
          level: guildLevel(Number(guild.xp)),
          goalKey: guild.goal_key,
          goalValue: Number(guild.goal_value),
          goalTarget: Number(guild.goal_target),
          goalClaimed: mem.rows[0].goal_claimed,
          myRole: mem.rows[0].role,
          members: members.rows.map(r => ({
            vk_user_id: Number(r.vk_user_id),
            name: [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || "Бродяга",
            avatar_url: r.avatar_url,
            role: r.role,
            level: Number.isFinite(Number(r.level)) ? Number(r.level) : 1,
          })),
        },
      });
    }

    // Поиск гильдий по названию/тегу (для вступления)
    if (req.method === "GET" && req.url?.startsWith("/api/guild/search")) {
      const url = new URL(req.url, "http://localhost");
      const q = safeText(url.searchParams.get("q"), 30);
      if (q.length < 2) return json(res, 200, { items: [] });
      const result = await pool.query(
        `SELECT g.id, g.name, g.tag, g.xp, g.goal_key, g.goal_value, g.goal_target,
                (SELECT count(*) FROM guild_members gm WHERE gm.guild_id = g.id)::int AS members
         FROM guilds g WHERE g.name ILIKE $1 ORDER BY g.xp DESC LIMIT 20`,
        [`%${q}%`]
      );
      return json(res, 200, { items: result.rows.map(r => ({ id: r.id, name: r.name, tag: r.tag, level: guildLevel(Number(r.xp)), members: Number(r.members), goalKey: r.goal_key })) });
    }

    // Создать гильдию
    if (req.method === "POST" && req.url === "/api/guild/create") {
      const body = await readBody(req);
      const name = safeText(body?.name, 24);
      const tag = safeText(body?.tag, 6);
      if (name.length < 2) return json(res, 400, { error: "name_short" });
      const inGuild = await pool.query("SELECT 1 FROM guild_members WHERE vk_user_id = $1", [id]);
      if (inGuild.rows.length) return json(res, 400, { error: "already_in_guild" });
      const dup = await pool.query("SELECT 1 FROM guilds WHERE name = $1", [name]);
      if (dup.rows.length) return json(res, 400, { error: "name_taken" });
      // Гарантируем существование игрока в players: FK guilds_owner_id_fkey ссылается
      // на players(vk_user_id). Если игрок ещё не проходил auth (апи редко, но может
      // вызвать создание раньше), INSERT упадёт на FK — upsert создаёт строку заранее.
      await pool.query(
        `INSERT INTO players (vk_user_id, first_name, last_name, state)
         VALUES ($1, '', '', '{}'::jsonb)
         ON CONFLICT (vk_user_id) DO NOTHING`,
        [id]
      );
      const created = await pool.query(
        `INSERT INTO guilds (name, tag, owner_id) VALUES ($1, $2, $3) RETURNING id`,
        [name, tag, id]
      );
      await pool.query(
        `INSERT INTO guild_members (guild_id, vk_user_id, role) VALUES ($1, $2, 'owner')`,
        [created.rows[0].id, id]
      );
      return json(res, 200, { ok: true, guildId: created.rows[0].id });
    }

    // Вступить в гильдию
    if (req.method === "POST" && req.url === "/api/guild/join") {
      const body = await readBody(req);
      const gid = Number(body?.guildId);
      if (!Number.isInteger(gid) || gid <= 0) return json(res, 400, { error: "invalid_guild" });
      const inGuild = await pool.query("SELECT 1 FROM guild_members WHERE vk_user_id = $1", [id]);
      if (inGuild.rows.length) return json(res, 400, { error: "already_in_guild" });
      const g = await pool.query("SELECT id FROM guilds WHERE id = $1", [gid]);
      if (!g.rows.length) return json(res, 400, { error: "not_found" });
      // Гарантируем существование игрока в players (FK guild_members_vk_user_id_fkey).
      await pool.query(
        `INSERT INTO players (vk_user_id, first_name, last_name, state)
         VALUES ($1, '', '', '{}'::jsonb)
         ON CONFLICT (vk_user_id) DO NOTHING`,
        [id]
      );
      await pool.query(
        `INSERT INTO guild_members (guild_id, vk_user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
        [gid, id]
      );
      return json(res, 200, { ok: true });
    }

    // Покинуть гильдию (владелец может передать владение или распустить)
    if (req.method === "POST" && req.url === "/api/guild/leave") {
      const mem = await pool.query("SELECT guild_id, role FROM guild_members WHERE vk_user_id = $1", [id]);
      if (!mem.rows.length) return json(res, 400, { error: "not_in_guild" });
      const gid = mem.rows[0].guild_id;
      if (mem.rows[0].role === "owner") {
        // передать владение старейшему участнику, либо распустить гильдию
        const next = await pool.query(
          `SELECT vk_user_id FROM guild_members WHERE guild_id = $1 AND vk_user_id <> $2 ORDER BY joined_at ASC LIMIT 1`,
          [gid, id]
        );
        if (next.rows.length) {
          // Преемник тоже должен существовать в players (FK guilds_owner_id_fkey).
          await pool.query(
            `INSERT INTO players (vk_user_id, first_name, last_name, state)
             VALUES ($1, '', '', '{}'::jsonb)
             ON CONFLICT (vk_user_id) DO NOTHING`,
            [next.rows[0].vk_user_id]
          );
          await pool.query(`UPDATE guild_members SET role = 'owner' WHERE guild_id = $1 AND vk_user_id = $2`, [gid, next.rows[0].vk_user_id]);
          await pool.query(`UPDATE guilds SET owner_id = $1 WHERE id = $2`, [next.rows[0].vk_user_id, gid]);
        } else {
          await pool.query(`DELETE FROM guilds WHERE id = $1`, [gid]);
          return json(res, 200, { ok: true, disbanded: true });
        }
      }
      await pool.query(`DELETE FROM guild_members WHERE guild_id = $1 AND vk_user_id = $2`, [gid, id]);
      return json(res, 200, { ok: true });
    }

    // Отчёт о прогрессе (клиент шлёт приросты убийств/золота для общей цели и опыта)
    if (req.method === "POST" && req.url === "/api/guild/progress") {
      const body = await readBody(req);
      const eventId = String(body?.event_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(eventId)) return json(res, 400, { error: "invalid_event_id" });
      // Кап приростов за вызов: клиент шлёт "дельты" убийств/золота, и без потолка
      // можно накрутить гильдейский прогресс до бесконечности и фармить награды.
      // Легитимный игрок никогда не наберёт больше за один отчёт, но кап блокирует
      // ручное дёрганье API с огромными числами.
      let dkills = Math.max(0, Math.floor(Number(body?.kills) || 0));
      let dgold = Math.max(0, Math.floor(Number(body?.gold) || 0));
      if (dkills > 500) dkills = 500;
      if (dgold > 50000) dgold = 50000;
      if (!dkills && !dgold) return json(res, 200, { ok: true });
      const mem = await pool.query(
        "SELECT guild_id, role FROM guild_members WHERE vk_user_id = $1", [id]
      );
      if (!mem.rows.length) return json(res, 200, { ok: true, noGuild: true });
      const gid = mem.rows[0].guild_id;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const event = await client.query(
          "INSERT INTO reward_events (event_id, vk_user_id, kind, reward) VALUES ($1, $2, 'game_event', $3::jsonb) ON CONFLICT (event_id) DO NOTHING RETURNING event_id",
          [eventId, id, JSON.stringify({ kind: "guild_progress", kills: dkills, gold: dgold })]
        );
        if (!event.rowCount) {
          await client.query("ROLLBACK");
          return json(res, 200, { ok: true, duplicate: true });
        }
        const g = await client.query("SELECT goal_key, goal_target, goal_value, xp FROM guilds WHERE id = $1 FOR UPDATE", [gid]);
      const guild = g.rows[0];
      if (!guild) { await client.query("ROLLBACK"); return json(res, 200, { ok: true, noGuild: true }); }
      let goalValue = Number(guild.goal_value);
      if (guild.goal_target > 0) {
        const add = guild.goal_key === "gold" ? dgold : dkills;
        goalValue = Math.min(Number(guild.goal_target), goalValue + add);
      }
      const xp = Number(guild.xp) + dkills * 2 + Math.floor(dgold / 50);
      await client.query(
        `UPDATE guilds SET goal_value = $1, xp = $2 WHERE id = $3`,
        [goalValue, xp, gid]
      );
      await client.query("COMMIT");
      return json(res, 200, { ok: true });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    // Задать общую цель гильдии (только владелец)
    if (req.method === "POST" && req.url === "/api/guild/goal/set") {
      const body = await readBody(req);
      const key = body?.goalKey === "gold" ? "gold" : "kills";
      const target = Math.floor(Number(body?.target) || 0);
      if (target < 1) return json(res, 400, { error: "bad_target" });
      const mem = await pool.query("SELECT guild_id, role FROM guild_members WHERE vk_user_id = $1", [id]);
      if (!mem.rows.length) return json(res, 400, { error: "not_in_guild" });
      if (mem.rows[0].role !== "owner") return json(res, 403, { error: "not_owner" });
      const gid = mem.rows[0].guild_id;
      // сброс: новая цель, обнуляем прогресс и флаги получения наград
      await pool.query(
        `UPDATE guilds SET goal_key = $1, goal_target = $2, goal_value = 0 WHERE id = $3`, [key, target, gid]
      );
      await pool.query(`UPDATE guild_members SET goal_claimed = false WHERE guild_id = $1`, [gid]);
      return json(res, 200, { ok: true });
    }

    // Забрать награду общей цели (когда цель достигнута)
    if (req.method === "POST" && req.url === "/api/guild/goal/claim") {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const mem = await client.query(
          "SELECT guild_id, goal_claimed FROM guild_members WHERE vk_user_id = $1 FOR UPDATE", [id]
        );
        if (!mem.rows.length) { await client.query("ROLLBACK"); return json(res, 400, { error: "not_in_guild" }); }
        const gid = mem.rows[0].guild_id;
        const g = await client.query("SELECT goal_key, goal_value, goal_target FROM guilds WHERE id = $1 FOR UPDATE", [gid]);
        const guild = g.rows[0];
        if (!guild || guild.goal_target <= 0 || Number(guild.goal_value) < Number(guild.goal_target)) {
          await client.query("ROLLBACK");
          return json(res, 400, { error: "goal_not_met" });
        }
        if (mem.rows[0].goal_claimed) {
          await client.query("ROLLBACK");
          return json(res, 400, { error: "already_claimed" });
        }
      // награда цели: золото + кристаллы в inbox (чтобы игрок забрал из игры)
      const goalGold = Number(guild.goal_target) * (guild.goal_key === "gold" ? 1 : 10);
      const goalGems = 5;
      await client.query("UPDATE guild_members SET goal_claimed = true WHERE guild_id = $1 AND vk_user_id = $2", [gid, id]);
      await client.query(
        `INSERT INTO inbox (vk_user_id, item) VALUES ($1, $2::jsonb)`,
        [id, JSON.stringify({ kind: "guild_goal", gold: goalGold, gems: goalGems })]
      );
      await client.query("COMMIT");
      return json(res, 200, { ok: true, gold: goalGold, gems: goalGems });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    // Гилдейский чат
    const myGuild = async () => {
      const mem = await pool.query("SELECT guild_id FROM guild_members WHERE vk_user_id = $1", [id]);
      return mem.rows.length ? mem.rows[0].guild_id : null;
    };

    if (req.method === "GET" && req.url === "/api/guild/chat/messages") {
      const gid = await myGuild();
      if (!gid) return json(res, 200, { messages: [] });
      const result = await pool.query(
        `SELECT id, vk_user_id, user_name, text, created_at FROM guild_chat_messages
         WHERE guild_id = $1 ORDER BY id DESC LIMIT 100`, [gid]
      );
      const messages = result.rows.reverse().map(r => ({
        id: Number(r.id),
        userId: Number(r.vk_user_id),
        userName: r.user_name,
        text: r.text,
        ts: new Date(r.created_at).getTime(),
        me: Number(r.vk_user_id) === id,
        admin: isAdmin(Number(r.vk_user_id)),
      }));
      return json(res, 200, { messages });
    }

    if (req.method === "POST" && req.url === "/api/guild/chat/send") {
      const gid = await myGuild();
      if (!gid) return json(res, 403, { error: "not_in_guild" });
      const banUntil = await chatBanUntil(pool, id);
      if (banUntil > 0) {
        const forever = banUntil === Infinity;
        return json(res, 403, { error: "banned", until: forever ? null : banUntil });
      }
      const throttle = chatAllowed(`g${id}`);
      if (!throttle.ok) return json(res, 429, { error: throttle.code });
      const body = await readBody(req);
      const text = filterText(body?.text);
      if (!text) return json(res, 400, { error: "empty" });
      const nameRes = await pool.query("SELECT first_name, last_name FROM players WHERE vk_user_id = $1", [id]);
      const row = nameRes.rows[0];
      const userName = [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim().slice(0, 40) || "Бродяга";
      const inserted = await pool.query(
        `INSERT INTO guild_chat_messages (guild_id, vk_user_id, user_name, text) VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
        [gid, id, userName, text]
      );
      return json(res, 200, {
        ok: true, id: Number(inserted.rows[0].id),
        ts: new Date(inserted.rows[0].created_at).getTime(), userName, me: true, admin: isAdmin(id),
      });
    }

    if (req.method === "DELETE" && req.url?.startsWith("/api/guild/chat/message")) {
      const url = new URL(req.url, "http://localhost");
      const mid = Number(url.searchParams.get("id"));
      if (!Number.isInteger(mid) || mid <= 0) return json(res, 400, { error: "missing_id" });
      const gid = await myGuild();
      if (!gid) return json(res, 403, { error: "not_in_guild" });
      // своё сообщение, либо админ
      const result = isAdmin(id)
        ? await pool.query("DELETE FROM guild_chat_messages WHERE id = $1 AND guild_id = $2 RETURNING id", [mid, gid])
        : await pool.query("DELETE FROM guild_chat_messages WHERE id = $1 AND guild_id = $2 AND vk_user_id = $3 RETURNING id", [mid, gid, id]);
      return json(res, 200, { ok: result.rowCount > 0 });
    }

    /* ---- Админка (только ADMIN_VK_IDS) ---- */
    if (req.url?.startsWith("/api/admin/")) {
      if (!isAdmin(id)) return json(res, 403, { error: "forbidden" });

      // Прочитать конфиг баланса
      if (req.method === "GET" && req.url === "/api/admin/balance") {
        const result = await pool.query("SELECT config FROM game_config WHERE id = 1");
        return json(res, 200, { config: result.rows[0]?.config || {} });
      }

      // Сохранить конфиг баланса (баланс + пулы дропа)
      if (req.method === "POST" && req.url === "/api/admin/balance") {
        const body = await readBody(req);
        const config = body?.config && typeof body.config === "object" ? body.config : {};
        if (JSON.stringify(config).length > 256 * 1024) return json(res, 400, { error: "config_too_large" });
        await pool.query(`
          INSERT INTO game_config (id, config, updated_at)
          VALUES (1, $1::jsonb, now())
          ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config, updated_at = now()
        `, [JSON.stringify(config)]);
        return json(res, 200, { ok: true });
      }

      if (req.method === "GET" && req.url === "/api/admin/content") {
        const result = await pool.query(
          "SELECT id, kind, name, data, drop_chance, enabled, updated_at FROM custom_content ORDER BY updated_at DESC"
        );
        return json(res, 200, { items: result.rows });
      }

      if (req.method === "POST" && req.url === "/api/admin/content") {
        const body = await readBody(req);
        const cid = safeText(body.id, 40) || `c${Date.now()}`;
        const kind = body.kind === "set" ? "set" : "item";
        const name = safeText(body.name, 60);
        const data = body.data && typeof body.data === "object" ? body.data : {};
        const dropChance = Math.max(0, Math.min(100, Number(body.drop_chance) || 0));
        const enabled = body.enabled !== false;
        if (!name || !data) return json(res, 400, { error: "invalid_content" });
        if (JSON.stringify(data).length > 16 * 1024) return json(res, 400, { error: "content_too_large" });
        await pool.query(`
          INSERT INTO custom_content (id, kind, name, data, drop_chance, enabled, updated_at)
          VALUES ($1, $2, $3, $4::jsonb, $5, $6, now())
          ON CONFLICT (id) DO UPDATE SET
            kind = EXCLUDED.kind, name = EXCLUDED.name, data = EXCLUDED.data,
            drop_chance = EXCLUDED.drop_chance, enabled = EXCLUDED.enabled,
            updated_at = now()
        `, [cid, kind, name, JSON.stringify(data), dropChance, enabled]);
        return json(res, 200, { ok: true, id: cid });
      }

      if (req.method === "DELETE" && req.url?.startsWith("/api/admin/content")) {
        const url = new URL(req.url, "http://localhost");
        const cid = url.searchParams.get("id");
        if (!cid) return json(res, 400, { error: "missing_id" });
        await pool.query("DELETE FROM custom_content WHERE id = $1", [cid]);
        return json(res, 200, { ok: true });
      }

      // Модерация чата: удалить любое сообщение
      if (req.method === "DELETE" && req.url?.startsWith("/api/admin/chat")) {
        const url = new URL(req.url, "http://localhost");
        const mid = Number(url.searchParams.get("id"));
        if (!Number.isInteger(mid) || mid <= 0) return json(res, 400, { error: "missing_id" });
        const result = await pool.query("DELETE FROM chat_messages WHERE id = $1 RETURNING id", [mid]);
        return json(res, 200, { ok: result.rowCount > 0 });
      }

      // Список банов (активные)
      if (req.method === "GET" && req.url === "/api/admin/bans") {
        const result = await pool.query(`
          SELECT b.id, b.vk_user_id, b.banned_until, b.reason, b.created_at, p.first_name, p.last_name, p.avatar_url
          FROM chat_bans b LEFT JOIN players p ON p.vk_user_id = b.vk_user_id
          WHERE b.banned_until IS NULL OR b.banned_until > now()
          ORDER BY b.created_at DESC LIMIT 100
        `);
        return json(res, 200, { items: result.rows.map(r => ({
          id: Number(r.id),
          vk_user_id: Number(r.vk_user_id),
          until: r.banned_until == null ? null : new Date(r.banned_until).getTime(),
          reason: r.reason,
          created_at: new Date(r.created_at).getTime(),
          name: [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || "Бродяга",
          avatar_url: r.avatar_url,
        })) });
      }

      // Забанить: { vk_user_id, days?, reason? } (days = 0/null → вечно)
      if (req.method === "POST" && req.url === "/api/admin/ban") {
        const body = await readBody(req);
        const targetId = Number(body.vk_user_id);
        if (!Number.isInteger(targetId) || targetId <= 0) return json(res, 400, { error: "invalid_target" });
        if (targetId === id) return json(res, 400, { error: "cannot_ban_self" });
        const days = Math.floor(Number(body.days) || 0);
        const reason = safeText(body.reason, 120);
        await pool.query(`
          INSERT INTO players (vk_user_id, first_name, last_name, state)
          VALUES ($1, '', '', '{}'::jsonb)
          ON CONFLICT (vk_user_id) DO NOTHING
        `, [targetId]);
        const bannedUntil = days > 0 ? new Date(Date.now() + days * 86400000) : null;
        await pool.query(`
          INSERT INTO chat_bans (vk_user_id, banned_until, reason, admin_id) VALUES ($1, $2, $3, $4)
        `, [targetId, bannedUntil, reason, id]);
        return json(res, 200, { ok: true, until: bannedUntil ? bannedUntil.getTime() : null });
      }

      // Разбанить
      if (req.method === "DELETE" && req.url?.startsWith("/api/admin/ban")) {
        const url = new URL(req.url, "http://localhost");
        const targetId = Number(url.searchParams.get("vk_user_id"));
        if (!Number.isInteger(targetId) || targetId <= 0) return json(res, 400, { error: "invalid_target" });
        await pool.query("DELETE FROM chat_bans WHERE vk_user_id = $1", [targetId]);
        return json(res, 200, { ok: true });
      }

      // Поиск игроков по имени/VK ID
      if (req.method === "GET" && req.url?.startsWith("/api/admin/players")) {
        const url = new URL(req.url, "http://localhost");
        const q = safeText(url.searchParams.get("q"), 40);
        if (q.length < 2) return json(res, 200, { items: [] });
        const isNum = /^\d+$/.test(q);
        const result = await pool.query(`
          SELECT vk_user_id, first_name, last_name, avatar_url, mmr, wins, losses
          FROM players
          WHERE ${isNum ? "vk_user_id::text LIKE $1" : "(first_name || ' ' || last_name) ILIKE $1"}
          ORDER BY updated_at DESC LIMIT 10
        `, [`%${q}%`]);
        return json(res, 200, { items: result.rows });
      }

      // Выдать предмет игроку (кладёт в inbox)
      if (req.method === "POST" && req.url === "/api/admin/grant") {
        const body = await readBody(req);
        const targetId = Number(body.vk_user_id);
        const item = body.item && typeof body.item === "object" ? body.item : null;
        if (!Number.isInteger(targetId) || targetId <= 0 || !item) return json(res, 400, { error: "invalid_grant" });
        if (JSON.stringify(item).length > 16 * 1024) return json(res, 400, { error: "item_too_large" });
        // Создаём строку игрока, если её ещё нет (чтобы можно было дарить по VK ID даже новичку,
        // который ещё ни разу не заходил в игру). Остальные поля — дефолты.
        await pool.query(`
          INSERT INTO players (vk_user_id, first_name, last_name, state)
          VALUES ($1, '', '', '{}'::jsonb)
          ON CONFLICT (vk_user_id) DO NOTHING
        `, [targetId]);
        await pool.query("INSERT INTO inbox (vk_user_id, item) VALUES ($1, $2::jsonb)", [targetId, JSON.stringify(item)]);
        return json(res, 200, { ok: true });
      }
    }

    return json(res, 404, { error: "not_found" });
  } catch (error) {
    const status = Number(error?.status) || (error?.message === "invalid json" ? 400 : error?.message === "payload too large" ? 413 : 500);
    console.error(`[api] ${req.method} ${req.url} → ${status}:`, error?.message || error);
    return json(res, status, { error: status === 500 ? "internal_error" : (error?.message || "bad_request") });
  }
});

server.listen(port, "127.0.0.1", () => console.log(`Abyss API listening on 127.0.0.1:${port}`));
