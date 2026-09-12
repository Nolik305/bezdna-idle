import { useGame } from "../game/useGame";
import { SKILLS, PASSIVES, skillCost } from "../game/data";
import { fmt } from "../game/logic";
import { Icon, SectionTitle, Bar } from "./bits";

export function SkillsScreen() {
  const { s, d, stats } = useGame();
  const skills = SKILLS.filter(k => k.classId === s.hero.classId);

  return (
    <div className="flex flex-col gap-3">
      <div className="panel px-3 py-2.5 flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-lg bg-gold/12 border border-gold/40 grid place-items-center text-gold">
          <Icon n="spark" className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="font-display text-[13px] text-fog">ОЧКИ НАВЫКОВ: <span className="text-gold">{s.hero.skillPoints}</span></div>
          <div className="text-[10px] text-dim">+1 за уровень героя. Тратьте с умом (или нет).</div>
        </div>
      </div>

      <div className="panel p-3">
        <SectionTitle icon="bolt">АКТИВНЫЕ СКИЛЫ</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {skills.map(sk => {
            const lvl = s.skills[sk.id] || 1;
            const locked = s.hero.level < sk.unlockLevel;
            const cost = skillCost(lvl);
            const total = stats.dmg * sk.mult(lvl) * sk.hits(lvl);
            const cd = s.battle.cds[sk.id] || 0;
            const canAfford = !locked && s.hero.gold >= cost;
            return (
              <div key={sk.id} className={`relative bg-abyss/60 border rounded-xl p-2.5 flex flex-col gap-1.5 ${locked ? "border-line/40 opacity-70" : "border-line/60"}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-9 h-9 shrink-0 rounded-lg grid place-items-center border ${locked ? "text-dim border-line" : "text-ember border-ember/40 bg-ember/10"}`}>
                    <Icon n={locked ? "lock" : sk.icon} className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display text-[12px] text-fog truncate">{sk.name}</span>
                      <span className="shrink-0 text-[8px] font-bold px-1 py-px rounded bg-panel2 border border-line text-arc">ур.{lvl}</span>
                    </div>
                    <div className="text-[9px] text-dim/80 truncate">{locked ? `откроется с ${sk.unlockLevel} ур.` : `~${fmt(total)} урона · КД ${sk.cd}с${cd > 0 ? ` · ${cd.toFixed(0)}с` : ""}`}</div>
                  </div>
                </div>
                <div className="text-[9px] text-dim leading-snug">{locked ? "" : sk.desc(lvl)}</div>
                <button disabled={!canAfford} onClick={() => d({ type: "LEVEL_SKILL", id: sk.id })}
                  className="btn btn-gold w-full py-1.5 text-[10px] flex items-center justify-center gap-1">
                  <Icon n="plus" className="w-3 h-3" />
                  <span className="flex items-center gap-0.5"><Icon n="coin" className="w-3 h-3" filled />{fmt(cost)}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel p-3">
        <SectionTitle icon="book" right={<span className="text-[10px] text-dim">пассивки · очками</span>}>ПАССИВНЫЕ НАВЫКИ</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {PASSIVES.map(p => {
            const rank = s.passives[p.id] || 0;
            const maxed = rank >= p.max;
            return (
              <div key={p.id} className={`bg-abyss/60 border rounded-xl p-2 flex flex-col gap-1 ${maxed ? "border-arc/40" : "border-line/60"}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 shrink-0 rounded-lg grid place-items-center border ${rank > 0 ? "text-arc border-arc/40 bg-arc/10" : "text-dim border-line"}`}>
                    <Icon n={p.icon} className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-display text-[11px] text-fog truncate">{p.name}</span>
                      <span className="flex gap-[3px] shrink-0">
                        {Array.from({ length: p.max }).map((_, i) => (
                          <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < rank ? "bg-arc" : "bg-line"}`} />
                        ))}
                      </span>
                    </div>
                    <div className="text-[9px] text-dim truncate">{rank > 0 ? p.desc(rank) : "не изучено"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!maxed && <div className="text-[8px] text-dim flex-1 truncate">след: <span className="text-arc">{p.desc(rank + 1)}</span></div>}
                  {maxed && <div className="text-[8px] text-gold flex-1">макс</div>}
                  <button disabled={maxed || s.hero.skillPoints <= 0} onClick={() => d({ type: "LEVEL_PASSIVE", id: p.id })}
                    className="btn btn-arc w-7 h-7 grid place-items-center shrink-0">
                    <Icon n="plus" className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

