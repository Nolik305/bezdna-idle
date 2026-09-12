import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import bridge from "@vkontakte/vk-bridge";
import type { ClassId, GameState, Item, PartyBotProfile } from "../game/types";

export interface VkUser {
  id: number;
  first_name: string;
  last_name: string;
  photo_100?: string;
  photo_200?: string;
}

export interface VkFriend extends VkUser {
  online?: number;
}

export interface VkLeaderboardItem {
  vk_user_id: number;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  mmr: number;
  wins: number;
  losses: number;
}

export interface VkServerProfile {
  classId: ClassId;
  level: number;
  power: number;
}

export interface RewardGrant {
  gold: number;
  xp: number;
}

export interface ActivityClaimResult {
  state: GameState | null;
  revision?: number;
  error?: string;
}

export interface DuelOpponent {
  id: number;
  name: string;
  classId: ClassId;
  level: number;
  power: number;
  mmr: number;
  wins: number;
  losses: number;
}

export interface DuelResultReport {
  delta: number;
  mmr: number;
  opponent_mmr: number;
}

export type CloudStatus = "offline" | "syncing" | "saved" | "error";

// Кастомный контент, созданный админом. Может быть отдельным предметом ('item')
// или целым сетом ('set'). Поля data — в терминах типов игры (Item / SetDef).
export interface AdminContent {
  id: string;
  kind: "item" | "set";
  name: string;
  data: Record<string, unknown>;
  drop_chance: number; // 0..100, шанс выпасть в пуле дропа
  enabled: boolean;
  updated_at?: string;
}

interface VkContextValue {
  ready: boolean;
  inVk: boolean;
  launchParams: string;
  user: VkUser | null;
  friends: VkFriend[];
  serverMmr: number | null;
  serverProfile: VkServerProfile | null;
  leaderboard: VkLeaderboardItem[];
  cloudStatus: CloudStatus;
  cloudDetail: string;
  diag: string;
  initStage: string;
  showRewardedAd: (rewardKind: string) => Promise<RewardGrant | null>;
  syncProfile: (profile: { classId: ClassId; level: number; power: number }) => Promise<void>;
  loadGameState: () => Promise<{ ok: boolean; state: GameState | null; revision?: number }>;
  saveGameState: (state: GameState) => Promise<boolean>;
  claimActivity: () => Promise<ActivityClaimResult>;
  getPartyBots: (tier: number) => Promise<PartyBotProfile[]>;
  getDuelOpponent: (mmr: number) => Promise<DuelOpponent | null>;
  reportDuelResult: (opponentId: number, win: boolean) => Promise<DuelResultReport | null>;
  share: (text: string) => Promise<void>;
  isAdmin: boolean;
  fetchCustomItems: () => Promise<AdminContent[]>;
  fetchInbox: () => Promise<Item[]>;
  claimInbox: () => Promise<Item[]>;
  fetchBalance: () => Promise<Record<string, unknown> | null>; // публичный конфиг баланса
  adminGetBalance: () => Promise<Record<string, unknown> | null>;
  adminSaveBalance: (config: Record<string, unknown>) => Promise<boolean>;
  fetchChatMessages: () => Promise<ChatMessage[]>;
  sendChatMessage: (text: string) => Promise<ChatSendResult>;
  deleteChatMessage: (id: number) => Promise<boolean>;
  // Гильдии
  guildMine: () => Promise<GuildInfo | null>;
  guildSearch: (q: string) => Promise<GuildSummary[]>;
  guildCreate: (name: string, tag: string) => Promise<{ ok: boolean; error?: string }>;
  guildJoin: (guildId: number) => Promise<{ ok: boolean; error?: string }>;
  guildLeave: () => Promise<{ ok: boolean; disbanded?: boolean }>;
  guildProgress: (kills: number, gold: number) => Promise<boolean>;
  guildGoalSet: (goalKey: "kills" | "gold", target: number) => Promise<boolean>;
  guildGoalClaim: () => Promise<{ ok: boolean; gold?: number; gems?: number; error?: string }>;
  fetchGuildChat: () => Promise<ChatMessage[]>;
  sendGuildChat: (text: string) => Promise<ChatMessage | null>;
  deleteGuildChatMessage: (id: number) => Promise<boolean>;
  // Дуэли: сезон и награды
  duelSeasonCheck: () => Promise<{ seasonChanged: boolean; reward?: { rank: string; gold: number; gems: number } | null; mmr: number; season: string; best: number } | null>;
  duelRankReward: () => Promise<{ ok: boolean; rank?: string; gold?: number; gems?: number; error?: string } | null>;
  // Админ: баны в чате
  adminListBans: () => Promise<ChatBan[]>;
  adminBanUser: (vk_user_id: number, days: number, reason?: string) => Promise<boolean>;
  adminUnbanUser: (vk_user_id: number) => Promise<boolean>;
}

