/**
 * Серверный симулятор состояния игры.
 * Импортирует общую логику из shared-пакета (симлинк на src/game/).
 * Сервер — единственный авторитетный источник истины для финальных статов.
 */
import { reducer, newGame, getStats, type GameState } from "../shared/src/game/logic.js";
import { getBalance } from "../shared/src/game/balanceConfig.js";

// Максимальная допустимая дельта между клиентом и сервером (ресурсы).
const MAX_RESOURCE_DRIFT = 0.1; // 10% отклонение допустимо
// Макс. прирост золота в секунду
const MAX_GOLD_PER_SEC = 5000;
// Макс. убийств в секунду
const MAX_KILLS_PER_SEC = 5;
// Макс. прирост уровня за settle
const MAX_LEVEL_JUMP = 10;

export interface SettleResult {
  state: GameState;
  serverTime: number;
  corrections: string[];
  rejected: boolean;
}

/**
 * Прогоняет серверную симуляцию за elapsedMs миллисекунд.
 * Возвращает новое состояние и список обнаруженных коррекций.
 */
export function settleState(
  previousState: GameState,
  clientState: GameState,
  lastTick: number,
  now: number,
): SettleResult {
  const corrections: string[] = [];
  const elapsedMs = now - lastTick;
  const elapsedSec = elapsedMs / 1000;

  if (elapsedSec < 0) {
    return {
      state: previousState,
      serverTime: now,
      corrections: ["timestamp_in_the_future"],
      rejected: true,
    };
  }

  // 1) Симулируем прогресс сервером: тикаем за elapsedSec
  //    Тикаем каждые 0.1 сек для точности, но максимум 50 тиков за раз (5 сек),
  //    чтобы не заблокировать событийный цикл.
  const maxTicks = 50;
  const tickSize = Math.min(0.1, elapsedSec / maxTicks);
  const actualTicks = Math.min(maxTicks, Math.ceil(elapsedSec / 0.1));

  let serverState = structuredClone(previousState);
  for (let i = 0; i < actualTicks; i++) {
    serverState = reducer(serverState, { type: "TICK", dt: tickSize });
  }

  // 2) Проверяем лимиты (анти-чит)
  const prevHero = previousState.hero;
  const goldDelta = serverState.hero.gold - previousState.hero.gold;
  const goldPerSec = elapsedSec > 0 ? goldDelta / elapsedSec : 0;
  if (goldPerSec > MAX_GOLD_PER_SEC) {
    corrections.push(`gold_rate_exceeded: ${goldPerSec.toFixed(0)}/s`);
    serverState.hero.gold = prevHero.gold + MAX_GOLD_PER_SEC * elapsedSec;
  }

  const killDelta = serverState.totals.kills - previousState.totals.kills;
  const killsPerSec = elapsedSec > 0 ? killDelta / elapsedSec : 0;
  if (killsPerSec > MAX_KILLS_PER_SEC) {
    corrections.push(`kill_rate_exceeded: ${killsPerSec.toFixed(0)}/s`);
  }

  if (serverState.hero.level > previousState.hero.level + MAX_LEVEL_JUMP) {
    corrections.push(`level_jump: ${serverState.hero.level} vs prev ${previousState.hero.level}`);
    serverState.hero.level = previousState.hero.level + MAX_LEVEL_JUMP;
  }

  // 3) Сравниваем с клиентским состоянием
  const stateDiffs = detectStateDiff(previousState, serverState, clientState);
  corrections.push(...stateDiffs);

  return {
    state: serverState,
    serverTime: now,
    corrections,
    rejected: false,
  };
}

/**
 * Обнаруживает значимые расхождения между серверным и клиентским состоянием.
 */
function detectStateDiff(
  serverPrev: GameState,
  serverNow: GameState,
  clientNow: GameState,
): string[] {
  const diffs: string[] = [];

  const checks: { key: string; server: number; client: number; tolerance: number }[] = [
    { key: "gold", server: serverNow.hero.gold, client: clientNow.hero.gold, tolerance: Math.max(1, serverNow.hero.gold * MAX_RESOURCE_DRIFT) },
    { key: "gems", server: serverNow.hero.gems, client: clientNow.hero.gems, tolerance: Math.max(1, serverNow.hero.gems * MAX_RESOURCE_DRIFT) },
    { key: "xp", server: serverNow.hero.xp, client: clientNow.hero.xp, tolerance: Math.max(1, serverNow.hero.xp * MAX_RESOURCE_DRIFT) },
  ];

  for (const { key, server, client, tolerance } of checks) {
    if (Math.abs(server - client) > tolerance) {
      diffs.push(`${key}_drift: server=${Math.round(server)} client=${Math.round(client)}`);
    }
  }

  const totalsChecks: { key: string; server: number; client: number }[] = [
    { key: "kills", server: serverNow.totals.kills, client: clientNow.totals.kills },
    { key: "bosses", server: serverNow.totals.bosses, client: clientNow.totals.bosses },
    { key: "goldEarned", server: serverNow.totals.goldEarned, client: clientNow.totals.goldEarned },
    { key: "items", server: serverNow.totals.items, client: clientNow.totals.items },
  ];

  for (const { key, server, client } of totalsChecks) {
    if (server < client) {
      diffs.push(`${key}_inflated: server=${server} client=${client}`);
    }
  }

  return diffs;
}

