import { useEffect, useRef, useState } from "react";
import { GameProvider, useGame } from "./game/useGame";
import { fmt, xpNeed } from "./game/logic";
import { CLASSES, VIP_LEVELS } from "./game/data";
import { Icon } from "./ui/bits";
import { BattleScreen } from "./ui/BattleScreen";
import { HeroTab, InventoryTab } from "./ui/HeroScreens";
import { SkillsScreen } from "./ui/SkillsScreen";
import { MoreScreen } from "./ui/MoreScreen";
import { BUILD_VERSION, BUILD_DATE } from "./buildInfo";
import { RunScreen } from "./ui/RunScreen";
import { DuelScreen } from "./ui/DuelScreen";
import { PartyScreen } from "./ui/PartyScreen";
import { Modals } from "./ui/Modals";
import { ChatPanel } from "./ui/ChatPanel";
import { useVk, VkProvider } from "./platform/vk";

type Tab = "battle" | "run" | "duel" | "party" | "hero" | "inv" | "skills" | "more";

function CloudBadge() {
  const { inVk, cloudStatus, cloudDetail } = useVk();
  if (!inVk) return null;
  const map: Record<string, { c: string; label: string }> = {
    syncing: { c: "#f0b429", label: "⏳" },
    saved: { c: "#3fd0b6", label: "☁️" },
    error: { c: "#e5484d", label: "⚠️" },
    offline: { c: "#8b98a9", label: "⚪" },
  };
  const st = map[cloudStatus] ?? map.offline;
  return (
    <div className="flex items-center gap-1 text-[9px] leading-none"
      style={{ color: st.c }} title={cloudDetail}>
      <span className="text-[11px]">{st.label}</span>
      <span className="font-semibold">{cloudStatus === "saved" ? "сохранено" : cloudStatus === "syncing" ? "сохр…" : cloudStatus === "error" ? (cloudDetail || "ошибка") : "офлайн"}</span>
    </div>
  );
}

function HUD() {
  const { s, stats } = useGame();
  const { user } = useVk();
  const cls = CLASSES[s.hero.classId];
  const hpPct = (s.hero.hp / stats.maxHp) * 100;
  const poisonT = Math.max(s.battle.dotT, s.run.dotT, s.duel.dotT);
  return (
    <div className="panel px-3 py-2 safe-t">
      <div className="flex items-center gap-2.5">
        <div className="relative w-10 h-10 shrink-0 rounded-xl grid place-items-center border overflow-hidden"
          style={{ borderColor: cls.color + "77", background: `linear-gradient(160deg, ${cls.color}26, ${cls.color}0a)`, color: cls.color }}>
          {user?.photo_100 ? <img src={user.photo_100} alt="" className="w-full h-full object-cover" /> : <Icon n={s.hero.classId === "mage" ? "staff" : "bow"} className="w-5 h-5" />}
          <span className="absolute -bottom-1.5 -right-1.5 bg-gold text-ink text-[9px] font-display px-1 rounded-md border border-ink leading-tight py-px">
            {s.hero.level}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <span className="font-display text-[13px] text-fog truncate flex items-center gap-1.5">
              {s.hero.name}
              {s.vip > 0 && VIP_LEVELS[Math.min(s.vip, VIP_LEVELS.length) - 1] && (
                <span className="text-[8px] font-display px-1 py-px rounded border leading-none flex items-center gap-0.5"
                  style={{
                    color: VIP_LEVELS[Math.min(s.vip, VIP_LEVELS.length) - 1].color,
                    borderColor: VIP_LEVELS[Math.min(s.vip, VIP_LEVELS.length) - 1].color + "66",
                    background: VIP_LEVELS[Math.min(s.vip, VIP_LEVELS.length) - 1].color + "1a",
                    boxShadow: `0 0 8px ${VIP_LEVELS[Math.min(s.vip, VIP_LEVELS.length) - 1].color}33`,
                  }}>
                  <Icon n="crown" className="w-2.5 h-2.5" />VIP {s.vip}
                </span>
              )}
            </span>
            <span className="text-[9px] text-dim tabular-nums shrink-0">{fmt(s.hero.xp)}/{fmt(xpNeed(s.hero.level))} XP</span>
          </div>
          <div className="relative h-1.5 mt-1 rounded-full bg-black/50 overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#3fd0b6] to-[#7ee8d6] transition-[width] duration-300"
              style={{ width: Math.min(100, (s.hero.xp / xpNeed(s.hero.level)) * 100) + "%" }} />
          </div>
          <div className="relative h-2.5 mt-1 rounded-full bg-black/50 overflow-hidden border border-white/5">
            <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
              style={{
                width: Math.max(0, Math.min(100, hpPct)) + "%",
                background: hpPct < 30 ? "linear-gradient(180deg,#ff8a8e,#e5484d)" : "linear-gradient(180deg,#ff9068,#e05a30)",
                boxShadow: "0 0 8px rgba(229,72,77,0.5)",
              }} />
            <span className="absolute inset-0 grid place-items-center text-[8px] font-bold text-white/90 tabular-nums leading-none">
              {fmt(Math.max(0, s.hero.hp))} / {fmt(stats.maxHp)}
            </span>
          </div>
          {poisonT > 0 && <div className="text-[9px] text-[#ff6b8d] mt-0.5">Яд: {Math.ceil(poisonT)}с</div>}
        </div>
        <div className="shrink-0 text-right space-y-0.5">
          <div className="flex items-center gap-1 justify-end text-gold font-bold text-[13px] tabular-nums">
            <Icon n="coin" className="w-3.5 h-3.5" filled />{fmt(s.hero.gold)}
          </div>
          <div className="flex items-center gap-1 justify-end text-mana font-bold text-[13px] tabular-nums">
            <Icon n="gem" className="w-3.5 h-3.5" filled />{fmt(s.hero.gems)}
          </div>
          <CloudBadge />
        </div>
      </div>
    </div>
  );
}

