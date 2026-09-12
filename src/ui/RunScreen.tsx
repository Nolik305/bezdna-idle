import { useEffect, useRef, useState } from "react";
import { useGame } from "../game/useGame";
import { META, RUN_WAVES, RUN_BOSS_EVERY, SKILLS, CLASSES, ZONES } from "../game/data";
import { fmt, runStats } from "../game/logic";
import { Icon, Bar, SectionTitle } from "./bits";
import { MonsterArt, HeroArt } from "./art";

/* ---------- модалка итогов забега ---------- */
function RunOverModal() {
  const { s, d } = useGame();
  const m = s.modal;
  if (!m || m.t !== "runover") return null;
  const portal = s.run.kind === "portal";
  const c = m.win ? "#f0b429" : "#e5484d";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/80 backdrop-blur-[3px]">
      <div className="panel anim-pop w-full max-w-sm p-5 text-center relative overflow-hidden">
        <div className="absolute -top-14 inset-x-0 h-32 blur-2xl pointer-events-none" style={{ background: c + "26" }} />
        <div className="relative">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full grid place-items-center border-2 anim-float"
            style={{ borderColor: c + "66", color: c, background: c + "14", boxShadow: `0 0 24px ${c}44` }}>
            <Icon n={m.win ? "trophy" : "skull"} className="w-8 h-8" />
          </div>
          <h2 className="font-display text-2xl text-outline mb-1" style={{ color: c }}>
            {m.win ? (portal ? "ПОРТАЛ ПОКОРЁН!" : "БЕЗДНА ПОКОРЕНА!") : (portal ? "ПОРТАЛ ВЫПЛЮНУЛ ТЕБЯ" : "ЗАБЕГ ОКОНЧЕН")}
          </h2>
          <p className="text-dim text-xs mb-4">
            {m.win ? "Все 20 волн позади. Такое не забывают." : `Ты пал на волне ${m.wave}. Бездна подождёт.`}
          </p>
          <div className="flex justify-center gap-3 mb-5">
            <div className="panel px-4 py-3">
              <div className="font-display text-lg text-fog">{m.wave}<span className="text-dim text-xs">/{RUN_WAVES}</span></div>
              <div className="text-[10px] text-dim">волна</div>
            </div>
            {portal ? (
              <div className="panel px-4 py-3">
                <div className="font-display text-lg flex items-center gap-1" style={{ color: "#ff4d6d" }}>
                  <Icon n="gate" className="w-4 h-4" />{m.win ? "+сет" : "лут"}
                </div>
                <div className="text-[10px] text-dim">{m.win ? "Сет Бездны + 15 кр." : "что успел унести"}</div>
              </div>
            ) : (
              <div className="panel px-4 py-3">
                <div className="font-display text-lg text-mana flex items-center gap-1"><Icon n="shard" className="w-4 h-4" filled />{fmt(m.shards)}</div>
                <div className="text-[10px] text-dim">осколков</div>
              </div>
            )}
          </div>
          <button onClick={() => d({ type: "RUN_CLOSE" })} className="btn btn-gold w-full py-3.5 text-[15px]">ВЕРНУТЬСЯ</button>
          <p className="text-[10px] text-dim/70 mt-2">
            {portal ? "Сет Бездны уже в рюкзаке. Надень — почувствуй мощь." : "Осколки трать в Алтаре — бонусы остаются навсегда."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- активный забег ---------- */
function ActiveRun() {
  const { s, d } = useGame();
  const R = s.run;
  const e = R.enemy;
  const rs = runStats(s);
  const artRef = useRef<HTMLDivElement>(null);
  const prevHp = useRef(R.hp);
  const [heroFlash, setHeroFlash] = useState(0);
  const skills = SKILLS.filter(k => k.classId === s.hero.classId);
  const bossesAhead = RUN_WAVES / RUN_BOSS_EVERY;
  const portal = R.kind === "portal";
  const accent = portal ? "#ff4d6d" : "#3fd0b6";
  const runTier = portal ? ZONES.length - 1 : Math.min(Math.floor((R.wave - 1) / RUN_BOSS_EVERY), ZONES.length - 2);

  useEffect(() => {
    const f = R.hp < prevHp.current ? 1 : 0;
    if (f) setHeroFlash(x => x + 1);
    prevHp.current = R.hp;
  }, [R.hp]);

  return (
    <div className="flex flex-col gap-3">
      {/* прогресс забега */}
      <div className="panel px-3 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-display text-[12px] tracking-wider" style={{ color: accent }}>
            {portal ? "ПОРТАЛ БЕЗДНЫ" : "ЭКСПЕДИЦИЯ"}
          </span>
          <span className="text-[11px] text-dim tabular-nums">Волна <b className="text-fog">{R.wave}</b>/{RUN_WAVES}</span>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: bossesAhead }).map((_, i) => {
            const bossWave = (i + 1) * RUN_BOSS_EVERY;
            const done = R.wave > bossWave;
            const cur = R.wave <= bossWave && R.wave > i * RUN_BOSS_EVERY;
            return (
              <div key={i} className="flex-1 flex items-center gap-1">
                <div className="flex-1 h-1.5 rounded-full" style={{ background: done ? accent : cur ? accent + "80" : "#27313f99" }} />
                <Icon n="skull" className={`w-4 h-4 shrink-0 ${done ? "text-blood" : cur ? "text-fog" : "text-dim/40"}`} filled={done} />
              </div>
            );
          })}
        </div>
        <div className="text-[9px] text-dim/80 mt-1 text-right">боссы на 5 · 10 · 15 · 20</div>
      </div>

      {/* арена: герой против твари */}
      <div className="panel relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: portal
            ? "radial-gradient(420px 240px at 50% 30%, rgba(255,77,109,0.14), transparent 70%)"
            : "radial-gradient(420px 240px at 50% 30%, rgba(63,208,182,0.12), transparent 70%)" }} />
        <div className="relative px-4 pt-3 flex items-center justify-between">
          <span className="font-display text-[13px] tracking-wide" style={{ color: accent }}>
            {portal ? "ВНУТРИ ПОРТАЛА" : "РАЗЛОМ БЕЗДНЫ"}
          </span>
          <span className="text-[10px] text-dim italic">фарм на паузе</span>
        </div>
        <div className="relative h-48">
          <div className="absolute inset-0 flex items-center justify-between px-3">
            {/* герой */}
            <div key={"hf" + heroFlash} className={`w-28 h-36 ${heroFlash ? "anim-redflash" : ""}`}>
              <div style={{ animation: `lungeR ${Math.max(0.3, 1 / rs.as)}s ease-in-out infinite` }}>
                <div className="h-32"><HeroArt classId={s.hero.classId} equip={s.equip} /></div>
              </div>
            </div>
            <span className="font-display text-dim/25 text-xl select-none">VS</span>
            {/* враг */}
            {e && (
              <>
                <div className="absolute bottom-5 right-8 w-32 h-5 rounded-full pointer-events-none"
                  style={{ background: `radial-gradient(closest-side, ${accent}44, transparent 75%)`, filter: "blur(2px)" }} />
                <div ref={artRef} className={e.boss ? "w-40 h-40" : "w-32 h-32"}>
                  <div style={{ animation: `lungeL ${Math.max(0.4, 1 / e.as)}s ease-in-out infinite` }}>
                    <MonsterArt k={e.key} boss={e.boss} zone={runTier} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="relative px-4 pb-3">
          {e && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-display text-[14px] text-fog truncate">{e.name}</span>
                {e.boss && <span className="shrink-0 text-[9px] font-display tracking-widest text-blood bg-blood/15 border border-blood/50 px-1.5 py-0.5 rounded-md">БОСС</span>}
                <span className="ml-auto text-[11px] text-dim tabular-nums">{fmt(Math.max(0, e.hp))}/{fmt(e.maxHp)}</span>
              </div>
              <Bar v={e.hp} max={e.maxHp} color={e.boss ? "#e5484d" : "#ff6b3d"} h="h-4" shine />
            </>
          )}
          <div className="mt-2">
            <div className="flex justify-between text-[10px] text-dim mb-0.5">
              <span>{s.hero.name} · HP</span><span className="tabular-nums">{fmt(Math.max(0, R.hp))}/{fmt(rs.maxHp)}</span>
            </div>
            <Bar v={R.hp} max={rs.maxHp} color={R.hp / rs.maxHp < 0.3 ? "#e5484d" : "#4ade80"} h="h-3" shine />
          </div>
        </div>
      </div>

      {/* скилы (авто-каст, некликабельно) */}
      <div className="grid grid-cols-4 gap-2">
        {skills.map(sk => {
          const cd = R.cds[sk.id] || 0;
          const locked = s.hero.level < sk.unlockLevel;
          return (
            <div key={sk.id}
              className="relative btn btn-dark py-2.5 px-1 h-[64px] flex flex-col items-center justify-center gap-0.5 overflow-hidden select-none"
              title={`${sk.name} — авто-каст`}>
              <Icon n={sk.icon} className="w-5 h-5" style={{ color: locked ? "#8b98a9" : accent } as never} />
              <span className="text-[8px] text-fog font-body font-semibold text-center leading-tight px-0.5">{sk.name}</span>
              {!locked && cd > 0 && (
                <span className="absolute inset-x-0 bottom-0 bg-abyss/85 border-t border-line flex items-end justify-center pointer-events-none"
                  style={{ height: (cd / sk.cd) * 100 + "%" }}>
                  <span className="text-[10px] font-display text-fog pb-0.5">{cd.toFixed(1)}</span>
                </span>
              )}
              {locked && <span className="absolute inset-0 bg-abyss/80 grid place-items-center text-dim"><Icon n="lock" className="w-4 h-4" /></span>}
            </div>
          );
        })}
        <button onClick={() => d({ type: "RUN_USE_POTION" })} disabled={s.hero.potions <= 0}
          className="btn btn-dark py-2.5 px-1 h-[64px] flex flex-col items-center justify-center gap-0.5"
          style={s.hero.potions > 0 ? { borderColor: accent + "66" } : undefined}>
          <Icon n="flask" className="w-5 h-5" style={{ color: accent } as never} />
          <span className="text-[8px] text-fog font-body font-semibold">Зелье</span>
          <span className="text-[10px] font-body font-bold" style={{ color: accent }}>×{s.hero.potions}</span>
        </button>
      </div>

      <button onClick={() => d({ type: "ABANDON_RUN" })} className="btn btn-dark w-full py-2.5 text-[12px] flex items-center justify-center gap-1.5 text-dim">
        <Icon n="x" className="w-4 h-4" />{portal ? "Сбежать из Портала (лут с собой)" : "Сдаться (половина осколков)"}
      </button>
    </div>
  );
}

