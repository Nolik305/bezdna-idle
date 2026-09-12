import { useState, type ReactNode } from "react";
import { useGame } from "../game/useGame";
import { CLASSES, EVENTS, LOGIN_REWARDS } from "../game/data";
import { fmtTime } from "../game/logic";
import { fmt } from "../game/logic";
import { Icon } from "./bits";
import { HeroArt } from "./art";
import type { ClassId } from "../game/types";
import { useVk } from "../platform/vk";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/75 backdrop-blur-[3px]">
      <div className="panel anim-pop w-full max-w-sm p-5 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gold/10 blur-2xl pointer-events-none" />
        {children}
      </div>
    </div>
  );
}

function ClassModal() {
  const { d } = useGame();
  const [sel, setSel] = useState<ClassId>("mage");
  const [name, setName] = useState("");
  return (
    <Shell>
      <div className="text-center mb-4">
        <div className="font-display text-gold text-[11px] tracking-[0.3em] mb-1">БЕЗДНА IDLE</div>
        <h1 className="font-display text-2xl text-fog text-outline leading-tight">КТО ПОЙДЁТ В ПОХОД?</h1>
        <p className="text-dim text-xs mt-1">Гильдия выдаёт героя, метлу и путёвку в Прелый лес</p>
      </div>
      <input
        value={name}
        onChange={e => setName(e.target.value.slice(0, 14))}
        placeholder="Имя героя (необязательно)"
        className="w-full mb-3 bg-abyss border border-line rounded-xl px-3 py-2.5 text-sm text-fog placeholder:text-dim/60 outline-none focus:border-gold/60 transition-colors"
      />
      <div className="grid grid-cols-2 gap-3 mb-4">
        {(Object.keys(CLASSES) as ClassId[]).map(id => {
          const c = CLASSES[id];
          const active = sel === id;
          return (
            <button key={id} onClick={() => setSel(id)}
              className={`panel p-3 text-left transition-all duration-150 ${active ? "-translate-y-0.5" : "opacity-75"}`}
              style={active ? { borderColor: c.color, boxShadow: `0 0 18px ${c.color}44` } : undefined}>
              <div className="h-24 mb-1"><HeroArt classId={id} /></div>
              <div className="font-display text-[15px]" style={{ color: c.color }}>{c.name}</div>
              <div className="text-[10px] text-dim mb-1.5">{c.title}</div>
              <div className="text-[10px] text-fog/80 space-y-0.5">
                <div>Урон: {c.base.dmg}</div>
                <div>Скорость: {c.base.as}/с</div>
                <div>Базовое HP: {c.base.hp}</div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-dim italic text-center mb-4 min-h-[2rem]">{CLASSES[sel].desc}</p>
      <button onClick={() => d({ type: "CHOOSE_CLASS", classId: sel, name })} className="btn btn-gold w-full py-3.5 text-[15px]">
        В БОЙ!
      </button>
    </Shell>
  );
}

function OfflineModal({ gold, xp, sec }: { gold: number; xp: number; sec: number }) {
  const { d } = useGame();
  const { inVk, showRewardedAd } = useVk();
  const [adLoading, setAdLoading] = useState(false);
  const [adClaimed, setAdClaimed] = useState(false);

  const claimAd = async () => {
    setAdLoading(true);
    const reward = await showRewardedAd("offline_bonus");
    setAdLoading(false);
    if (reward) {
      d({ type: "CLAIM_AD_OFFLINE", gold: reward.gold, xp: reward.xp });
      setAdClaimed(true);
    }
  };

  return (
    <Shell>
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gold/15 border border-gold/40 grid place-items-center text-gold anim-float">
          <Icon n="chest" className="w-8 h-8" />
        </div>
        <h2 className="font-display text-xl text-fog text-outline mb-1">ВЫ ОТСУТСТВОВАЛИ {fmtTime(sec).toUpperCase()}</h2>
        <p className="text-dim text-xs mb-4">Наёмники гоняли слизней без вас. Вот ваша доля:</p>
        <div className="flex justify-center gap-5 mb-5">
          <div className="panel px-4 py-3">
            <div className="flex items-center gap-1.5 text-gold font-bold text-lg"><Icon n="coin" className="w-5 h-5" filled />{fmt(gold)}</div>
            <div className="text-[10px] text-dim">золото</div>
          </div>
          <div className="panel px-4 py-3">
            <div className="flex items-center gap-1.5 text-arc font-bold text-lg"><Icon n="star" className="w-5 h-5" />{fmt(xp)}</div>
            <div className="text-[10px] text-dim">опыт</div>
          </div>
        </div>
        {inVk && !adClaimed && (
          <button disabled={adLoading} onClick={() => void claimAd()} className="btn btn-gold w-full py-3 mb-2 text-[13px]">
            {adLoading ? "ЗАГРУЗКА РЕКЛАМЫ..." : "ПОЛУЧИТЬ БОНУС ЗА ПРОСМОТР"}
          </button>
        )}
        <button onClick={() => d({ type: "CLOSE_MODAL" })} className="btn btn-arc w-full py-3.5 text-[15px]">ЗАБРАТЬ ДОБЫЧУ</button>
      </div>
    </Shell>
  );
}

function EventModal({ id }: { id: string }) {
  const { s, d } = useGame();
  const ev = EVENTS.find(e => e.id === id);
  if (!ev) return null;
  const iconColor: Record<string, string> = { toad: "#4ade80", chest: "#f0b429", bard: "#c084fc", goblin: "#ff6b3d" };
  const c = iconColor[id] ?? "#f0b429";
  const canAfford = (need: number) => s.hero.gold >= need;
  return (
    <Shell>
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full grid place-items-center anim-float"
          style={{ background: `${c}22`, border: `1px solid ${c}66`, color: c }}>
          <Icon n={ev.icon} className="w-9 h-9" />
        </div>
        <div className="font-display text-[10px] tracking-[0.25em] text-dim mb-1">СЛУЧАЙНАЯ ВСТРЕЧА</div>
        <h2 className="font-display text-xl text-fog text-outline mb-2">{ev.title.toUpperCase()}</h2>
        <p className="text-[13px] text-fog/85 leading-relaxed mb-5">{ev.text}</p>
        <div className="space-y-2.5">
          {ev.options.map((o, i) => {
            const need = ev.id === "bard" && i === 1 ? 40 : ev.id === "goblin" && i === 0 ? 60 : 0;
            const disabled = need > 0 && !canAfford(need);
            return (
              <button key={i} disabled={disabled} onClick={() => d({ type: "CHOOSE_EVENT", idx: i })}
                className="btn btn-dark w-full py-3 px-4 text-left">
                <div className="text-[14px]">{o.label}</div>
                <div className="text-[10px] text-dim font-body font-normal tracking-normal">{disabled ? "Не хватает золота" : o.hint}</div>
              </button>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}

function LevelUpModal({ level }: { level: number }) {
  const { d } = useGame();
  return (
    <Shell>
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-gold/15 border-2 border-gold/50 grid place-items-center anim-float"
          style={{ boxShadow: "0 0 30px rgba(240,180,41,0.3)" }}>
          <span className="font-display text-3xl text-gold text-outline">{level}</span>
        </div>
        <h2 className="font-display text-2xl text-gold text-outline mb-1">НОВЫЙ УРОВЕНЬ!</h2>
        <p className="text-dim text-xs mb-5">+1 очко навыков · HP полностью восстановлено</p>
        <button onClick={() => d({ type: "CLOSE_MODAL" })} className="btn btn-gold w-full py-3.5 text-[15px]">ОТЛИЧНО</button>
      </div>
    </Shell>
  );
}

function ActivityModal() {
  const { s, d } = useGame();
  const { inVk, claimActivity, saveGameState } = useVk();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const day = Math.max(1, Math.min(7, s.activity?.day || 1));
  const reward = LOGIN_REWARDS[day - 1];
  const claim = async () => {
    setLoading(true);
    setError(false);
    if (inVk) {
      // Сначала синхронизируем текущий локальный прогресс с сервером.
      // Это чинит: (а) первый вход, когда сейва на сервере ещё нет
      // (сервер отвечал game_state_not_initialized и бонус не выдавался),
      // и (б) награда применяется к свежим данным, а не к устаревшему
      // снимку — без потери локального прогресса через HYDRATE_STATE.
      const saved = await saveGameState(s);
      let result = await claimActivity();
      // Если сейв всё ещё не долетел — повторим попытку один раз.
      if (result.error === "game_state_not_initialized" && saved) {
        result = await claimActivity();
      }
      if (result.state) {
        // Сервер подтвердил награду — применяем его свежее состояние.
        d({ type: "HYDRATE_STATE", state: result.state });
      } else if (result.error === "already_claimed") {
        // Награда уже была выдана на сервере ранее — просто закрываем окно.
        d({ type: "CLOSE_MODAL" });
      } else {
        // Сервер недоступен или ещё не инициализирован. Чтобы ежедневный
        // бонус всегда доставался игроку, выдаём его локально — при следующей
        // автосинхронизации lastClaimDate уедет на сервер и повтор не случится.
        d({ type: "CLAIM_ACTIVITY" });
      }
    } else {
      d({ type: "CLAIM_ACTIVITY" });
    }
    setLoading(false);
  };
  return (
    <Shell>
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gold/15 border border-gold/50 grid place-items-center text-gold anim-float">
          <Icon n="calendar" className="w-8 h-8" />
        </div>
        <div className="font-display text-[10px] tracking-[0.25em] text-gold mb-1">7 ДНЕЙ В БЕЗДНЕ</div>
        <h2 className="font-display text-2xl text-fog text-outline mb-1">ДЕНЬ {day}</h2>
        <p className="text-dim text-xs mb-4">Заходи каждый день и забирай всё более щедрые награды.</p>
        <div className="grid grid-cols-7 gap-1 mb-4">
          {LOGIN_REWARDS.map((item, index) => {
            const active = index + 1 === day;
            const claimed = s.activity?.claimed.includes(index + 1);
            return <div key={index} className={`rounded-md border py-1.5 text-[9px] font-display ${active ? "border-gold bg-gold/15 text-gold" : claimed ? "border-arc/40 text-arc" : "border-line/60 text-dim"}`}>Д{index + 1}</div>;
          })}
        </div>
        <div className="panel px-3 py-3 mb-4 flex justify-center gap-4 text-sm font-bold">
          <span className="text-gold"><Icon n="coin" className="w-4 h-4 inline" filled /> {fmt(reward.gold)}</span>
          <span className="text-mana"><Icon n="gem" className="w-4 h-4 inline" filled /> {reward.gems}</span>
          <span className="text-arc"><Icon n="flask" className="w-4 h-4 inline" /> {reward.potions}</span>
        </div>
        {error && <div className="text-[10px] text-blood mb-2">Не удалось подтвердить награду на сервере. Попробуйте ещё раз.</div>}
        <button disabled={loading} onClick={() => void claim()} className="btn btn-gold w-full py-3.5 text-[15px]">{loading ? "ПРОВЕРКА..." : "ЗАБРАТЬ НАГРАДУ"}</button>
      </div>
    </Shell>
  );
}

export function Modals() {
  const { s } = useGame();
  const m = s.modal;
  if (!m) return null;
  if (m.t === "class") return <ClassModal />;
  if (m.t === "offline") return <OfflineModal gold={m.gold} xp={m.xp} sec={m.sec} />;
  if (m.t === "event") return <EventModal id={m.id} />;
  if (m.t === "levelup") return <LevelUpModal level={m.level} />;
  if (m.t === "activity") return <ActivityModal />;
  return null;
}
