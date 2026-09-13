import { useState } from "react";
import { useGame } from "../game/useGame";
import { CLASSES, RARITY, INV_CAP, SLOT_UP_BONUS, SLOT_UP_MAX, slotUpCost, VIP_LEVELS, GODSTONE, ABYSS_SET_BONUS, ASCENDANCIES, ATLAS_NODES, ATLAS_BRANCHES, STAT_LABEL, SHARPEN_COST_GOLD, sharpenChance, SHARPEN_STONES } from "../game/data";
import { fmt, xpNeed, atlasPointsForHeroLevel, atlasPointsSpent, SLOTS, equipDelta } from "../game/logic";
import { Icon, ItemRow, slotIcon, SectionTitle, rarColor, Bar } from "./bits";
import { itemSprite } from "../game/sprites";
import { HeroArt } from "./art";
import type { Slot } from "../game/types";

const SLOT_LABEL: Record<Slot, string> = {
  weapon: "Оружие", helm: "Шлем", amulet: "Амулет", armor: "Доспех",
  gloves: "Перчатки", boots: "Сапоги", ring1: "Кольцо", ring2: "Кольцо 2",
};

function SlotBox({ slot }: { slot: Slot }) {
  const { s } = useGame();
  const [show, setShow] = useState(false);
  const it = s.equip[slot];
  const c = it ? rarColor(it.rarity) : "#3a4656";
  return (
    <>
      <button
        onClick={() => it && setShow(true)}
        className="w-14 h-14 rounded-xl border grid place-items-center relative transition-all duration-150 shrink-0"
        style={{
          borderColor: c + "66",
          color: it ? c : "#3a4656",
          background: it ? `linear-gradient(160deg, ${c}22, ${c}08)` : "rgba(11,14,19,0.6)",
          boxShadow: it && it.rarity >= 3 ? `0 0 12px ${c}44` : undefined,
        }}>
        {it
          ? <img src={itemSprite(it)} alt={it.name} draggable={false} className="w-10 h-10 object-contain" />
          : <Icon n={slotIcon(slot, s.hero.classId)} className="w-6 h-6" />}
        {it && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />}
        {(s.slotLevel[slot] || 0) > 0 && (
          <span className="absolute -top-1.5 -left-1.5 text-[8px] font-display px-1 py-px rounded-md bg-gold text-ink border border-ink leading-none"
            style={{ boxShadow: "0 0 8px rgba(240,180,41,0.55)" }}>
            +{s.slotLevel[slot]}
          </span>
        )}
        <span className="absolute -bottom-0.5 inset-x-0 text-center text-[8px] text-dim leading-none">{SLOT_LABEL[slot]}</span>
        <span className="sr-only">{it?.name ?? SLOT_LABEL[slot]}</span>
      </button>
      {show && it && <ItemPopup slot={slot} onClose={() => setShow(false)} />}
    </>
  );
}