/* ---------- стартовый экран ---------- */
function StartScreen() {
  const { s, d } = useGame();
  const [selectedDepth, setSelectedDepth] = useState(1);
  const hasBlood = s.blood > 0;
  const depth = Math.min(selectedDepth, s.portalDepth);
  return (
    <>
      {/* Экспедиция */}
      <div className="panel p-4 relative overflow-hidden">
        <div className="absolute -top-16 -right-12 w-44 h-44 rounded-full bg-arc/12 blur-2xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Icon n="route" className="w-6 h-6 text-arc" />
            <h2 className="font-display text-xl text-fog text-outline">ЭКСПЕДИЦИЯ В БЕЗДНУ</h2>
          </div>
          <p className="text-[12px] text-dim leading-relaxed mb-3">
            Рогалик-режим: 20 волн, босс каждые 5. После каждого босса герой автоматически получает случайный Дар —
            собирай билд. Падёшь — забег сгорает, но осколки остаются.
          </p>
          <div className="flex gap-3 mb-4">
            <div className="flex-1 bg-abyss/60 border border-line/60 rounded-xl py-2.5 text-center">
              <div className="font-display text-lg text-arc">{s.bestWave}<span className="text-dim text-xs">/{RUN_WAVES}</span></div>
              <div className="text-[9px] text-dim">рекорд волны</div>
            </div>
            <div className="flex-1 bg-abyss/60 border border-line/60 rounded-xl py-2.5 text-center">
              <div className="font-display text-lg text-mana flex items-center justify-center gap-1"><Icon n="shard" className="w-4 h-4" filled />{fmt(s.shards)}</div>
              <div className="text-[9px] text-dim">осколки бездны</div>
            </div>
            <div className="flex-1 bg-abyss/60 border border-line/60 rounded-xl py-2.5 text-center">
              <div className="font-display text-lg flex items-center justify-center gap-1" style={{ color: "#ff4d6d" }}>
                <Icon n="drop" className="w-4 h-4" filled />{s.blood}
              </div>
              <div className="text-[9px] text-dim">кровь демона</div>
            </div>
          </div>
          <button onClick={() => d({ type: "START_RUN", kind: "exp" })} className="btn btn-arc w-full py-3.5 text-[15px]">
            НАЧАТЬ ЭКСПЕДИЦИЮ
          </button>
          <p className="text-[10px] text-dim/70 mt-2 text-center">С боссов Экспедиции редко капает Кровь Демона (7%) — ключ к Порталу.</p>
        </div>
      </div>

      {/* Портал Бездны */}
      <div className="panel p-4 relative overflow-hidden" style={{ borderColor: hasBlood ? "#ff4d6d55" : undefined }}>
        <div className="absolute -top-16 -left-12 w-44 h-44 rounded-full blur-2xl pointer-events-none" style={{ background: "rgba(255,77,109,0.12)" }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <span className={hasBlood ? "anim-portal inline-flex" : "inline-flex"}><Icon n="gate" className="w-6 h-6" style={{ color: "#ff4d6d" } as never} /></span>
            <h2 className="font-display text-xl text-fog text-outline">ПОРТАЛ БЕЗДНЫ</h2>
            {s.run.kind === "portal" && <span className="text-[9px] font-display text-[#ff4d6d] border border-[#ff4d6d55] rounded px-1">активен</span>}
          </div>
          <p className="text-[12px] text-dim leading-relaxed mb-3">
            Тот же рогалик, но злее: твари Бездны, жирнее золото, а с боссов падает
            <b style={{ color: "#ff4d6d" }}> Сет Бездны</b> (редкость «Бездна») — 7 вещей с бонусом за комплект.
            Победа даёт <b className="text-mana">15 кристаллов</b> и ещё одну вещь сета.
          </p>
          {hasBlood ? (
            <>
              <div className="mb-2">
                <div className="text-[10px] text-dim mb-1.5">Открытая глубина: {s.portalDepth}</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {Array.from({ length: Math.min(s.portalDepth, 8) }, (_, index) => index + 1).map(level => (
                    <button key={level} onClick={() => setSelectedDepth(level)}
                      className={`rounded-lg border py-1.5 text-[10px] font-display ${depth === level ? "border-[#ff4d6d] bg-[#ff4d6d22] text-[#ff6b8d]" : "border-line/60 text-dim"}`}>
                      БЕЗДНА {level}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => d({ type: "START_RUN", kind: "portal", depth })} className="btn btn-ember w-full py-3.5 text-[15px] flex items-center justify-center gap-2">
                <Icon n="drop" className="w-4 h-4" filled />ВОЙТИ В ПОРТАЛ {depth} (−1 кровь)
              </button>
            </>
          ) : (
            <div className="border border-[#ff4d6d33] rounded-xl p-3 text-center bg-[#ff4d6d0a]">
              <div className="flex items-center justify-center gap-1.5 text-[#ff4d6d] font-display text-[13px] mb-1">
                <Icon n="lock" className="w-4 h-4" />ПРОХОД ЗАПЕЧАТАН
              </div>
              <p className="text-[10px] text-dim">Нужна <b style={{ color: "#ff4d6d" }}>Кровь Демона</b>. Выбивай боссов в Экспедиции — шанс ~7% с каждого.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------- главный экран ---------- */
export function RunScreen() {
  const { s, d } = useGame();
  if (s.run.active) {
    return (
      <>
        <ActiveRun />
        <RunOverModal />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <RunOverModal />
      <StartScreen />

      {/* Алтарь */}
      <div className="panel p-3">
        <SectionTitle icon="shard" right={<span className="text-[10px] text-mana flex items-center gap-1"><Icon n="shard" className="w-3.5 h-3.5" filled />{fmt(s.shards)}</span>}>
          АЛТАРЬ БЕЗДНЫ
        </SectionTitle>
        <p className="text-[10px] text-dim mb-2.5">Постоянные бонусы за осколки. Работают везде — и в фарме, и в забегах.</p>
        <div className="flex flex-col gap-2">
          {META.map(mdef => {
            const rank = s.meta[mdef.id] || 0;
            const maxed = rank >= mdef.max;
            const cost = mdef.cost(rank);
            const afford = s.shards >= cost;
            return (
              <div key={mdef.id} className="bg-abyss/60 border border-line/60 rounded-xl p-3 flex items-center gap-2.5">
                <div className="w-10 h-10 shrink-0 rounded-lg grid place-items-center border border-mana/40 bg-mana/8 text-mana">
                  <Icon n={mdef.icon} className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-[12px] text-fog flex items-center gap-1.5">
                    {mdef.name}
                    <span className="text-[9px] text-mana font-body">ур. {rank}/{mdef.max}</span>
                  </div>
                  <div className="text-[10px] text-dim">{maxed ? mdef.desc(rank) : mdef.desc(rank + 1)}</div>
                  {!maxed && <Bar v={rank} max={mdef.max} color="#4cc3ff" h="h-1" className="mt-1.5" />}
                </div>
                <button disabled={maxed || !afford} onClick={() => d({ type: "BUY_META", id: mdef.id })}
                  className="btn btn-arc px-2.5 py-2 text-[10px] shrink-0 flex items-center gap-1">
                  {maxed ? "МАКС" : <><Icon n="shard" className="w-3 h-3" filled />{fmt(cost)}</>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
