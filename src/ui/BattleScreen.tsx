import { useEffect, useRef } from "react";
import { useGame } from "../game/useGame";
import { ZONES, SKILLS } from "../game/data";
import { fmt, xpNeed } from "../game/logic";
import { Icon } from "./bits";
import { HeroArt, MonsterArt } from "./art";

const fxStyle: Record<string, string> = {
  dmg: "text-fog text-base font-bold",
  crit: "text-gold2 font-display text-2xl",
  hurt: "text-blood text-sm font-bold",
  heal: "text-arc font-display text-xl",
  gold: "text-gold text-sm font-bold",
  xp: "text-arc text-xs font-bold",
};

export function BattleScreen() {
  const { s, d, stats } = useGame();
  const B = s.battle;
  const zone = ZONES[B.zone];
  const e = B.enemy;
  const artRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const lastFx = useRef(0);

  useEffect(() => {
    const f = B.fx[0];
    if (f && f.id !== lastFx.current) {
      lastFx.current = f.id;
      const target = f.kind === "hurt" ? artRef.current : heroRef.current;
      const attacker = f.kind === "hurt" ? heroRef.current : artRef.current;
      if (target) { target.classList.remove("anim-shake"); void target.offsetWidth; target.classList.add("anim-shake"); }
      if (attacker && (f.kind === "dmg" || f.kind === "crit" || f.kind === "hurt")) {
        const lungeClass = f.kind === "hurt" ? "anim-lunge-left" : "anim-lunge-right";
        attacker.classList.remove("anim-lunge-left", "anim-lunge-right");
        void attacker.offsetWidth;
        attacker.classList.add(lungeClass);
      }
    }
  }, [B.fx]);

  const skills = SKILLS.filter(k => k.classId === s.hero.classId);
  const toBoss = 10 - (B.wave % 10 === 0 ? 10 : B.wave % 10);
  const skillsUsed = s.hero.skillPoints > 0;

  return (
    <div className="flex flex-col gap-3">
      {s.run.active && (
        <div className="panel px-3 py-2.5 flex items-center gap-2.5 border-arc/50">
          <Icon n="route" className="w-5 h-5 text-arc shrink-0" />
          <div className="flex-1">
            <div className="font-display text-[12px] text-arc">Герой в экспедиции</div>
            <div className="text-[10px] text-dim">Фарм на паузе. Волна {s.run.wave}/{20} — загляни во вкладку «Рогалик».</div>
          </div>
        </div>
      )}
      {/* zones */}
      <div className="flex gap-2 overflow-x-auto scroll-slim -mx-1 px-1 pb-1">
        {ZONES.map((z, i) => {
          const locked = i >= s.zones;
          const active = i === B.zone;
          return (
            <button key={i} disabled={locked} onClick={() => d({ type: "SET_ZONE", zone: i })}
              className={`shrink-0 px-3 py-1.5 rounded-xl border text-[12px] font-display tracking-wide transition-all duration-150 flex items-center gap-1.5
                ${active ? "text-ink" : locked ? "text-dim/50 border-line/60 bg-panel/50" : "text-fog border-line bg-panel hover:border-gold/50"}`}
              style={active ? { background: `linear-gradient(180deg, ${z.tint}, ${z.tint}bb)`, borderColor: z.tint, boxShadow: `0 0 14px ${z.tint}55` } : undefined}>
              {locked && <Icon n="lock" className="w-3.5 h-3.5" />}
              {s.bossDone[i] && <Icon n="check" className="w-3.5 h-3.5" />}
              {z.name}
            </button>
          );
        })}
      </div>

      {/* enemy arena */}
      <div className="panel relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(420px 240px at 50% 30%, ${zone.tint}1f, transparent 70%)` }} />
        <div className="relative px-4 pt-3">
          <div className="flex items-center justify-between">
            <div className="font-display text-[13px] tracking-wide" style={{ color: zone.tint }}>
              {zone.name.toUpperCase()}
            </div>
            <div className="text-[11px] text-dim flex items-center gap-1">
              <Icon n="wave" className="w-3.5 h-3.5" />Волна <b className="text-fog">{B.wave}</b>
            </div>
          </div>
          <div className="text-[10px] text-dim/80 italic">{zone.flavor}</div>
        </div>

        <div className="relative h-52 flex items-end justify-center gap-2 px-5">
          {e && (
            <>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-56 h-6 rounded-full pointer-events-none"
                style={{ background: `radial-gradient(closest-side, ${zone.tint}55, transparent 75%)`, filter: "blur(2px)" }} />
              <div ref={heroRef} className="relative z-10 w-24 h-32 shrink-0 anim-battle-idle">
                <HeroArt classId={s.hero.classId} equip={s.equip} />
              </div>
              <div ref={artRef} className={`relative z-10 shrink-0 anim-battle-idle ${e.boss ? "w-36 h-36" : "w-32 h-32"}`}>
                <MonsterArt k={e.key} boss={e.boss} zone={B.zone} />
              </div>
              {/* poison indicator */}
              {B.dotT > 0 && (
                <div className="absolute top-2 left-3 flex items-center gap-1 text-[10px] font-bold text-r1 bg-black/40 px-2 py-0.5 rounded-full border border-r1/40">
                  <Icon n="venom" className="w-3 h-3" />ЯД {Math.ceil(B.dotT)}с
                </div>
              )}
              {/* fx layer */}
              <div className="absolute inset-0 pointer-events-none">
                {B.fx.map(f => (
                  <span key={f.id} className={`fx-float absolute ${fxStyle[f.kind]} text-outline`}
                    style={{ left: f.x + "%", top: f.y + "%" }}>
                    {f.text}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="relative px-4 pb-3">
          {e && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-display text-[14px] text-fog truncate">{e.name}</span>
                {e.boss && (
                  <span className="shrink-0 text-[9px] font-display tracking-widest text-blood bg-blood/15 border border-blood/50 px-1.5 py-0.5 rounded-md">БОСС</span>
                )}
                <span className="ml-auto text-[11px] text-dim tabular-nums">{fmt(Math.max(0, e.hp))} / {fmt(e.maxHp)}</span>
              </div>
              <div className="relative h-4 rounded-full bg-black/55 border border-white/5 overflow-hidden">
                <div className={`absolute inset-y-0 left-0 transition-[width] duration-200 ease-out ${e.boss ? "bg-gradient-to-b from-[#ff8a8e] to-blood" : "bg-gradient-to-b from-[#ff9068] to-ember"}`}
                  style={{ width: Math.max(0, (e.hp / e.maxHp) * 100) + "%", boxShadow: "0 0 12px rgba(255,107,61,0.4)" }} />
                <div className="absolute inset-x-0 top-0 h-1/2 bg-white/15" />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[10px] text-dim">
                <span>{e.boss ? "Главарь зоны. Дроп x2, нервы x0.5" : zone.endless ? "Бездна бесконечна, как понедельник" : `До босса: ${toBoss === 10 ? "это босс!" : toBoss + " волн"}`}</span>
                <span className="tabular-nums">+{fmt(e.gold)} зол. · +{fmt(e.xp)} оп.</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* death / auto-revive banner */}
      {B.paused && B.respawnT > 0 && (
        <div className="anim-pop panel border-blood/50 px-3.5 py-3 flex items-center gap-3"
          style={{ boxShadow: "0 0 22px rgba(229,72,77,0.25)", borderColor: "#e5484d88" }}>
          <div className="w-10 h-10 shrink-0 rounded-full bg-blood/15 border border-blood/50 grid place-items-center text-blood">
            <Icon n="skull" className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="font-display text-[14px] text-blood tracking-wide">ВЫ ПАЛИ</div>
            <div className="text-[10px] text-dim">Автовоскрешение · совет: качните пассивки или спуститесь ниже</div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display text-2xl text-fog tabular-nums leading-none">{Math.ceil(B.respawnT)}</div>
            <div className="text-[8px] text-dim tracking-widest font-display">АВТОВОЗРОЖДЕНИЕ</div>
          </div>
        </div>
      )}

      {/* battle log */}
      {!B.paused && (
        <div key={B.log[0] ?? ""} className="anim-rise text-[11px] text-dim/90 px-1 h-4 truncate">
          {B.log[0] ?? "Бой идёт своим чередом..."}
        </div>
      )}

      {/* скилы (авто-каст, некликабельно) */}
      <div className="grid grid-cols-4 gap-2">
        {skills.map(sk => {
          const cd = B.cds[sk.id] || 0;
          const locked = s.hero.level < sk.unlockLevel;
          return (
            <div key={sk.id}
              className="relative btn btn-dark py-2.5 px-1 h-[74px] flex flex-col items-center justify-center gap-0.5 overflow-hidden select-none"
              title={`${sk.name} — авто-каст`}>
              <Icon n={sk.icon} className="w-6 h-6 text-gold2" style={{ color: locked ? "#8b98a9" : "#f0b429" }} />
              <span className="text-[9px] leading-tight text-fog font-body font-semibold text-center px-0.5">{sk.name}</span>
              <span className="text-[9px] text-dim font-body">ур. {s.skills[sk.id] || 1}</span>
              {locked && (
                <span className="absolute inset-0 bg-abyss/80 grid place-items-center">
                  <span className="flex flex-col items-center text-dim"><Icon n="lock" className="w-5 h-5" /><span className="text-[9px] font-body mt-0.5">с {sk.unlockLevel} ур.</span></span>
                </span>
              )}
              {!locked && cd > 0 && (
                <span className="absolute inset-x-0 bottom-0 bg-abyss/85 border-t border-line flex items-end justify-center pointer-events-none"
                  style={{ height: (cd / sk.cd) * 100 + "%" }}>
                  <span className="text-[11px] font-display text-fog pb-1">{cd.toFixed(1)}</span>
                </span>
              )}
            </div>
          );
        })}
        <button onClick={() => d({ type: "USE_POTION" })} disabled={s.hero.potions <= 0}
          className="btn btn-dark py-2.5 px-1 h-[74px] flex flex-col items-center justify-center gap-0.5"
          style={s.hero.potions > 0 ? { borderColor: "#3fd0b666" } : undefined}>
          <Icon n="flask" className="w-6 h-6 text-arc" />
          <span className="text-[9px] leading-tight text-fog font-body font-semibold">Зелье</span>
          <span className="text-[10px] text-arc font-body font-bold">×{s.hero.potions}</span>
        </button>
      </div>

      {/* stats strip */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { l: "Урон", v: fmt(stats.dmg), i: "sword", c: "#ff6b3d" },
          { l: "DPS", v: fmt(stats.dps), i: "bolt", c: "#f0b429" },
          { l: "Крит", v: stats.crit.toFixed(0) + "%", i: "target", c: "#4cc3ff" },
          { l: "Атак/с", v: stats.as.toFixed(2), i: "run", c: "#3fd0b6" },
        ].map(x => (
          <div key={x.l} className="panel py-2 px-1">
            <div className="flex items-center justify-center gap-1 font-display text-[14px]" style={{ color: x.c }}>
              <Icon n={x.i} className="w-3.5 h-3.5" />{x.v}
            </div>
            <div className="text-[9px] text-dim mt-0.5">{x.l}</div>
          </div>
        ))}
      </div>

      {/* hero xp line */}
      <div className="panel px-3 py-2.5">
        <div className="flex justify-between text-[10px] text-dim mb-1">
          <span>{s.hero.name} · {s.hero.level} ур.</span>
          <span className="tabular-nums">{fmt(s.hero.xp)} / {fmt(xpNeed(s.hero.level))} XP</span>
        </div>
        <div className="relative h-2 rounded-full bg-black/50 overflow-hidden anim-xp">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#3fd0b6] to-[#7ee8d6] transition-[width] duration-300"
            style={{ width: Math.min(100, (s.hero.xp / xpNeed(s.hero.level)) * 100) + "%" }} />
        </div>
        {skillsUsed && <div className="text-[9px] text-gold/80 mt-1">Очков навыков: {s.hero.skillPoints} — загляни в «Скилы»</div>}
      </div>
    </div>
  );
}