/** Попап с характеристиками надетого предмета (что даёт шмотка). */
function ItemPopup({ slot, onClose }: { slot: Slot; onClose: () => void }) {
  const { s, d } = useGame();
  const it = s.equip[slot];
  if (!it) return null;
  const c = rarColor(it.rarity);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(0,0,0,0.62)" }} onClick={onClose}>
      <div className="panel p-4 w-full max-w-xs" onClick={e => e.stopPropagation()}>
        <div className="w-16 h-16 mx-auto mb-2 rounded-xl grid place-items-center overflow-hidden border"
          style={{ background: `linear-gradient(160deg, ${c}22, ${c}08)`, borderColor: c + "55", boxShadow: it.rarity >= 3 ? `0 0 16px ${c}44` : undefined }}>
          <img src={itemSprite(it)} alt={it.name} draggable={false} className="w-12 h-12 object-contain" />
        </div>
        <div className="text-center text-[15px] font-display leading-tight" style={{ color: c }}>{it.name}</div>
        <div className="text-center text-[11px] text-dim mt-0.5">
          <span style={{ color: c }}>{RARITY[it.rarity].name}</span> · мощь {it.ilvl} · {SLOT_LABEL[slot]}
        </div>
        <div className="mt-2.5 flex flex-col gap-1.5">
          {Object.entries(it.stats).map(([k, v]) => (
            <div key={k} className="flex justify-between text-[12px]">
              <span className="text-fog">{STAT_LABEL[k as keyof typeof STAT_LABEL]}</span>
              <span className="text-mana font-semibold">+{v}</span>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-dim mt-2.5">Продажа: {it.sell} зол. · заточка слота +{s.slotLevel[slot] || 0} ур.</div>
        <div className="flex gap-2 mt-3">
          <button onClick={() => { d({ type: "UNEQUIP", slot }); onClose(); }} className="btn btn-dark flex-1 py-2 text-[11px]">Снять</button>
          <button onClick={onClose} className="btn btn-arc flex-1 py-2 text-[11px]">Закрыть</button>
        </div>
      </div>
    </div>
  );
}

/** Заточка слотов: бонус живёт в слоте, а не в предмете */
function SharpenPanel() {
  const { s, d } = useGame();
  const [picked, setPicked] = useState<Record<string, number>>({});
  return (
    <div className="panel p-3">
      <SectionTitle icon="bolt" right={<span className="text-[9px] text-dim">+{SLOT_UP_BONUS}% к статам слота за ур.</span>}>
        ЗАТОЧКА СЛОТОВ
      </SectionTitle>
      <p className="text-[10px] text-dim/80 mb-2 leading-snug">
        Бонус привязан к <b className="text-fog">слоту</b>, а не к шмотке: надели новый предмет — заточка осталась. Работает только когда слот занят.
        Стоимость попытки: <b className="text-gold">{SHARPEN_COST_GOLD} золота</b> + <b className="text-fog">1 камень заточки</b>.
        Шанс зависит от <b className="text-fog">качества камня</b> и падает с уровнем заточки. Эпик и легендарный — дроп только в Бездне.
      </p>
      <div className="text-[10px] text-dim mb-2 flex flex-wrap gap-1">
        {SHARPEN_STONES.map((st, i) => (
          <span key={st.key} className="px-1.5 py-0.5 rounded-md border border-line/50" style={{ color: st.color }}>
            {st.name} {st.chance}%
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {SLOTS.map(slot => {
          const lvl = s.slotLevel[slot] || 0;
          const it = s.equip[slot];
          const max = lvl >= SLOT_UP_MAX;
          const pick = picked[slot] ?? 0;
          const st = SHARPEN_STONES[pick];
          const have = s.resources[st.key] || 0;
          const chance = it ? sharpenChance(pick, lvl) : 0;
          const afford = s.hero.gold >= SHARPEN_COST_GOLD && have >= 1 && !!it;
          return (
            <div key={slot} className="bg-abyss/60 border border-line/60 rounded-lg px-2.5 py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-gold/80"><Icon n={slotIcon(slot, s.hero.classId)} className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-fog font-semibold flex items-center gap-1.5">
                    {SLOT_LABEL[slot]}
                    {lvl > 0 && <span className="text-[9px] font-display text-gold">+{lvl}</span>}
                  </div>
                  <div className="text-[9px] text-dim truncate">
                    {it ? <>«{it.name}» · бонус +{SLOT_UP_BONUS * lvl}% · шанс <span style={{ color: st.color }}>{chance}%</span></> : "слот пуст — заточка ждёт предмет"}
                  </div>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                {SHARPEN_STONES.map((stone, i) => {
                  const c = sharpenChance(i, lvl);
                  const on = pick === i;
                  return (
                    <button key={stone.key} disabled={!it || (s.resources[stone.key] || 0) < 1}
                      onClick={() => setPicked(p => ({ ...p, [slot]: i }))}
                      className={`px-1.5 py-0.5 rounded-md border text-[9px] transition-colors ${on ? "border-gold text-gold" : "border-line/50 text-dim"}`}
                      style={!on ? { color: stone.color, borderColor: "#ffffff22" } : undefined}>
                      {stone.name} · {c}%
                    </button>
                  );
                })}
              </div>
              <button disabled={max || !afford} onClick={() => d({ type: "UPGRADE_SLOT", slot, stone: pick })}
                className="btn btn-dark px-2.5 py-1.5 text-[10px] shrink-0 mt-1.5 w-full"
                style={afford && !max ? { borderColor: "#f0b42955" } : undefined}>
                {max ? "MAX"
                  : <span className="flex items-center justify-center gap-1">
                      <Icon n="coin" className="w-3 h-3 text-gold" filled />{SHARPEN_COST_GOLD}
                      <span className="text-[10px]">🪨</span>{have}
                      <span className="text-gold ml-1">Точить ({chance}%)</span>
                    </span>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Камень Бога: бесконечная шкала, растит ВСЕ статы, до капа не добраться */
function GodstonePanel() {
  const { s, d } = useGame();
  const gs = s.godstone;
  if (gs == null) {
    return (
      <div className="panel p-3 relative overflow-hidden">
        <div className="absolute -top-10 -right-8 w-32 h-32 rounded-full blur-2xl pointer-events-none" style={{ background: "rgba(251,191,36,0.12)" }} />
        <div className="relative">
          <SectionTitle icon="stone" right={<span className="text-[9px] text-dim">артефакт</span>}>КАМЕНЬ БОГА</SectionTitle>
          <p className="text-[10px] text-dim/80 mb-2 leading-snug">
            Пробуди реликвию — и точи её до бесконечности: <b className="text-fog">каждый уровень усиливает ВСЕ характеристики</b>.
            Чем выше уровень, тем меньше шанс успеха. Капа не существует.
          </p>
          <button disabled={s.hero.gems < GODSTONE.price} onClick={() => d({ type: "BUY_GODSTONE" })}
            className="btn btn-gold w-full py-2.5 text-[13px] flex items-center justify-center gap-1.5">
            <Icon n="gem" className="w-4 h-4" filled />ПРОБУДИТЬ ЗА {GODSTONE.price}
          </button>
        </div>
      </div>
    );
  }
  const cost = GODSTONE.cost(gs);
  const chance = GODSTONE.chance(gs);
  const afford = s.hero.gold >= cost;
  return (
    <div className="panel p-3 relative overflow-hidden" style={{ borderColor: "rgba(251,191,36,0.35)" }}>
      <div className="absolute -top-10 -right-8 w-36 h-36 rounded-full blur-2xl pointer-events-none" style={{ background: "rgba(251,191,36,0.16)" }} />
      <div className="relative">
        <SectionTitle icon="stone"
          right={<span className="text-[10px] font-display text-gold">ур. {gs} · ∞</span>}>
          КАМЕНЬ БОГА
        </SectionTitle>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-14 h-14 shrink-0 rounded-xl grid place-items-center border anim-float"
            style={{ borderColor: "#fbbf2466", background: "linear-gradient(160deg, rgba(251,191,36,0.2), rgba(251,191,36,0.04))", color: "#fbbf24", boxShadow: "0 0 18px rgba(251,191,36,0.25)" }}>
            <Icon n="stone" className="w-8 h-8" />
          </div>
          <div className="flex-1 text-[10px] text-dim leading-relaxed">
            Сейчас даёт: <b className="text-gold">+{6 * gs}% урона и HP</b>, +{4 * gs}% золота/опыта,
            +{(1.2 * gs).toFixed(1)}% крита, +{(1.5 * gs).toFixed(1)}% скорости, +{2 * gs}% удачи и др.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="flex justify-between text-[9px] text-dim mb-1">
              <span>шанс успеха</span><span className="font-bold" style={{ color: chance > 50 ? "#4ade80" : chance > 15 ? "#f0b429" : "#e5484d" }}>{chance}%</span>
            </div>
            <Bar v={chance} max={100} color={chance > 50 ? "#4ade80" : chance > 15 ? "#f0b429" : "#e5484d"} h="h-1.5" />
          </div>
          <button disabled={!afford} onClick={() => d({ type: "UP_GODSTONE" })}
            className="btn btn-gold px-3 py-2 text-[11px] shrink-0 flex items-center gap-1">
            <Icon n="coin" className="w-3.5 h-3.5" filled />{fmt(cost)}
          </button>
        </div>
        <p className="text-[9px] text-dim/70 mt-1.5">При неудаче золото сгорает, уровень стоит на месте. Риск — дело благородное.</p>
      </div>
    </div>
  );
}

function AtlasPathPanel() {
  const { s, d } = useGame();
  const [branch, setBranch] = useState<"dmg" | "life" | "loot">("dmg");
  const progress = { cur: s.hero.xp, need: xpNeed(s.hero.level) };
  const avail = atlasPointsForHeroLevel(s.hero.level);
  const spent = atlasPointsSpent(s.atlas || {});
  const selAsc = ASCENDANCIES.find(p => p.id === s.path);
  const classAsc = ASCENDANCIES.filter(p => p.classId === s.hero.classId);
  const branchDef = ATLAS_BRANCHES.find(b => b.id === branch)!;
  const nodes = ATLAS_NODES.filter(n => n.branch === branch);
  return (
    <div className="panel p-3">
      <SectionTitle icon="map" right={<span className="text-[9px] text-dim tabular-nums">{spent}/{avail} очк.</span>}>АТЛАС</SectionTitle>
      <p className="text-[10px] text-dim/80 mb-2.5 leading-snug">
        Восхождение задаёт стиль, ветки — твою сборку. Очки атласа: 1 за уровень героя. Всё взять нельзя — выбирай.
      </p>

      {/* восхождение */}
      <div className="mb-3">
        <div className="text-[10px] text-dim mb-1">ВОСХОЖДЕНИЕ</div>
        {!s.path && <div className="text-[10px] text-ember mb-1.5">Выбери восхождение — оно определит стиль игры.</div>}
        <div className="grid grid-cols-2 gap-1.5">
          {classAsc.map(asc => {
            const active = asc.id === s.path;
            return (
              <button key={asc.id} disabled={active} onClick={() => d({ type: "CHOOSE_PATH", id: asc.id })}
                className="rounded-lg border p-2 text-left transition-all disabled:opacity-60"
                style={{ borderColor: active ? asc.color : asc.color + "44", background: active ? asc.color + "18" : "transparent" }}>
                <div className="flex items-center gap-1.5 text-[11px] font-display" style={{ color: asc.color }}>
                  <Icon n={asc.icon} className="w-3.5 h-3.5" />{asc.name}
                </div>
                <div className="text-[8px] text-dim mt-0.5 leading-snug">{asc.desc}</div>
                <div className="text-[9px] text-dim mt-0.5">{active ? "выбрано" : "сменить свободно"}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ветки */}
      <div className="grid grid-cols-3 gap-1.5 mb-2.5">
        {ATLAS_BRANCHES.map(b => (
          <button key={b.id} onClick={() => setBranch(b.id)}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition ${branch === b.id ? "border bg-gold/10" : "border border-transparent"}`}
            style={branch === b.id ? { borderColor: b.color + "66", color: b.color } : { color: "#8b98a9" }}>
            <Icon n={b.icon} className="w-3.5 h-3.5" /><span className="text-[10px] font-display">{b.name}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-2.5">
        <Bar v={progress.cur} max={progress.need} color={branchDef.color} h="h-2" className="flex-1" />
        <span className="text-[9px] text-dim tabular-nums">{fmt(progress.cur)}/{fmt(progress.need)} XP · ур. героя {s.hero.level}</span>
      </div>

      <div className="text-[10px] text-dim mb-1" style={{ color: branchDef.color }}>ВЕТКА «{branchDef.name.toUpperCase()}»</div>
      <div className="flex flex-col gap-1.5">
        {nodes.map(n => {
          const rank = s.atlas?.[n.id] || 0;
          const maxed = rank >= n.max;
          return (
            <div key={n.id} className={`rounded-lg border px-2.5 py-2 flex items-center gap-2 ${maxed ? "border-gold/50 bg-gold/5" : "border-line/60 bg-abyss/40"}`}>
              <div className="w-7 h-7 shrink-0 rounded-lg grid place-items-center border text-[11px]"
                style={{ color: branchDef.color, borderColor: branchDef.color + "44", background: branchDef.color + "10" }}>
                <Icon n={n.icon} className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-[11px] text-fog">{n.name}</span>
                  <span className="flex gap-[3px]">
                    {Array.from({ length: n.max }).map((_, i) => (
                      <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < rank ? "" : "bg-line"}`} style={i < rank ? { background: branchDef.color } : undefined} />
                    ))}
                  </span>
                </div>
                <div className="text-[9px] text-dim truncate">{n.desc}</div>
              </div>
              <button disabled={maxed || spent >= avail} onClick={() => d({ type: "ATLAS_UP", id: n.id })}
                className="btn btn-arc w-7 h-7 grid place-items-center shrink-0">
                <Icon n="plus" className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HeroTab() {
  const { s, stats } = useGame();
  const cls = CLASSES[s.hero.classId];
  const ascendancy = ASCENDANCIES.find(item => item.id === s.path);
  const buffList = s.buffs;
  const abyssWorn = SLOTS.filter(sl => s.equip[sl]?.abyss).length;
  const rows: { l: string; v: string; c?: string }[] = [
    { l: "Урон", v: fmt(stats.dmg), c: "#ff6b3d" },
    { l: "DPS", v: fmt(stats.dps), c: "#f0b429" },
    { l: "Атак в сек", v: stats.as.toFixed(2), c: "#3fd0b6" },
    { l: "Крит шанс", v: stats.crit.toFixed(1) + "%", c: "#4cc3ff" },
    { l: "Крит урон", v: stats.critDmg.toFixed(0) + "%", c: "#4cc3ff" },
    { l: "Здоровье", v: fmt(stats.maxHp), c: "#e5484d" },
    { l: "Броня", v: `${fmt(stats.armor)} (${(stats.mit * 100).toFixed(0)}%)`, c: "#9aa4b2" },
    { l: "Реген HP", v: stats.regen.toFixed(2) + "%/с", c: "#4ade80" },
    { l: "Вампиризм", v: stats.lifesteal.toFixed(1) + "% урона", c: "#ff6b8d" },
    { l: "Уклонение", v: stats.dodge.toFixed(1) + "%", c: "#c084fc" },
    { l: "Урон DoT", v: (stats.dotPct * 100).toFixed(0) + "%/с", c: "#ff6b3d" },
    { l: "Сокращение КД", v: stats.cooldownPct.toFixed(0) + "%", c: "#4cc3ff" },
    { l: "Урон автокаста", v: "+" + stats.extraSkillDamagePct.toFixed(0) + "%", c: "#4ade80" },
    { l: "Золото", v: "+" + stats.goldPct.toFixed(0) + "%", c: "#f0b429" },
    { l: "Опыт", v: "+" + stats.xpPct.toFixed(0) + "%", c: "#3fd0b6" },
    { l: "Удача (дроп)", v: "+" + stats.luck.toFixed(0) + "%", c: "#c084fc" },
    { l: "Офлайн доход", v: fmt(stats.offline) + " зол./с", c: "#f0b429" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="panel p-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg grid place-items-center border" style={{ borderColor: cls.color + "66", color: cls.color, background: cls.color + "15" }}>
            <Icon n={s.hero.classId === "mage" ? "staff" : "bow"} className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="font-display text-[15px] text-fog leading-tight flex items-center gap-1.5">
              {s.hero.name}
              {s.vip > 0 && VIP_LEVELS[Math.min(s.vip, VIP_LEVELS.length) - 1] && (
                <span className="text-[8px] font-display px-1 py-px rounded border leading-none"
                  style={{ color: VIP_LEVELS[Math.min(s.vip, VIP_LEVELS.length) - 1].color, borderColor: VIP_LEVELS[Math.min(s.vip, VIP_LEVELS.length) - 1].color + "66", background: VIP_LEVELS[Math.min(s.vip, VIP_LEVELS.length) - 1].color + "1a" }}>
                  VIP {s.vip}
                </span>
              )}
            </div>
            <div className="text-[10px] text-dim">{cls.name} · «{cls.title}» · {s.hero.level} уровень</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-dim">Очки навыков</div>
            <div className="font-display text-lg text-gold leading-none">{s.hero.skillPoints}</div>
          </div>
        </div>
      </div>

      <div className="panel p-3" style={{ borderColor: (ascendancy?.color ?? cls.color) + "66" }}>
        <div className="flex items-center gap-2">
          <Icon n={ascendancy?.icon ?? "map"} className="w-5 h-5" style={{ color: ascendancy?.color ?? cls.color } as never} />
          <div>
            <div className="text-[9px] tracking-[0.2em] text-dim">АКТИВНОЕ ВОСХОЖДЕНИЕ</div>
            <div className="font-display text-[14px]" style={{ color: ascendancy?.color ?? cls.color }}>
              {ascendancy?.name ?? "Не выбрано"}
            </div>
          </div>
        </div>
        <div className="text-[10px] text-dim mt-1.5">
          {ascendancy?.desc ?? "Выбери подкласс в разделе Атлас, чтобы получить уникальные боевые эффекты."}
        </div>
        <div className="text-[9px] text-dim/80 mt-1">Вампиризм лечит от нанесённого урона; DoT наносит урон каждую секунду.</div>
      </div>

      <div className="flex items-stretch gap-2">
        <div className="flex flex-col gap-2 justify-center">
          {(["weapon", "gloves", "ring1"] as Slot[]).map(sl => <SlotBox key={sl} slot={sl} />)}
        </div>
        <div className="flex-1 panel relative overflow-hidden min-h-[210px]">
          <div className="absolute inset-0" style={{ background: `radial-gradient(220px 160px at 50% 40%, ${cls.color}18, transparent 70%)` }} />
          <div className="relative h-[210px] p-1">
            <HeroArt classId={s.hero.classId} equip={s.equip} />
          </div>
          <div className="absolute bottom-1.5 inset-x-0 text-center text-[9px] text-dim">
            Надето {SLOTS.filter(sl => s.equip[sl]).length}/8 · тап по шмотке = снять
          </div>
        </div>
        <div className="flex flex-col gap-2 justify-center">
          {(["helm", "armor", "amulet"] as Slot[]).map(sl => <SlotBox key={sl} slot={sl} />)}
        </div>
      </div>
      <div className="flex justify-center gap-2">
        {(["ring2", "boots"] as Slot[]).map(sl => <SlotBox key={sl} slot={sl} />)}
      </div>

      {abyssWorn > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border"
          style={{ borderColor: "#ff4d6d55", background: "rgba(255,77,109,0.08)" }}>
          <Icon n="gate" className="w-4 h-4" style={{ color: "#ff4d6d" }} />
          <span className="text-[11px] font-bold" style={{ color: "#ff4d6d" }}>Сет Бездны: {abyssWorn}/8</span>
          <span className="text-[10px] text-dim">+{ABYSS_SET_BONUS * abyssWorn}% урона, HP и +{2 * abyssWorn}% удачи</span>
        </div>
      )}

      <SharpenPanel />
      <AtlasPathPanel />
      <GodstonePanel />

      {buffList.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {buffList.map(b => (
            <span key={b.id} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-arc/10 border border-arc/40 text-arc flex items-center gap-1">
              <Icon n="spark" className="w-3 h-3" />{b.label} · {Math.ceil(b.t)}с
            </span>
          ))}
        </div>
      )}

      <div className="panel p-3">
        <SectionTitle icon="bolt">ХАРАКТЕРИСТИКИ</SectionTitle>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {rows.map(r => (
            <div key={r.l} className="flex items-baseline justify-between border-b border-line/40 pb-1">
              <span className="text-[11px] text-dim">{r.l}</span>
              <span className="text-[12px] font-bold tabular-nums" style={{ color: r.c }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-3">
        <SectionTitle icon="trophy">ПОСЛУЖНОЙ СПИСОК</SectionTitle>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { l: "Побед", v: fmt(s.totals.kills) },
            { l: "Боссов", v: fmt(s.totals.bosses) },
            { l: "Критов", v: fmt(s.totals.crits) },
            { l: "Смертей", v: fmt(s.totals.deaths) },
            { l: "Лута найдено", v: fmt(s.totals.items) },
            { l: "Макс волна", v: fmt(s.totals.maxWave) },
          ].map(x => (
            <div key={x.l} className="bg-abyss/60 border border-line/50 rounded-lg py-2">
              <div className="font-display text-[15px] text-fog">{x.v}</div>
              <div className="text-[9px] text-dim">{x.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function InventoryTab() {
  const { s, d } = useGame();
  const items = [...s.inv].sort((a, b) => b.rarity - a.rarity || b.ilvl - a.ilvl);
  const junkCount = s.inv.filter(i => i.rarity === 0).length;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="panel px-3 py-2.5 flex items-center gap-2">
        <Icon n="bag" className="w-5 h-5 text-gold" />
        <div className="flex-1">
          <div className="font-display text-[13px] text-fog">РЮКЗАК</div>
          <div className="text-[10px] text-dim">{s.inv.length} / {INV_CAP} · переполнение = автопродажа</div>
        </div>
        <button onClick={() => d({ type: "SELL_JUNK" })} disabled={junkCount === 0} className="btn btn-dark px-3 py-2 text-[11px]">
          Хлам ({junkCount})
        </button>
      </div>

      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="font-display text-[12px] text-fog">АВТОПРОДАЖА ЛУТА</div>
            <div className="text-[10px] text-dim">Выбранные редкости продаются сразу за 50% цены.</div>
          </div>
          <Icon n="coin" className="w-4 h-4 text-gold" filled />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {RARITY.map((rarity, index) => {
            const checked = !!s.autoSellRarities?.[String(index)];
            return (
              <label key={rarity.name} className="flex items-center gap-2 rounded-lg border border-line/60 bg-abyss/60 px-2.5 py-2 cursor-pointer">
                <input type="checkbox" checked={checked} onChange={() => d({ type: "TOGGLE_AUTO_SELL", rarity: index })} className="accent-gold" />
                <span className="text-[10px] font-semibold" style={{ color: rarity.color }}>{rarity.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      {items.length === 0 && (
        <div className="panel p-6 text-center">
          <Icon n="bag" className="w-8 h-8 text-dim/40 mx-auto mb-2" />
          <p className="text-dim text-xs">Пусто, как в кошельке барда.<br />Идите в поход — лут сам себя не поднимет.</p>
        </div>
      )}

      {items.map(it => (
        <ItemRow key={it.uid} it={it} delta={equipDelta(s, it)}>
          <div className="flex flex-col gap-1 shrink-0">
            <button onClick={() => d({ type: "EQUIP", uid: it.uid })} className="btn btn-arc px-2.5 py-1 text-[10px]">Надеть</button>
            <button onClick={() => d({ type: "SELL", uid: it.uid })} className="btn btn-dark px-2.5 py-1 text-[10px] flex items-center justify-center gap-0.5">
              <Icon n="coin" className="w-3 h-3 text-gold" filled />{it.sell}
            </button>
          </div>
        </ItemRow>
      ))}
      {items.length > 0 && (
        <div className="text-center text-[10px] text-dim/70 pb-1">
          Легендарки светятся. Это не баг, это уважение. ({RARITY[4].name}: {s.totals.legendaries} шт. за всё время)
        </div>
      )}
    </div>
  );
}