function Toasts() {
  const { s, d } = useGame();
  // Каждый тост получает свой независимый таймер — появление новых тостов
  // не сбрасывает таймер уже показанных, поэтому они гарантированно исчезают.
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    for (const t of s.toasts) {
      if (timers.current.has(t.id)) continue;
      const timer = setTimeout(() => {
        timers.current.delete(t.id);
        d({ type: "DISMISS_TOAST", id: t.id });
      }, 2600);
      timers.current.set(t.id, timer);
    }
    // Чистим таймеры тостов, которых уже нет (например, после ручного закрытия).
    for (const [id, timer] of timers.current) {
      if (!s.toasts.some(x => x.id === id)) {
        clearTimeout(timer);
        timers.current.delete(id);
      }
    }
  }, [s.toasts, d]);
  const style: Record<string, { c: string; i: string }> = {
    info: { c: "#8b98a9", i: "info" },
    gold: { c: "#f0b429", i: "coin" },
    loot: { c: "#c084fc", i: "bag" },
    warn: { c: "#e5484d", i: "skull" },
    gem: { c: "#4cc3ff", i: "gem" },
  };
  return (
    <div className="fixed top-2 inset-x-0 z-[60] flex flex-col items-center gap-1.5 px-4 pointer-events-none">
      {s.toasts.map(t => {
        const st = style[t.kind] ?? style.info;
        return (
          <button key={t.id} onClick={() => d({ type: "DISMISS_TOAST", id: t.id })}
            className="anim-toast panel px-3.5 py-2 flex items-center gap-2 max-w-sm text-left cursor-pointer"
            style={{ borderColor: st.c + "66", boxShadow: `0 6px 20px rgba(0,0,0,0.5), 0 0 12px ${st.c}22` }}>
            <span style={{ color: st.c }}><Icon n={st.i} className="w-4 h-4" filled={t.kind !== "info"} /></span>
            <span className="text-[12px] font-semibold" style={{ color: st.c }}>{t.text}</span>
          </button>
        );
      })}
    </div>
  );
}

function Nav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { s } = useGame();
  const items: { id: Tab; n: string; i: string; badge?: boolean }[] = [
    { id: "battle", n: "Поход", i: "sword" },
    { id: "run", n: "Рогалик", i: "route", badge: (s.shards > 0 || s.blood > 0) && !s.run.active },
    { id: "duel", n: "Дуэли", i: "crossed", badge: s.duel.tokens > 0 && s.duel.state === "idle" },
    { id: "party", n: "Пати", i: "users", badge: !!s.party },
    { id: "hero", n: "Герой", i: "user" },
    { id: "inv", n: "Рюкзак", i: "bag", badge: s.inv.length > 0 },
    { id: "skills", n: "Скилы", i: "spark", badge: s.hero.skillPoints > 0 },
    { id: "more", n: "Ещё", i: "dots" },
  ];
  return (
    <div className="panel mx-3 mb-2 safe-b px-1 py-1.5 grid grid-cols-8 gap-0.5 relative z-10">
      {items.map(it => {
        const active = tab === it.id;
        return (
          <button key={it.id} onClick={() => setTab(it.id)}
            className={`relative py-1.5 rounded-xl flex flex-col items-center gap-0.5 transition-all duration-150 ${active ? "text-gold bg-gold/12 border border-gold/30" : "text-dim border border-transparent"}`}>
            <Icon n={it.i} className="w-4.5 h-4.5" />
            <span className="text-[8px] font-display tracking-wide leading-none">{it.n}</span>
            {it.badge && !active && <span className="absolute top-1 right-1/4 w-1.5 h-1.5 rounded-full bg-arc shadow-[0_0_6px_#3fd0b6]" />}
          </button>
        );
      })}
    </div>
  );
}