export interface ChatBan {
  id: number;
  vk_user_id: number;
  until: number | null;
  reason: string;
  created_at: number;
  name: string;
  avatar_url: string | null;
}

export interface ChatMessage {
  id: number;
  userId: number;
  userName: string;
  text: string;
  ts: number;
  me: boolean;
  admin: boolean;
}

export interface ChatSendResult {
  ok: boolean;
  msg?: ChatMessage;
  error?: string;
  bannedUntil?: number | null;
}

export interface GuildMember {
  vk_user_id: number;
  name: string;
  avatar_url: string | null;
  role: "owner" | "officer" | "member";
  level: number;
}

export interface GuildInfo {
  id: number;
  name: string;
  tag: string;
  ownerId: number;
  xp: number;
  level: number;
  goalKey: "kills" | "gold";
  goalValue: number;
  goalTarget: number;
  goalClaimed: boolean;
  myRole: "owner" | "officer" | "member";
  members: GuildMember[];
}

export interface GuildSummary {
  id: number;
  name: string;
  tag: string;
  level: number;
  members: number;
  goalKey: "kills" | "gold";
}

const VkContext = createContext<VkContextValue | null>(null);
// Единая точка конфигурации API-URL (и для серверных вызовов, и для отображения в UI).
export const API_URL = import.meta.env.VITE_API_URL || "https://135.106.211.85.nip.io";