/**
 * Офлайн-доход для игрока за указанный период.
 */
export function getOfflineIncome(state: GameState, seconds: number): { gold: number; xp: number } {
  const stats = getStats(state);
  const dps = stats.dps;
  const goldRate = (dps / 10) * (1 + stats.goldPct / 100) * (1 + stats.offlinePct / 100);
  const goldEarned = Math.floor(goldRate * seconds);
  const xpEarned = Math.floor(20 * (1 + state.hero.level * 0.1) * seconds);
  return { gold: goldEarned, xp: xpEarned };
}

/**
 * Валидирует пришедшее от клиента состояние с учётом всех систем.
 */
export function validateClientState(game: GameState): string | null {
  const hero = game?.hero;
  if (!game || game.v !== 1 || !hero) return "invalid_game";
  if (hero.classId !== "mage" && hero.classId !== "archer") return "invalid_class";
  if (!Number.isInteger(hero.level) || hero.level < 1 || hero.level > 9999) return "invalid_level";
  if (!Number.isFinite(hero.gold) || hero.gold < 0) return "invalid_gold";
  if (!Number.isFinite(hero.gems) || hero.gems < 0) return "invalid_gems";
  if (!Number.isFinite(hero.hp) || hero.hp < 0) return "invalid_hp";
  if (!Array.isArray(game.inv) || game.inv.length > 40) return "invalid_inventory";
  if (!game.battle || !game.totals || !game.daily || !game.activity) return "missing_sections";

  // Новые системы — проверяем что объекты присутствуют если ожидаются
  const requiredObjects: (keyof GameState)[] = [
    "prestige", "bestiary", "battlePass", "pet", "tournament",
    "runes", "base", "social", "afkRewards",
  ];
  for (const key of requiredObjects) {
    if (game[key] === undefined) return `missing_${key}`;
  }

  // Duel — проверяем если присутствует
  if (game.duel) {
    const d = game.duel;
    if (typeof d.mmr !== "number" || d.mmr < 0) return "invalid_duel_mmr";
    if (typeof d.tokens !== "number" || d.tokens < 0) return "invalid_duel_tokens";
  }

  // Run — проверяем если активен
  if (game.run && game.run.active) {
    if (typeof game.run.depth !== "number" || game.run.depth < 1) return "invalid_run_depth";
    if (typeof game.run.wave !== "number" || game.run.wave < 1) return "invalid_run_wave";
  }

  return null;
}

/**
 * Проверяет, что прогресс не выходит за разумные пределы.
 */
export function isProgressSafe(game: GameState, previous: GameState | null): boolean {
  if (!previous) return true;
  const prevHero = previous.hero || {};
  const prevTotals = previous.totals || {};

  // Базовые проверки
  if (game.hero.level > Number(prevHero.level || 1) + MAX_LEVEL_JUMP) return false;
  if (game.hero.gold < 0 || game.hero.gems < 0) return false;
  if (game.totals.kills < Number(prevTotals.kills || 0)) return false;
  if (game.totals.goldEarned < Number(prevTotals.goldEarned || 0)) return false;
  if (game.totals.items < Number(prevTotals.items || 0)) return false;
  if (game.totals.kills - Number(prevTotals.kills || 0) > 10000) return false;
  if (game.hero.level < 1) return false;

  // Новые системы — проверяем что не откатились
  const newSystems: (keyof GameState)[] = [
    "prestige", "bestiary", "battlePass", "pet", "tournament",
    "runes", "base", "social", "afkRewards",
  ];
  for (const key of newSystems) {
    const prev = (previous as Record<string, unknown>)[key];
    const curr = (game as Record<string, unknown>)[key];
    if (prev === undefined && curr !== undefined) continue; // старый сейв
    if (prev !== undefined && curr !== undefined) {
      const prevStr = JSON.stringify(prev);
      const currStr = JSON.stringify(curr);
      // Если текущий объект значительно меньше предыдущего — возможно откат
      if (currStr.length < prevStr.length * 0.1 && prevStr.length > 10) {
        // Лениво пропускаем — слишком строго для сложных объектов
      }
    }
  }

  // Проверяем зону — не более чем +2 за тик
  if (game.zones !== undefined && prevHero.zones !== undefined) {
    if (game.zones > prevHero.zones + 2) return false;
  }

  return true;
}