function Shell() {
  const { s, cloudBooted, cloudUnreachable, playOffline } = useGame();
  const [tab, setTab] = useState<Tab>(() => s.run.active || s.modal?.t === "runpick" ? "run" : "battle");
  if (!cloudBooted) return <LoadingScreen unreachable={cloudUnreachable} onPlayOffline={playOffline} />;
  return (
    <div className="h-full flex flex-col bg-dungeon bg-noise relative select-none" onContextMenu={e => e.preventDefault()}>
      {/* torches */}
      <div className="torch w-56 h-56 bg-ember/25 -top-20 -left-16" />
      <div className="torch w-64 h-64 bg-arc/15 top-1/3 -right-24" style={{ animationDelay: "-2.2s" }} />
      <div className="torch w-52 h-52 bg-gold/12 bottom-10 -left-20" style={{ animationDelay: "-4s" }} />

      <div className="relative z-10 h-full max-w-md mx-auto w-full flex flex-col">
        <div className="px-3 pt-2"><HUD /></div>
        <main className="flex-1 overflow-y-auto scroll-slim overscroll-contain px-3 py-3">
          <div key={tab} className="anim-rise">
            {tab === "battle" && <BattleScreen />}
            {tab === "run" && <RunScreen />}
            {tab === "duel" && <DuelScreen />}
            {tab === "party" && <PartyScreen />}
            {tab === "hero" && <HeroTab />}
            {tab === "inv" && <InventoryTab />}
            {tab === "skills" && <SkillsScreen />}
            {tab === "more" && <MoreScreen />}
          </div>
          <div className="h-2" />
        </main>
        <Nav tab={tab} setTab={setTab} />
      </div>
      <Toasts />
      <Modals />
      <ChatPanel />
    </div>
  );
}

function LoadingScreen({ unreachable = false, onPlayOffline, stage }: { unreachable?: boolean; onPlayOffline?: () => void; stage?: string }) {
  return (
    <div className="loading-screen bg-dungeon bg-noise grid place-items-center select-none">
      <div className="relative z-10 flex flex-col items-center gap-5">
        <div className="loading-mark">
          <div className="loading-mark-core" />
        </div>
        <div className="text-center">
          <div className="font-display text-xl tracking-[0.18em] text-gold">БЕЗДНА</div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-dim">Пробуждение героя</div>
        </div>
        {stage && <div className="text-[11px] text-arc text-center max-w-[280px]">{stage}</div>}
        {unreachable && onPlayOffline ? (
          <div className="flex flex-col items-center gap-3">
            <div className="text-[11px] text-dim text-center max-w-[240px]">
              Не удаётся соединиться с облаком. Можно продолжить офлайн — прогресс сохранится на устройстве и синхронизируется позже.
            </div>
            <button onClick={onPlayOffline}
              className="px-4 py-2 rounded-xl font-display text-[12px] text-ink bg-gold border border-gold/50 shadow-[0_0_16px_#f0b42944]">
              Играть офлайн
            </button>
          </div>
        ) : (
          <div className="loading-dots flex gap-1.5" aria-label="Загрузка">
            <span /><span /><span />
          </div>
        )}
        <div className="mt-4 text-[9px] text-dim/60 tabular-nums">build {BUILD_VERSION} · {BUILD_DATE}</div>
      </div>
    </div>
  );
}

function AppContent() {
  const { ready, initStage } = useVk();
  const [minimumReady, setMinimumReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinimumReady(true), 700);
    return () => clearTimeout(timer);
  }, []);

  if (!ready || !minimumReady) return <LoadingScreen stage={initStage} />;
  return <GameProvider><Shell /></GameProvider>;
}

export default function App() {
  return <VkProvider><AppContent /></VkProvider>;
}
