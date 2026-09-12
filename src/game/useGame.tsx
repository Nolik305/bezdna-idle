import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode, type Dispatch } from "react";
import type { Action, GameState, Stats } from "./types";
import { getStats, loadGame, reducer, saveGame } from "./logic";
import { registerCustomContent } from "./customContent";
import { loadBalanceConfig } from "./balanceConfig";
import { useVk } from "../platform/vk";

const Ctx = createContext<{ s: GameState; d: Dispatch<Action>; stats: Stats; cloudBooted: boolean; cloudUnreachable: boolean; playOffline: () => void } | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [s, d] = useReducer(reducer, null, () => loadGame());
  const { inVk, launchParams, syncProfile, loadGameState, saveGameState, fetchCustomItems, claimInbox, fetchBalance, guildMine, guildProgress } = useVk();
  const ref = useRef(s);
  // cloudBooted=true — облачный сейв либо загружен, либо подтверждено его отсутствие,
  // либо облако молчит после всех попыток. Пока false — показываем загрузку, чтобы не
  // мелькал попап «нового персонажа» до того, как пришёл реальный сейв с сервера.
  const [cloudBooted, setCloudBooted] = useState(!inVk);
  // cloudUnreachable=true — облако молчит (сеть/лимит), но игрок может нажать
  // «Играть офлайн» и не ждать все попытки. Показывает кнопку на экране загрузки.
  const [cloudUnreachable, setCloudUnreachable] = useState(false);
  // playOffline — немедленный выход в офлайн по кнопке пользователя, не трогая облако.
  const playOffline = useMemo(() => () => {
    cloudReady.current = false;
    setCloudBooted(true);
  }, []);
  const cloudReady = useRef(!inVk);
  const guildReport = useRef({ kills: 0, gold: 0, lastSent: 0, inGuild: false });
  const lastTotals = useRef({ kills: 0, gold: 0 });
  ref.current = s;

  // Ключевые моменты — трата ресурсов / получение наград / изменение инвентаря / сброс.
  // При таких действиях пушем состояние в облако почти сразу (с дедупликацией), чтобы
  // не потерять важный прогресс, даже если приложение убьют через секунду. Обычный
  // фарм (TICK) по-прежнему сохраняется по таймеру.
  const KEY_SYNC_ACTIONS = new Set<string>([
    "CHOOSE_CLASS", "BUY_SHOP", "LEVEL_SKILL", "LEVEL_PASSIVE",
    "CLAIM_QUEST", "CLAIM_DAILY", "CLAIM_WEEKLY", "CLAIM_ACH", "CLAIM_ACTIVITY",
    "CLAIM_SEASON_TIER", "CLAIM_AD_OFFLINE", "CLAIM_AD",
    "UPGRADE_SLOT", "BUY_VIP", "BUY_META", "BUY_GODSTONE", "UP_GODSTONE",
    "DUEL_RANK_CLAIM", "CRAFT", "CRAFT_SLOT", "RESET",
    "EQUIP", "UNEQUIP", "SELL", "SELL_JUNK", "SUMMON_BOSS", "START_RUN", "RUN_PICK",
  ]);
  const keySyncTimer = useRef<number | null>(null);
  const flushKey = (force: boolean) => {
    if (keySyncTimer.current) { clearTimeout(keySyncTimer.current); keySyncTimer.current = null; }
    const doPush = () => {
      saveGame(ref.current);
      if (inVk && cloudReady.current) void saveGameState(ref.current);
    };
    if (force) doPush();
    else keySyncTimer.current = window.setTimeout(doPush, 1200);
  };
  const dKey = (a: Action) => {
    d(a);
    if (KEY_SYNC_ACTIONS.has(a.type)) flushKey(false);
  };
  void flushKey; // ref-стабильная функция

  useEffect(() => {
    let cancelled = false;
    const cleanup = () => { cancelled = true; };
    // Загружаем кастомный контент (сеты/предметы из админки) и выдаём inbox.
    void fetchCustomItems().then(registerCustomContent);
    // Загружаем серверный конфиг баланса (редкость/шансы/пулы дропа).
    void fetchBalance().then(cfg => loadBalanceConfig(cfg));
    void claimInbox().then(items => { if (items.length) d({ type: "INBOX_ADD", items }); });
    let last = performance.now();
    const loop = setInterval(() => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.5);
      last = now;
      d({ type: "TICK", dt });
    }, 100);
    const saver = setInterval(() => {
      saveGame(ref.current);
      if (inVk && cloudReady.current) void saveGameState(ref.current);
    }, inVk ? 15_000 : 4_000);
    const onHide = () => {
      saveGame(ref.current);
      if (inVk && cloudReady.current) void saveGameState(ref.current);
    };
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      cleanup();
      clearInterval(loop);
      clearInterval(saver);
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [inVk]);

  // Облачная загрузка: отдельно от игрового цикла, чтобы перезапускаться, когда
  // launch-параметры VK приходят асинхронно (в нативном клиенте — с задержкой).
  // Без launch-параметров авторизация невозможна, поэтому не тянем 60 секунд:
  // быстро выходим в игру офлайн, а когда параметры появятся — подгружаем облако.
  useEffect(() => {
    if (!inVk) return;
    let cancelled = false;
    const loadCloud = async (attempt = 0) => {
      const res = await loadGameState();
      if (cancelled) return;
      if (res.ok) {
        if (res.state?.v === 1 && res.state.hero && res.state.battle) {
          const cloud = res.state;
          const local = ref.current;
          // Сравниваем время последнего сохранения (meta.savedAt): оно пишется при
          // каждом saveGame (localStorage) и saveGameState (облако) и НЕ сбрасывается
          // при загрузке/тике (в отличие от lastSeen). То, что сохранено позже — новее.
          const cloudSeen = cloud.meta?.savedAt || cloud.lastSeen || 0;
          const localSeen = local.meta?.savedAt || local.lastSeen || 0;
          // Локальный сейв "пустой" (новый игрок, только что созданный): level 1,
          // без прогресса. Такой пустой сейв НЕ должен затирать реальный облачный
          // прогресс и не должен показывать окно выбора персонажа — берём облако.
          const localEmpty = local.hero.level <= 1 && (local.totals?.kills ?? 0) <= 0 && local.inv.length === 0 && (local.hero.gold ?? 0) <= 100;
          // Защита от потери прогресса:
          // - если локальный сейв пустой (новый игрок) — всегда берём облако,
          //   иначе пустой сейв затрёт реальный прогресс и покажет окно выбора героя;
          // - если локальный не пустой и облако строго новее — берём облако;
          // - если локальный не пустой и новее облака (свежие действия, например
          //   только что потратил камни) — поднимаем локальный в облако.
          if (localEmpty || cloudSeen > localSeen) {
            ref.current = cloud;
            d({ type: "HYDRATE_STATE", state: cloud });
          } else {
            // Серверная ревизия уже установлена в loadGameState; сохраняем
            // локальный прогресс только после успешной загрузки облака.
            await saveGameState(local);
          }
        } else if (!res.state) {
          // Облако доступно, но сейва нет — это новый игрок, поднимаем локальный в облако.
          await saveGameState(ref.current);
        }
        cloudReady.current = true;
        if (!cancelled) { setCloudBooted(true); setCloudUnreachable(false); }
      } else if (!launchParams) {
        // Нет launch-параметров VK — авторизация в облако сейчас невозможна.
        // Не держим загрузку: выходим в игру офлайн; эффект перезапустится,
        // когда параметры появятся, и попробует облако снова.
        cloudReady.current = false;
        if (!cancelled) setCloudBooted(true);
      } else {
        // Облако недоступно (сеть/лимит). НЕ затираем его локальным состоянием — пробуем снова.
        cloudReady.current = false;
        // Сразу показываем кнопку «Играть офлайн», чтобы игрок не ждал все попытки.
        if (!cancelled) setCloudUnreachable(true);
        if (attempt < 2) {
          // До 2 повторов с короткими паузами (2с, 4с) — итого максимум ~6с фоновых попыток.
          setTimeout(() => void loadCloud(attempt + 1), 2000 * (attempt + 1));
        } else if (!cancelled) {
          // После всех попыток облако так и не ответило — выходим в офлайн, не трогая облачный сейв.
          setCloudBooted(true);
        }
      }
    };
    void loadCloud();
    return () => { cancelled = true; };
  }, [inVk, launchParams]);

  const stats = useMemo(() => getStats(s), [s]);
  useEffect(() => {
    if (!inVk) return;
    const sync = () => void syncProfile({ classId: s.hero.classId, level: s.hero.level, power: stats.dps });
    sync();
    const timer = setInterval(sync, 15_000);
    return () => clearInterval(timer);
  }, [inVk, s.hero.classId, s.hero.level, stats.dps]);

  // Отчёт прогресса гильдии: копим приросты убийств/золота и шлём раз в ~20с.
  useEffect(() => {
    if (!inVk) return;
    const t = s.totals;
    const dkills = Math.max(0, t.kills - lastTotals.current.kills);
    const dgold = Math.max(0, t.goldEarned - lastTotals.current.gold);
    lastTotals.current = { kills: t.kills, gold: t.goldEarned };
    const g = guildReport.current;
    g.kills += dkills;
    g.gold += dgold;
    const now = Date.now();
    if (g.inGuild && (g.kills >= 20 || g.gold >= 1000 || now - g.lastSent > 30_000)) {
      const sent = { kills: g.kills, gold: g.gold };
      g.kills = 0; g.gold = 0; g.lastSent = now;
      void guildProgress(sent.kills, sent.gold);
    }
  }, [inVk, s.totals.kills, s.totals.goldEarned, guildProgress]);

  // При старте в VK: проверяем, состоит ли игрок в гильдии, и включаем отчёт.
  useEffect(() => {
    if (!inVk) return;
    let alive = true;
    guildMine().then(g => { if (alive) guildReport.current.inGuild = !!g; });
    return () => { alive = false; };
  }, [inVk, guildMine]);

  useEffect(() => () => { if (keySyncTimer.current) clearTimeout(keySyncTimer.current); }, []);
  // Стабилизируем значение контекста: в простое TICK возвращает тот же объект s
  // (farmTick без боя), и тогда useMemo не пересоздаёт значение → потребители не
  // ререндерятся без необходимости. dKey/cloudBooted стабильны, stats пересчитывается
  // только когда меняется s.
  const ctxValue = useMemo(() => ({ s, d: dKey, stats, cloudBooted, cloudUnreachable, playOffline }), [s, stats, cloudBooted, cloudUnreachable, playOffline]);
  return <Ctx.Provider value={ctxValue}>{children}</Ctx.Provider>;
}

export function useGame() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useGame outside provider");
  return c;
}