// VK передаёт launch-параметры в URL: #vk_app_id=...&vk_user_id=...&sign=...
// (в части webview — в query-string, в нативном клиенте — во фрагменте). VKWebAppGetLaunchParams
// в части webview возвращает пусто, поэтому берём их из URL как резерв.
function launchParamsFromUrl(): string {
  if (typeof window === "undefined") return "";
  const search = window.location.search.replace(/^\?/, "");
  if (/vk_app_id=/.test(search) && /(?:^|&)sign=/.test(search)) return search;
  const hash = window.location.hash.replace(/^#/, "");
  return /vk_app_id=/.test(hash) && /(?:^|&)sign=/.test(hash) ? hash : "";
}

function normalizeLaunchParams(value: unknown): string {
  if (typeof value === "string") {
    const raw = value.replace(/^[?#]/, "");
    return /vk_app_id=/.test(raw) && /(?:^|&)sign=/.test(raw) ? raw : "";
  }

  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (record.data && typeof record.data === "object") {
    const nested = normalizeLaunchParams(record.data);
    if (nested) return nested;
  }
  if (record.response && typeof record.response === "object") {
    const nested = normalizeLaunchParams(record.response);
    if (nested) return nested;
  }
  const params = new URLSearchParams();
  for (const [key, item] of Object.entries(record)) {
    if (item !== undefined && item !== null) params.set(key, String(item));
  }
  const raw = params.toString();
  return /vk_app_id=/.test(raw) && /(?:^|&)sign=/.test(raw) ? raw : "";
}

function launchResponseShape(value: unknown): string {
  if (value == null) return "пустой ответ";
  if (typeof value === "string") return `строка (${value.length} симв.)`;
  if (typeof value !== "object") return typeof value;
  const record = value as Record<string, unknown>;
  const nested = record.data && typeof record.data === "object" ? record.data as Record<string, unknown> : null;
  const keys = Object.keys(nested ?? record).slice(0, 8);
  return `объект: ${keys.join(", ") || "без ключей"}`;
}

// Не даёт зависшему promise (сеть без ответа) заблокировать игру навсегда.
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export function VkProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [inVk, setInVk] = useState(false);
  const [user, setUser] = useState<VkUser | null>(null);
  const [friends, setFriends] = useState<VkFriend[]>([]);
  const [serverMmr, setServerMmr] = useState<number | null>(null);
  const [serverProfile, setServerProfile] = useState<VkServerProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<VkLeaderboardItem[]>([]);
  const [launchParams, setLaunchParams] = useState("");
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("offline");
  const [cloudDetail, setCloudDetail] = useState("");
  const [diag, setDiag] = useState("");
  const [initStage, setInitStage] = useState("Запуск приложения…");
  const stateRevision = useRef(0);
  const saveQueue = useRef<{ state: GameState; waiters: Array<(saved: boolean) => void> } | null>(null);
  const saveRunning = useRef(false);
  // VK ID админа (владельца) — доступ к админке. Открыт только ему.
  const ADMIN_VK_ID = Number(import.meta.env.VITE_ADMIN_VK_ID || 835693694);
  const isAdmin = Boolean(user && user.id === ADMIN_VK_ID);

  useEffect(() => {
    let cancelled = false;
    // Гарантированно снимаем заставку, даже если какой-то запрос завис навсегда.
    const failSafe = window.setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 6000);

    const init = async () => {
      let isVk = false;
      let profile: VkUser | null = null;
      let earlyLaunchParams = "";
      const earlyLaunchListener = (event: { detail?: { type?: string; data?: unknown } }) => {
        if (event?.detail?.type !== "VKWebAppGetLaunchParamsResult") return;
        const normalized = normalizeLaunchParams(event.detail.data);
        if (normalized) earlyLaunchParams = normalized;
      };
      bridge.subscribe(earlyLaunchListener);
      setInitStage("Проверяем VK WebView…");
      try {
        // VKWebAppInit не должен блокировать облако: если bridge молчит (бывает в
        // нативном клиенте VK), launch-параметры всё равно приходят во фрагменте URL.
        try {
          await withTimeout(bridge.send("VKWebAppInit"), 5000);
          isVk = true;
          setInitStage("VK WebView подключён, проверяем контекст Mini App…");
        } catch {
          isVk = false;
          setInitStage("VK WebView не ответил, пробуем резервный способ…");
        }
        if (cancelled) return;
        if (isVk) setInVk(true);
        // Запрашиваем launch-параметры сразу после VKWebAppInit. На мобильном
        // bridge поздний запрос после профиля/друзей иногда возвращает пустой ответ.
        if (!earlyLaunchParams) {
          try {
            const response = await withTimeout(bridge.send("VKWebAppGetLaunchParams"), 3000).catch(() => null);
            earlyLaunchParams = normalizeLaunchParams(response);
          } catch { /* повторим ниже после подготовки авторизации */ }
        }
        await withTimeout(
          bridge.send("VKWebAppSetViewSettings", {
            status_bar_style: "light",
            action_bar_color: "#0b0e13",
          }).catch(() => undefined),
          2000
        );

        profile = await withTimeout(
          bridge.send("VKWebAppGetUserInfo").catch(() => null) as Promise<VkUser | null>,
          3000
        ).catch(() => null);
        setInitStage(profile?.id ? "Профиль VK получен" : "Профиль VK не получен");
        if (cancelled) return;
        if (profile?.id) setUser(profile);

        // Launch-параметры: в нативном клиенте VK они приходят ТОЛЬКО через bridge
        // (не в URL). ВАЖНО: получаем их через bridge независимо от isVk, потому что
        // в нативном клиенте VKWebAppInit может виснуть (isVk=false), но мост при этом
        // рабочий и VKWebAppGetLaunchParams отвечает. Опора на isVk приводила к тому,
        // что облако на телефоне просто не включалось (нет launch-параметров).
        // Авторизация и загрузка лидерборда — отдельной функцией, чтобы вызывать её и
        // из прямого пути (launchParams из URL/send), и из события (параметры пришли
        // асинхронно как VKWebAppGetLaunchParamsResult).
        let authDone = false;
        let authInFlight = "";
        const checkApiHealth = async () => {
          try {
            const response = await withTimeout(fetch(`${API_URL}/health`, { cache: "no-store" }), 5000);
            if (!response.ok) {
              setInitStage(`API отвечает с ошибкой HTTP ${response.status}`);
              return false;
            }
            return true;
          } catch (error) {
            const message = error instanceof Error ? error.message : "ошибка сети";
            setInitStage(`API недоступен: ${message}`);
            return false;
          }
        };
        const authorize = async (lp: string) => {
          if (cancelled || authDone || authInFlight === lp) return;
          authInFlight = lp;
          if (!await checkApiHealth()) {
            authInFlight = "";
            setCloudStatus("error");
            setCloudDetail("проверка /health не пройдена");
            return;
          }
          const authResponse = await withTimeout(fetch(`${API_URL}/api/auth/vk`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-vk-launch-params": lp },
            body: JSON.stringify({
              first_name: profile?.first_name ?? "",
              last_name: profile?.last_name ?? "",
              avatar_url: profile?.photo_200 ?? profile?.photo_100 ?? null,
            }),
          }), 8000).catch(() => null);
          if (authResponse?.ok) {
            authDone = true;
            const account = await authResponse.json() as { mmr?: number; state?: { profile?: VkServerProfile } };
            if (typeof account.mmr === "number") setServerMmr(account.mmr);
            if (account.state?.profile) setServerProfile(account.state.profile);
            const leaderboardResponse = await withTimeout(fetch(`${API_URL}/api/leaderboard`, {
              headers: { "x-vk-launch-params": lp },
            }), 6000).catch(() => null);
            if (leaderboardResponse?.ok) {
              const result = await leaderboardResponse.json() as { items?: VkLeaderboardItem[] };
              if (!cancelled) setLeaderboard(result.items ?? []);
            }
          } else if (!cancelled) {
            authInFlight = "";
            if (authResponse) {
              const errorBody = await authResponse.json().catch(() => null) as { error?: string } | null;
              setInitStage(`API отклонил авторизацию: HTTP ${authResponse.status}${errorBody?.error ? ` (${errorBody.error})` : ""}`);
            } else {
              setInitStage("API /health работает, но запрос авторизации не завершился");
            }
            setCloudStatus("error");
            setCloudDetail(authResponse ? `авторизация HTTP ${authResponse.status}` : "таймаут авторизации");
          }
        };

        // Launch-параметры: в нативном клиенте VK они приходят ТОЛЬКО через bridge
        // (не в URL). ВАЖНО: получаем их через bridge независимо от isVk, потому что
        // в нативном клиенте VKWebAppInit может виснуть (isVk=false), но мост при этом
        // рабочий и VKWebAppGetLaunchParams отвечает. Опора на isVk приводила к тому,
        // что облако на телефоне просто не включалось (нет launch-параметров).
        let launchParams = launchParamsFromUrl() || earlyLaunchParams; // URL или раннее событие bridge
        let launchResponseDetail = "";
        setInitStage(launchParams ? "Параметры запуска найдены в URL" : "Запрашиваем параметры запуска VK…");
        if (!launchParams) {
          // Подписываемся до запроса: в мобильном VK ответ иногда приходит событием
          // раньше, чем возвращается promise от bridge.send.
          const listener = (event: { detail?: { type?: string; data?: unknown } }) => {
            const t = event?.detail?.type;
            const data = event?.detail?.data;
            if (t === "VKWebAppGetLaunchParamsResult" && data) {
              const lp = normalizeLaunchParams(data);
              if (lp && !cancelled) {
                setInVk(true);
                setLaunchParams(lp);
                void authorize(lp);
              }
            }
          };
          bridge.subscribe(listener);

          // Пробуем получить параметры независимо от результата VKWebAppInit.
          // Иначе зависший init ошибочно переводит мобильное приложение в offline.
          for (let i = 0; i < 3 && !launchParams; i++) {
            try {
              const response = await withTimeout(bridge.send("VKWebAppGetLaunchParams"), 3000).catch(() => null);
              launchParams = normalizeLaunchParams(response);
              if (!launchParams && response && !cancelled) {
                launchResponseDetail = `VK ответил без подписанных параметров (${launchResponseShape(response)})`;
                setInitStage(launchResponseDetail);
              }
            } catch { /* retry */ }
          }
          bridge.unsubscribe(listener);
        }
        if (launchParams) setInitStage("Проверяем соединение с сервером…");
        else if (!launchResponseDetail) setInitStage("VK не передал параметры запуска");
        // Не затираем значение, уже установленное событием: setLaunchParams вызываем
        // только если у нас есть непустые параметры (из URL или из прямого send).
        if (!cancelled && launchParams) {
          // Не отключаем облако, если VKWebAppInit завершился таймаутом:
          // launch-параметры позволяют безопасно авторизовать API напрямую.
          setInVk(true);
          setLaunchParams(launchParams);
        }
        if (!launchParams && isVk) {
          setCloudStatus("error");
          setCloudDetail("нет launch-параметров VK");
        }
        if (launchParams) await authorize(launchParams);
        if (authDone) setInitStage("Сервер подключён");
        if (!cancelled) {
          const bridgeStatus = (() => {
            try {
              return `wv=${!!bridge.isWebView?.()} emb=${!!bridge.isEmbedded?.()} url=${launchParamsFromUrl().length > 0}`;
            } catch { return "wv=err"; }
          })();
          setDiag(`isVk=${isVk} lp=${launchParams.length} ${bridgeStatus} host=${window.location.hostname}`);
        }
      } catch {
        // Standalone web preview has no VK bridge and remains usable.
      } finally {
        bridge.unsubscribe(earlyLaunchListener);
        window.clearTimeout(failSafe);
        if (!cancelled) setReady(true);
      }
    };
    void init();
    return () => { cancelled = true; window.clearTimeout(failSafe); };
  }, []);

  const share = async (text: string) => {
    if (navigator.share) await navigator.share({ title: "Бездна Idle", text }).catch(() => undefined);
  };

  const showRewardedAd = async (rewardKind: string): Promise<RewardGrant | null> => {
    if (!inVk || !launchParams) return null;
    const result = await bridge.send("VKWebAppShowNativeAds", { ad_format: "reward" }).catch(() => null);
    if (!result) return null;
    const eventId = crypto.randomUUID();
    const claim = await fetch(`${API_URL}/api/rewards/claim`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-vk-launch-params": launchParams },
      body: JSON.stringify({ event_id: eventId, reward_kind: rewardKind }),
    }).catch(() => null);
    if (!claim?.ok) return null;
    const payload = await claim.json().catch(() => null) as { granted?: boolean; reward?: RewardGrant | null } | null;
    return payload?.granted && payload.reward ? payload.reward : null;
  };

  const syncProfile = async (profile: { classId: ClassId; level: number; power: number }) => {
    if (!inVk || !launchParams) return;
    const response = await fetch(`${API_URL}/api/profile/sync`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-vk-launch-params": launchParams },
      body: JSON.stringify({ class_id: profile.classId, level: profile.level, power: profile.power }),
    }).catch(() => null);
    if (response?.ok) {
      const payload = await response.json().catch(() => null) as { profile?: VkServerProfile } | null;
      if (payload?.profile) setServerProfile(payload.profile);
    }
  };

  const getPartyBots = async (tier: number): Promise<PartyBotProfile[]> => {
    if (!inVk || !launchParams) return [];
    const response = await withTimeout(fetch(`${API_URL}/api/party/bots?tier=${encodeURIComponent(tier)}`, {
      headers: { "x-vk-launch-params": launchParams },
    }), 8000).catch(() => null);
    if (!response?.ok) return [];
    const payload = await response.json().catch(() => null) as { bots?: PartyBotProfile[] } | null;
    return payload?.bots ?? [];
  };

  const loadGameState = async (): Promise<{ ok: boolean; state: GameState | null; revision?: number }> => {
    if (!inVk || !launchParams) return { ok: false, state: null };
    const response = await withTimeout(fetch(`${API_URL}/api/state`, {
      headers: { "x-vk-launch-params": launchParams },
    }), 8000).catch(() => null);
    if (!response?.ok) return { ok: false, state: null };
    const payload = await response.json().catch(() => null) as { state?: GameState | null; revision?: number } | null;
    stateRevision.current = Number.isSafeInteger(payload?.revision) ? Number(payload?.revision) : 0;
    return { ok: true, state: payload?.state ?? null, revision: stateRevision.current };
  };

  const performSave = async (state: GameState): Promise<boolean> => {
    if (!inVk || !launchParams) return false;
    setCloudStatus("syncing");
    setCloudDetail("Сохранение…");
    const stamped = { ...state, meta: { ...(state.meta || {}), savedAt: Date.now() } };
    const response = await withTimeout(fetch(`${API_URL}/api/state`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-vk-launch-params": launchParams },
      body: JSON.stringify({ state: stamped, baseRevision: stateRevision.current }),
    }), 8000).catch(() => null);
    if (response?.ok) {
      const payload = await response.json().catch(() => null) as { revision?: number } | null;
      const revision = payload?.revision;
      if (!Number.isSafeInteger(revision)) {
        setCloudStatus("error");
        setCloudDetail("Сервер не вернул ревизию сейва");
        return false;
      }
      stateRevision.current = Number(revision);
      setCloudStatus("saved");
      setCloudDetail("Сохранено ✓");
    } else {
      setCloudStatus("error");
      const reason = response?.status === 409 ? "конфликт версии — загрузите игру заново" : response ? `HTTP ${response.status}` : "нет соединения";
      setCloudDetail(`Не сохранено (${reason})`);
    }
    return Boolean(response?.ok);
  };

  // Сохраняем только последний актуальный снимок: фоновые таймеры не должны
  // ставить в очередь устаревшие состояния и откатывать прогресс.
  const saveGameState = (state: GameState): Promise<boolean> => {
    const promise = new Promise<boolean>(resolve => {
      if (saveQueue.current) {
        saveQueue.current.state = state;
        saveQueue.current.waiters.push(resolve);
      } else {
        saveQueue.current = { state, waiters: [resolve] };
      }
    });
    if (!saveRunning.current) {
      saveRunning.current = true;
      void (async () => {
        while (saveQueue.current) {
          const batch = saveQueue.current;
          saveQueue.current = null;
          const saved = await performSave(batch.state);
          batch.waiters.forEach(resolve => resolve(saved));
        }
        saveRunning.current = false;
      })();
    }
    return promise;
  };

  const claimActivity = async (): Promise<ActivityClaimResult> => {
    if (!inVk || !launchParams) return { state: null, error: "vk_unavailable" };
    const response = await withTimeout(fetch(`${API_URL}/api/activity/claim`, {
      method: "POST",
      headers: { "x-vk-launch-params": launchParams },
    }), 8000).catch(() => null);
    if (!response) return { state: null, error: "network_error" };
    const payload = await response.json().catch(() => null) as { state?: GameState; revision?: number; error?: string } | null;
    if (!response.ok) return { state: null, error: payload?.error || "claim_failed" };
    const revision = payload?.revision;
    if (Number.isSafeInteger(revision)) stateRevision.current = Number(revision);
    return { state: payload?.state ?? null, revision };
  };

  const getDuelOpponent = async (mmr: number): Promise<DuelOpponent | null> => {
    if (!inVk || !launchParams) return null;
    const response = await withTimeout(fetch(`${API_URL}/api/duel/opponent?mmr=${encodeURIComponent(mmr)}`, {
      headers: { "x-vk-launch-params": launchParams },
    }), 7000).catch(() => null);
    if (!response?.ok) return null;
    const payload = await response.json().catch(() => null) as { opponent?: DuelOpponent | null } | null;
    return payload?.opponent ?? null;
  };

  const reportDuelResult = async (opponentId: number, win: boolean): Promise<DuelResultReport | null> => {
    if (!inVk || !launchParams) return null;
    const response = await withTimeout(fetch(`${API_URL}/api/duel/result`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-vk-launch-params": launchParams },
      body: JSON.stringify({ opponent_id: opponentId, win }),
    }), 8000).catch(() => null);
    if (!response?.ok) return null;
    const payload = await response.json().catch(() => null) as DuelResultReport | null;
    return payload;
  };

  // Публичный кастомный контент (для пула дропа игры)
  const fetchCustomItems = async (): Promise<AdminContent[]> => {
    const response = await withTimeout(fetch(`${API_URL}/api/custom/items`), 8000).catch(() => null);
    if (!response?.ok) return [];
    const payload = await response.json().catch(() => null) as { items?: AdminContent[] } | null;
    return payload?.items ?? [];
  };

  // Выданные игроку предметы
  const fetchInbox = async (): Promise<Item[]> => {
    if (!inVk || !launchParams) return [];
    const response = await withTimeout(fetch(`${API_URL}/api/inbox`, {
      headers: { "x-vk-launch-params": launchParams },
    }), 8000).catch(() => null);
    if (!response?.ok) return [];
    const payload = await response.json().catch(() => null) as { items?: Item[] } | null;
    return payload?.items ?? [];
  };

  const claimInbox = async (): Promise<Item[]> => {
    if (!inVk || !launchParams) return [];
    const response = await withTimeout(fetch(`${API_URL}/api/inbox/claim`, {
      method: "POST",
      headers: { "x-vk-launch-params": launchParams },
    }), 8000).catch(() => null);
    if (!response?.ok) return [];
    const payload = await response.json().catch(() => null) as { items?: Item[] } | null;
    return payload?.items ?? [];
  };

  // Публичный конфиг баланса (клиент качает при старте)
  const fetchBalance = async (): Promise<Record<string, unknown> | null> => {
    const response = await withTimeout(fetch(`${API_URL}/api/balance`), 8000).catch(() => null);
    if (!response?.ok) return null;
    const payload = await response.json().catch(() => null) as { config?: Record<string, unknown> } | null;
    return payload?.config ?? null;
  };

  const adminGetBalance = async (): Promise<Record<string, unknown> | null> => {
    if (!isAdmin || !launchParams) return null;
    const response = await withTimeout(fetch(`${API_URL}/api/admin/balance`, {
      headers: { "x-vk-launch-params": launchParams },
    }), 8000).catch(() => null);
    if (!response?.ok) return null;
    const payload = await response.json().catch(() => null) as { config?: Record<string, unknown> } | null;
    return payload?.config ?? null;
  };

  const adminSaveBalance = async (config: Record<string, unknown>): Promise<boolean> => {
    if (!isAdmin || !launchParams) return false;
    const response = await withTimeout(fetch(`${API_URL}/api/admin/balance`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-vk-launch-params": launchParams },
      body: JSON.stringify({ config }),
    }), 8000).catch(() => null);
    return Boolean(response?.ok);
  };

  // ---- Чат ----
  const fetchChatMessages = async (): Promise<ChatMessage[]> => {
    if (!launchParams) return [];
    const response = await withTimeout(fetch(`${API_URL}/api/chat/messages`, {
      headers: { "x-vk-launch-params": launchParams },
    }), 8000).catch(() => null);
    if (!response?.ok) return [];
    const payload = await response.json().catch(() => null) as { messages?: ChatMessage[] } | null;
    return payload?.messages ?? [];
  };

  const sendChatMessage = async (text: string): Promise<ChatSendResult> => {
    if (!launchParams) return { ok: false, error: "offline" };
    const response = await withTimeout(fetch(`${API_URL}/api/chat/send`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-vk-launch-params": launchParams },
      body: JSON.stringify({ text }),
    }), 8000).catch(() => null);
    if (!response?.ok) {
      const payload = await response?.json().catch(() => null) as { error?: string; until?: number | null } | null;
      return { ok: false, error: payload?.error ?? "error", bannedUntil: payload?.until ?? null };
    }
    const payload = await response.json().catch(() => null) as ChatMessage | null;
    return payload?.id ? { ok: true, msg: payload } : { ok: false, error: "error" };
  };

  const deleteChatMessage = async (id: number): Promise<boolean> => {
    if (!launchParams) return false;
    const response = await withTimeout(fetch(`${API_URL}/api/chat/message?id=${id}`, {
      method: "DELETE",
      headers: { "x-vk-launch-params": launchParams },
    }), 8000).catch(() => null);
    return Boolean(response?.ok);
  };

  // ---- Гильдии ----
  const guildReq = async (path: string, init?: RequestInit): Promise<Response | null> => {
    if (!inVk || !launchParams) return null;
    return withTimeout(fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "content-type": "application/json", "x-vk-launch-params": launchParams, ...(init?.headers ?? {}) },
    }), 8000).catch(() => null);
  };

  const guildMine = async (): Promise<GuildInfo | null> => {
    const response = await guildReq("/api/guild/mine");
    if (!response?.ok) return null;
    const payload = await response.json().catch(() => null) as { guild?: GuildInfo | null } | null;
    return payload?.guild ?? null;
  };

  const guildSearch = async (q: string): Promise<GuildSummary[]> => {
    const response = await guildReq(`/api/guild/search?q=${encodeURIComponent(q)}`);
    if (!response?.ok) return [];
    const payload = await response.json().catch(() => null) as { items?: GuildSummary[] } | null;
    return payload?.items ?? [];
  };

  const guildCreate = async (name: string, tag: string): Promise<{ ok: boolean; error?: string }> => {
    const response = await guildReq("/api/guild/create", { method: "POST", body: JSON.stringify({ name, tag }) });
    if (!response?.ok) { const p = await response?.json().catch(() => null) as { error?: string } | null; return { ok: false, error: p?.error }; }
    return { ok: true };
  };

  const guildJoin = async (guildId: number): Promise<{ ok: boolean; error?: string }> => {
    const response = await guildReq("/api/guild/join", { method: "POST", body: JSON.stringify({ guildId }) });
    if (!response?.ok) { const p = await response?.json().catch(() => null) as { error?: string } | null; return { ok: false, error: p?.error }; }
    return { ok: true };
  };

  const guildLeave = async (): Promise<{ ok: boolean; disbanded?: boolean }> => {
    const response = await guildReq("/api/guild/leave", { method: "POST", body: JSON.stringify({}) });
    if (!response?.ok) return { ok: false };
    const payload = await response.json().catch(() => null) as { disbanded?: boolean } | null;
    return { ok: true, disbanded: payload?.disbanded };
  };

  const guildProgress = async (kills: number, gold: number): Promise<boolean> => {
    const response = await guildReq("/api/guild/progress", { method: "POST", body: JSON.stringify({ kills, gold, event_id: crypto.randomUUID() }) });
    return Boolean(response?.ok);
  };

  const guildGoalSet = async (goalKey: "kills" | "gold", target: number): Promise<boolean> => {
    const response = await guildReq("/api/guild/goal/set", { method: "POST", body: JSON.stringify({ goalKey, target }) });
    return Boolean(response?.ok);
  };

  const guildGoalClaim = async (): Promise<{ ok: boolean; gold?: number; gems?: number; error?: string }> => {
    const response = await guildReq("/api/guild/goal/claim", { method: "POST", body: JSON.stringify({}) });
    if (!response?.ok) { const p = await response?.json().catch(() => null) as { error?: string } | null; return { ok: false, error: p?.error }; }
    const payload = await response.json().catch(() => null) as { gold?: number; gems?: number } | null;
    return { ok: true, gold: payload?.gold, gems: payload?.gems };
  };

  const fetchGuildChat = async (): Promise<ChatMessage[]> => {
    const response = await guildReq("/api/guild/chat/messages");
    if (!response?.ok) return [];
    const payload = await response.json().catch(() => null) as { messages?: ChatMessage[] } | null;
    return payload?.messages ?? [];
  };

  const sendGuildChat = async (text: string): Promise<ChatMessage | null> => {
    const response = await guildReq("/api/guild/chat/send", { method: "POST", body: JSON.stringify({ text }) });
    if (!response?.ok) return null;
    const payload = await response.json().catch(() => null) as ChatMessage | null;
    return payload?.id ? payload : null;
  };

  const deleteGuildChatMessage = async (id: number): Promise<boolean> => {
    const response = await guildReq(`/api/guild/chat/message?id=${id}`, { method: "DELETE" });
    return Boolean(response?.ok);
  };

  // ---- Дуэли: сезон и награды ----
  const duelSeasonCheck = async () => {
    const response = await guildReq("/api/duel/season-check", { method: "POST", body: JSON.stringify({}) });
    if (!response?.ok) return null;
    return await response.json().catch(() => null) as { seasonChanged: boolean; reward?: { rank: string; gold: number; gems: number } | null; mmr: number; season: string; best: number } | null;
  };

  const duelRankReward = async () => {
    const response = await guildReq("/api/duel/rank-reward", { method: "POST", body: JSON.stringify({}) });
    if (!response?.ok) { const p = await response?.json().catch(() => null) as { error?: string } | null; return { ok: false, error: p?.error }; }
    const payload = await response.json().catch(() => null) as { rank?: string; gold?: number; gems?: number } | null;
    return { ok: true, rank: payload?.rank, gold: payload?.gold, gems: payload?.gems };
  };

  // ---- Админ: баны в чате ----
  const adminListBans = async (): Promise<ChatBan[]> => {
    const response = await guildReq("/api/admin/bans");
    if (!response?.ok) return [];
    const payload = await response.json().catch(() => null) as { items?: ChatBan[] } | null;
    return payload?.items ?? [];
  };

  const adminBanUser = async (vk_user_id: number, days: number, reason?: string): Promise<boolean> => {
    const response = await guildReq("/api/admin/ban", { method: "POST", body: JSON.stringify({ vk_user_id, days, reason }) });
    return Boolean(response?.ok);
  };

  const adminUnbanUser = async (vk_user_id: number): Promise<boolean> => {
    const response = await guildReq(`/api/admin/ban?vk_user_id=${vk_user_id}`, { method: "DELETE" });
    return Boolean(response?.ok);
  };

  return <VkContext.Provider value={{ ready, inVk, launchParams, user, friends, serverMmr, serverProfile, leaderboard, cloudStatus, cloudDetail, diag, initStage, showRewardedAd, syncProfile, loadGameState, saveGameState, claimActivity, getPartyBots, getDuelOpponent, reportDuelResult, share, isAdmin, fetchCustomItems, fetchInbox, claimInbox, fetchBalance, adminGetBalance, adminSaveBalance, fetchChatMessages, sendChatMessage, deleteChatMessage, guildMine, guildSearch, guildCreate, guildJoin, guildLeave, guildProgress, guildGoalSet, guildGoalClaim, fetchGuildChat, sendGuildChat, deleteGuildChatMessage, duelSeasonCheck, duelRankReward, adminListBans, adminBanUser, adminUnbanUser }}>{children}</VkContext.Provider>;
}

export function useVk() {
  const context = useContext(VkContext);
  if (!context) throw new Error("useVk outside VkProvider");
  return context;
}
