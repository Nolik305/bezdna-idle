import {
  CLASSES, SKILLS, PASSIVES, ZONES, MOBS, KILL_PHRASES, QUESTS, DAILIES, WEEKLIES, ACHS,
  genItem, INV_CAP, skillCost, shopCost, SHOP, VIP_LEVELS, SLOT_UP_BONUS, SLOT_UP_MAX, slotUpCost,
  SHARPEN_COST_GOLD, sharpenChance, SHARPEN_STONES,
  RELICS, META, RUN_WAVES, RUN_BOSS_EVERY, shardReward,
  ABYSS_SET, ABYSS_SET_BONUS, GODSTONE, DUEL_NAMES, DUEL_TOKENS_START, DUEL_TOKENS_MAX,
  SETS, SET_PIECE_NAMES, setPoolForTier, RARITY, SLOT_INFO,
  ASCENDANCIES, ATLAS_NODES, PATH_LEVEL_CAP, pathXpNeed,
  DUNGEONS, PARTY_TICKETS_DAILY, PARTY_TIME, MATE_NAMES,
  LOGIN_REWARDS,
  RESOURCES, ZONE_RESOURCES, CRAFT_RECIPES,
  activeSeasonalEvent, type SeasonalEventDef,
  type SetDef,
} from "./data";
import type { Action, BaseSlot, Buff, ClassId, DuelFoe, DuelS, Enemy, GameState, Item, PartyBotProfile, PartyS, RunS, Slot, StatKey, Stats } from "./types";
import { getCustomSets, getCustomItems, rollCustomItem, getCustomItemById, getCustomSetById } from "./customContent";
import { autoIlvl, getBalance, getDropPools, statValue, statRoll } from "./balanceConfig";

export const SAVE_KEY = "bezdna-idle-save-v1";
export const AUTO_SELL_RATE = 0.5;
export const SLOTS: Slot[] = ["weapon", "helm", "amulet", "armor", "gloves", "boots", "ring1", "ring2"];
export const xpNeed = (level: number) => Math.floor(50 * Math.pow(level, 1.55));

/** Пул сетов, включающий кастомные сеты из админки (по тиру). */
function allSetPool(tier: number): SetDef[] {
  return [...setPoolForTier(tier), ...getCustomSets().filter(x => x.tier <= tier)];
}

export const todayStr = () => new Date().toISOString().slice(0, 10);
const yesterdayStr = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

/** ISO-неделя вида "2026-W7" для еженедельников */
export function weekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${week}`;
}

/** Время до автовоскрешения: 3 сек базово, VIP ускоряет */
export const respawnTime = (vip: number) =>
  vip > 0 && VIP_LEVELS[vip - 1] ? VIP_LEVELS[vip - 1].respawn : 3;

/** После смерти фарм возвращается назад, чтобы герой не застревал на стене. */
export const DEATH_WAVE_ROLLBACK = 10;

export const emptyWeekly = () => ({ week: weekKey(), kills: 0, bosses: 0, gold: 0, casts: 0, resources: 0, claimed: [] as string[] });

export function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "Б";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "М";
  if (n >= 1e4) return (n / 1e3).toFixed(1) + "к";
  return String(Math.floor(n));
}
export const fmtTime = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
};

/* =============== derived stats =============== */
export function getStats(s: GameState): Stats {
  const c = CLASSES[s.hero.classId].base;
  let flatDmg = 0, dmgPct = 0, flatHp = 0, hpPct = 0, crit = c.crit, critDmg = 150,
    asPct = 0, goldPct = 0, xpPct = 0, luck = 0, armor = 0, regen = 0, offlinePct = 0,
    lifesteal = 0, dodge = 0, dotPct = 0, cooldownPct = 0, extraSkillDamagePct = 0;

  for (const slot of SLOTS) {
    const it = s.equip[slot];
    if (!it) continue;
    // заточка слота: бонус живёт в слоте, а не в предмете
    const slotMult = 1 + (SLOT_UP_BONUS / 100) * (s.slotLevel[slot] || 0);
    for (const [k, v] of Object.entries(it.stats)) {
      const val = (v ?? 0) * slotMult;
      switch (k) {
        case "dmg": flatDmg += val; break;
        case "dmgPct": dmgPct += val; break;
        case "hp": flatHp += val; break;
        case "armor": armor += val; break;
        case "crit": crit += val; break;
        case "critDmg": critDmg += val; break;
        case "as": asPct += val; break;
        case "goldPct": goldPct += val; break;
        case "xpPct": xpPct += val; break;
        case "luck": luck += val; break;
        case "regen": regen += val; break;
      }
    }
  }
  const P = (id: string) => s.passives[id] || 0;
  dmgPct += 8 * P("power"); crit += 2.5 * P("focus"); hpPct += 8 * P("vitality");
  armor += 6 * P("skin"); goldPct += 8 * P("greed"); xpPct += 7 * P("wisdom");
  luck += 5 * P("fortune"); offlinePct += 12 * P("treasury");

  // VIP-привилегии (кумулятивные)
  if (s.vip > 0) {
    const vip = VIP_LEVELS[Math.min(s.vip, VIP_LEVELS.length) - 1];
    goldPct += vip.goldPct; xpPct += vip.xpPct; luck += vip.luck;
    dmgPct += vip.dmgPct; hpPct += vip.hpPct; offlinePct += vip.offlinePct;
  }

  // Сет Бездны: бонус за каждую надетую вещь сета
  let abyssWorn = 0;
  for (const slot of SLOTS) if (s.equip[slot]?.abyss) abyssWorn += 1;
  if (abyssWorn > 0) {
    dmgPct += ABYSS_SET_BONUS * abyssWorn;
    hpPct += ABYSS_SET_BONUS * abyssWorn;
    luck += 2 * abyssWorn;
  }

  // Камень Бога: бесконечная шкала, усиливает ВСЁ
  if (s.godstone != null && s.godstone > 0) {
    const L = s.godstone;
    dmgPct += 6 * L; hpPct += 6 * L; goldPct += 4 * L; xpPct += 4 * L;
    crit += 1.2 * L; asPct += 1.5 * L; luck += 2 * L; armor += 3 * L;
    critDmg += 3 * L; regen += 0.3 * L; offlinePct += 2 * L;
  }

  // Сеты Атласа: бонусы за количество надетых вещей одного сета
  const worn = equippedSetCounts(s);
  for (const def of SETS) {
    const count = worn[def.id] || 0;
    if (count < 2) continue;
    for (const b of def.bonuses) {
      if (count < b.need) continue;
      for (const [k, v] of Object.entries(b.mods)) {
        const val = v ?? 0;
        switch (k) {
          case "dmgPct": dmgPct += val; break;
          case "hpPct": hpPct += val; break;
          case "crit": crit += val; break;
          case "critDmg": critDmg += val; break;
          case "as": asPct += val; break;
          case "goldPct": goldPct += val; break;
          case "xpPct": xpPct += val; break;
          case "luck": luck += val; break;
          case "armor": armor += val; break;
          case "regen": regen += val; break;
        }
      }
    }
  }

  // Восхождение: бонус архетипа (как бывший путь)
  if (s.path) {
    const adef = ASCENDANCIES.find(p => p.id === s.path);
    if (adef) {
      lifesteal += adef.lifesteal ?? 0;
      dodge += adef.dodge ?? 0;
      dotPct += adef.dotPct ?? 0;
      cooldownPct += adef.cooldownPct ?? 0;
      extraSkillDamagePct += adef.extraSkillDamagePct ?? 0;
      for (const [k, v] of Object.entries(adef.mods)) {
        const val = (v ?? 0);
        switch (k) {
          case "dmgPct": dmgPct += val; break;
          case "hpPct": hpPct += val; break;
          case "crit": crit += val; break;
          case "critDmg": critDmg += val; break;
          case "as": asPct += val; break;
          case "goldPct": goldPct += val; break;
          case "xpPct": xpPct += val; break;
          case "luck": luck += val; break;
          case "armor": armor += val; break;
          case "regen": regen += val; break;
        }
      }
    }
  }
  // Узлы Атласа: бонус за ранги (каждый узел — свой вклад в статы)
  for (const node of ATLAS_NODES) {
    const rank = s.atlas?.[node.id] || 0;
    if (!rank) continue;
    for (const [k, v] of Object.entries(node.mods)) {
      const val = (v ?? 0) * rank;
      switch (k) {
        case "dmgPct": dmgPct += val; break;
        case "hpPct": hpPct += val; break;
        case "crit": crit += val; break;
        case "critDmg": critDmg += val; break;
        case "as": asPct += val; break;
        case "goldPct": goldPct += val; break;
        case "xpPct": xpPct += val; break;
        case "luck": luck += val; break;
        case "armor": armor += val; break;
        case "regen": regen += val; break;
      }
    }
  }
  // мета-апгрейды Алтаря (постоянные)
  for (const m of META) {
    const r = s.meta?.[m.id] || 0;
    if (!r) continue;
    if (m.dmgPct) dmgPct += m.dmgPct * r;
    if (m.hpPct) hpPct += m.hpPct * r;
    if (m.luck) luck += m.luck * r;
    if (m.goldPct) goldPct += m.goldPct * r;
    if (m.xpPct) xpPct += m.xpPct * r;
  }

  let dmgBuff = 1, luckBuff = 0;
  for (const b of s.buffs) { if (b.dmgMult) dmgBuff *= b.dmgMult; if (b.luckAdd) luckBuff += b.luckAdd; }
  // бусты из магазина: свитки золота/опыта (+100% на 5 мин)
  for (const b of s.buffs) {
    if (b.goldMult) goldPct += (b.goldMult - 1) * 100;
    if (b.xpMult) xpPct += (b.xpMult - 1) * 100;
  }

  const lvlMult = 1 + (s.hero.level - 1) * 0.13;
  const dmg = (c.dmg * lvlMult + flatDmg) * (1 + dmgPct / 100) * dmgBuff;
  const as = c.as * (1 + asPct / 100);
  const maxHp = Math.round((c.hp + s.hero.level * 22 + flatHp) * (1 + hpPct / 100));
  const mit = armor / (armor + 110);
  const dps = dmg * as * (1 + (crit / 100) * (critDmg / 100 - 1));
  const offline = (dps / 10) * (1 + goldPct / 100) * (1 + offlinePct / 100);

  return {
    dmg, dps, as, crit: Math.min(85, crit), critDmg, maxHp, armor, mit, goldPct, xpPct,
    luck: luck + luckBuff, regen, offline, lifesteal, dodge, dotPct,
    cooldownPct: Math.min(60, cooldownPct), extraSkillDamagePct,
  };
}

/** Средний вклад авто-скиллов в режимах, где нет отдельной боевой сцены. */
export function getSkillDps(s: GameState, stats = getStats(s)): number {
  return SKILLS
    .filter(def => def.classId === s.hero.classId && s.hero.level >= def.unlockLevel)
    .reduce((total, def) => {
      const level = s.skills[def.id] || 1;
      const cooldown = def.cd * (1 - stats.cooldownPct / 100);
      const direct = stats.dmg * def.mult(level) * def.hits(level) * 0.6 * (1 + stats.extraSkillDamagePct / 100) / cooldown;
      const dot = def.dotPct ? stats.dmg * def.dotPct(level) * 5 / cooldown : 0;
      return total + direct + dot;
    }, 0);
}

/* =============== сила предмета и сравнение с надетым =============== */
// Веса «вклада» каждого стата в общую силу шмотки (грубо отражают влияние на бой,
// как в getStats). Используется для сравнения «лучше/хуже» между предметами.
const ITEM_STAT_WEIGHT: Partial<Record<StatKey, number>> = {
  dmg: 1.0,
  dmgPct: 6.0,
  hp: 0.12,
  hpPct: 2.0,
  armor: 0.5,
  crit: 3.0,
  critDmg: 1.6,
  as: 4.0,
  goldPct: 1.2,
  xpPct: 1.0,
  luck: 1.5,
  regen: 2.5,
};

// «Сила» предмета: взвешенная сумма его статов (заточка слота применяется так же,
// как в getStats, чтобы сравнение было честным).
export function itemPower(it: Item, slotLevel = 0): number {
  const slotMult = 1 + (SLOT_UP_BONUS / 100) * slotLevel;
  let p = 0;
  for (const [k, v] of Object.entries(it.stats)) {
    const w = ITEM_STAT_WEIGHT[k as StatKey] ?? 0.5;
    p += (v ?? 0) * slotMult * w;
  }
  return Math.round(p);
}

// Разница силы между предметом it и тем, что надето в его слоте (учитывая заточку
// надетого слота). Возвращает >0 если it лучше надетого, <0 если хуже, 0 если равно.
// Если слот пуст — возвращает null (надевать выгодно, но стрелки «лучше» не нужны).
export function equipDelta(s: GameState, it: Item): number | null {
  // Кольца: в инвентаре base="ring", но надеваются в ring1/ring2. Сравниваем с лучшим
  // из надетых колец (по их собственной заточке), чтобы стрелка показывала, лучше ли
  // Кольца: новое кольцо заменит более слабое из двух занятых слотов.
  if (it.base === "ring") {
    const r1 = s.equip.ring1;
    const r2 = s.equip.ring2;
    if (!r1 && !r2) return null;
    const p1 = r1 ? itemPower(r1, s.slotLevel.ring1 || 0) : -Infinity;
    const p2 = r2 ? itemPower(r2, s.slotLevel.ring2 || 0) : -Infinity;
    const weakerPower = Math.min(p1, p2);
    const weakerSlotLevel = p1 <= p2 ? (s.slotLevel.ring1 || 0) : (s.slotLevel.ring2 || 0);
    return itemPower(it, weakerSlotLevel) - weakerPower;
  }
  const worn = s.equip[it.base];
  if (!worn) return null;
  return itemPower(it, s.slotLevel[it.base] || 0) - itemPower(worn, s.slotLevel[it.base] || 0);
}

/* =============== атлас: пути и сеты =============== */
export function pathLevel(xp: number): number {
  let lvl = 0, need = pathXpNeed(1);
  while (xp >= need && lvl < PATH_LEVEL_CAP) { xp -= need; lvl += 1; need = pathXpNeed(lvl + 1); }
  return lvl;
}
export const pathXpInto = (xp: number): { lvl: number; cur: number; need: number } => {
  let lvl = 0, need = pathXpNeed(1);
  while (xp >= need && lvl < PATH_LEVEL_CAP) { xp -= need; lvl += 1; need = pathXpNeed(lvl + 1); }
  return { lvl, cur: xp, need };
};

/** Очки атласа: 1 за каждый уровень пути. */
export const atlasPoints = (xp: number): number => pathLevel(xp);

/** Очки Атласа выдаются за уровни героя, а не за пати-награды. */
export const atlasPointsForHeroLevel = (level: number): number => Math.min(PATH_LEVEL_CAP, Math.max(0, Math.floor(level) - 1));

/** Сколько рангов уже вложено в узлы. */
export const atlasPointsSpent = (atlas: Record<string, number>): number =>
  Object.values(atlas).reduce((a, b) => a + b, 0);

export function equippedSetCounts(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const slot of SLOTS) {
    const it = s.equip[slot];
    if (it?.set) out[it.set] = (out[it.set] || 0) + 1;
  }
  return out;
}

/** Поиск сета среди встроенных и кастомных (из админки). */
export function findSetDef(setId: string): SetDef | undefined {
  return SETS.find(x => x.id === setId) ?? getCustomSetById(setId) ?? undefined;
}

/** генерация сетовой вещи (сеты Атласа) */
export function genSetItem(setId: string, ilvl: number, classId: ClassId, uid: number): Item {
  const def = findSetDef(setId) ?? SETS[0];
  const base = def.pieces[Math.floor(Math.random() * def.pieces.length)];
  const pool = [...def.bias];
  const stats: Partial<Record<StatKey, number>> = {};
  const nStats = 3;
  for (let i = 0; i < nStats && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const key = pool.splice(idx, 1)[0];
    let v = statValue(key, ilvl) * 3.4 * statRoll();
    if (key === "dmg" && base === "weapon") v *= classId === "mage" ? 1.25 : 0.9;
    stats[key] = key === "dmg" || key === "hp" ? Math.round(v) : Math.round(v * 10) / 10;
  }
  const name = `${def.name}: ${SET_PIECE_NAMES[base]}`;
  const sell = Math.round(60 + ilvl * 3);
  return { uid, base, name, rarity: 4, ilvl, stats, sell, set: def.id };
}

const baseStat = (k: StatKey, ilvl: number): number => {
  switch (k) {
    case "dmg": return 2 + ilvl * 0.85;
    case "dmgPct": return 3 + ilvl * 0.12;
    case "hp": return 9 + ilvl * 2.1;
    case "hpPct": return 2;
    case "armor": return 1.5 + ilvl * 0.45;
    case "crit": return 2;
    case "critDmg": return 7;
    case "as": return 3;
    case "goldPct": return 4;
    case "xpPct": return 4;
    case "luck": return 2.5;
    case "regen": return 0.35;
  }
};

/* =============== enemies =============== */
export function spawnEnemy(zone: number, wave: number, bossLocked = false): Enemy {
  const z = ZONES[zone];
  // если босс отбит, на его волне стоят усиленные стражи, пока его не призовут вручную
  const boss = wave % 10 === 0 && !bossLocked;
  const key = boss ? z.boss : z.mobs[Math.floor(Math.random() * z.mobs.length)];
  const p = zone * 12 + wave;
  const guard = bossLocked && wave % 10 === 0 ? 2.2 : 1; // стражи на волне отбитого босса
  const b = getBalance();
  let hp = (b.enemyHpBase + zone * b.enemyHpPerZone) * Math.pow(b.enemyHpPow, p) * (boss ? b.bossHpMult : 1) * guard;
  let dmg = (b.enemyDmgBase + zone * b.enemyDmgPerZone) * Math.pow(b.enemyDmgPow, p) * (boss ? b.bossDmgMult : 1) * (guard > 1 ? 1.4 : 1);
  if (z.endless && wave > 10) {
    hp *= 1 + (wave - 10) * 0.22;
    dmg *= 1 + (wave - 10) * 0.12;
  }
  const gold = Math.round((4 + zone * 6 + wave * 1.4) * (boss ? 13 : 1) * (0.9 + Math.random() * 0.2));
  const xp = Math.round((7 + zone * 7 + wave * 1.6) * (boss ? 9 : 1));
  const r = Math.round(hp);
  return { key, name: MOBS[key]?.n ?? key, hp: r, maxHp: r, dmg, as: boss ? 0.6 : 0.85, boss, gold, xp };
}

function spawnParty(dun: typeof DUNGEONS[number], stats: Stats, heroLevel: number, profiles: PartyBotProfile[] = []): PartyS {
  const boss = MOBS[dun.bossKey];
  const bossHp = Math.round(stats.maxHp * (18 + dun.tier * 7));
  const localNames = [...MATE_NAMES].sort(() => Math.random() - 0.5).slice(0, 3);
  const bots = profiles.slice(0, 3);
  const mates = Array.from({ length: 3 }, (_, index) => {
    const profile = bots[index];
    const maxHp = Math.round(stats.maxHp * (0.65 + index * 0.12));
    const dps = profile?.power > 0 ? profile.power * (0.85 + Math.random() * 0.3) : stats.dps * (0.42 + Math.random() * 0.2);
    return {
      name: profile?.name || localNames[index],
      classId: profile?.classId || (index % 2 === 0 ? "archer" : "mage" as ClassId),
      level: profile?.level || Math.max(dun.minLevel, heroLevel - 2 + Math.floor(Math.random() * 5)),
      bot: true,
      source: profile ? "server" as const : "local" as const,
      hp: maxHp,
      maxHp,
      dps,
      reviveT: 0,
    };
  });
  return {
    tier: dun.tier,
    bossKey: dun.bossKey,
    bossName: boss?.n ?? dun.bossKey,
    bossHp,
    bossMaxHp: bossHp,
    bossDmg: stats.maxHp * (0.08 + dun.tier * 0.02),
    t: PARTY_TIME,
    atkT: 0,
    heroHp: stats.maxHp,
    heroMaxHp: stats.maxHp,
    heroReviveT: 0,
    mates,
    state: "fight",
    reward: {
      gold: Math.round(250 * dun.tier),
      gems: dun.tier,
      pathXp: 25 * dun.tier,
      setItem: null,
    },
  };
}

function autoSellItem(st: GameState, item: Item): boolean {
  if (!st.autoSellRarities?.[String(item.rarity)]) return false;
  const value = Math.max(1, Math.round(item.sell * AUTO_SELL_RATE));
  st.hero.gold += value;
  st.totals.goldEarned += value;
  toast(st, `Автопродажа: ${item.name} за ${value} зол.`, "gold");
  return true;
}

function finishParty(st: GameState, win: boolean) {
  const party = st.party;
  if (!party || party.state !== "fight") return;
  party.state = win ? "win" : "fail";
  if (!win) {
    toast(st, "Пати не успела одолеть босса", "warn");
    return;
  }

  st.hero.gold += party.reward.gold;
  st.hero.gems += party.reward.gems;
  st.totals.goldEarned += party.reward.gold;
  st.totals.partyWins += 1;
  st.pathXp += party.reward.pathXp;

  const pool = allSetPool(party.tier);
  if (pool.length) {
    const set = pool[Math.floor(Math.random() * pool.length)];
    st.uidSeq += 1;
    const item = genSetItem(set.id, st.hero.level * 3 + party.tier * 8, st.hero.classId, st.uidSeq);
    party.reward.setItem = item.name;
    st.totals.items += 1;
    st.totals.setPieces += 1;
    if (autoSellItem(st, item)) {
      // автопродажа уже выдала золото
    } else if (st.inv.length >= INV_CAP) {
      st.hero.gold += item.sell;
      st.totals.goldEarned += item.sell;
      toast(st, `Пати-лут продан за ${item.sell} зол.`, "gold");
    } else {
      st.inv = [...st.inv, item];
      toast(st, `Пати добыла: ${item.name}`, "loot");
    }
  }
  toast(st, `Пати победила! +${party.reward.gold} зол.`, "gem");
}

function partyTick(s: GameState, dt: number): GameState {
  const st: GameState = {
    ...s,
    hero: { ...s.hero },
    inv: [...s.inv],
    totals: { ...s.totals },
    party: s.party ? { ...s.party, mates: s.party.mates.map(m => ({ ...m })), reward: { ...s.party.reward } } : null,
  };
  const party = st.party;
  if (!party || party.state !== "fight") return st;

  party.t = Math.max(0, party.t - dt);
  party.atkT += dt;

  const heroStats = getStats(st);
  const activeDps = (party.heroHp > 0 ? heroStats.dps + getSkillDps(st, heroStats) : 0)
    + party.mates.reduce((sum, mate) => sum + (mate.hp > 0 ? mate.dps : 0), 0);
    party.bossHp = Math.max(0, party.bossHp - activeDps * dt);
    if (party.heroHp > 0 && heroStats.regen > 0) {
      party.heroHp = Math.min(party.heroMaxHp, party.heroHp + party.heroMaxHp * heroStats.regen / 100 * dt);
    }
  if (party.heroHp > 0 && heroStats.lifesteal > 0) {
    party.heroHp = Math.min(party.heroMaxHp, party.heroHp + (heroStats.dps + getSkillDps(st, heroStats)) * heroStats.lifesteal / 100 * dt);
  }
  if (party.bossHp <= 0) {
    finishParty(st, true);
    return st;
  }

  for (const mate of party.mates) {
    if (mate.reviveT > 0) {
      mate.reviveT = Math.max(0, mate.reviveT - dt);
      if (mate.reviveT === 0) mate.hp = Math.round(mate.maxHp * 0.6);
    }
  }
  if (party.heroReviveT > 0) {
    party.heroReviveT = Math.max(0, party.heroReviveT - dt);
    if (party.heroReviveT === 0) party.heroHp = Math.round(party.heroMaxHp * 0.6);
  }

  while (party.atkT >= 1 && party.state === "fight") {
    party.atkT -= 1;
    const targets = [
      ...(party.heroHp > 0 ? ["hero"] : []),
      ...party.mates.map((mate, index) => mate.hp > 0 ? index : -1).filter(index => index >= 0),
    ];
    if (!targets.length) {
      finishParty(st, false);
      break;
    }
    const target = targets[Math.floor(Math.random() * targets.length)];
    if (target === "hero" && heroStats.dodge > 0 && Math.random() * 100 < heroStats.dodge) continue;
    const damage = Math.max(1, Math.round(party.bossDmg * (0.85 + Math.random() * 0.3)));
    if (target === "hero") {
      party.heroHp = Math.max(0, party.heroHp - damage);
      if (party.heroHp === 0) party.heroReviveT = 5;
    } else {
      const mate = party.mates[target as number];
      mate.hp = Math.max(0, mate.hp - damage);
      if (mate.hp === 0) mate.reviveT = 5;
    }
  }
  if (party.t <= 0 && party.state === "fight") finishParty(st, false);
  return st;
}

/* =============== РОГАЛИК: экспедиция и Портал Бездны =============== */
export const newRun = (kind: "exp" | "portal" = "exp", depth = 1): RunS => ({
  active: false, kind, depth, wave: 1, enemy: null, heroT: 0, enemyT: 0, skillT: 4, dotDps: 0, dotT: 0, hp: 0, maxHp: 0,
  cds: {}, relics: {}, bosses: 0, goldEarned: 0,
});

export function spawnRunEnemy(wave: number, kind: "exp" | "portal" = "exp", depth = 1): Enemy {
  const tier = kind === "portal"
    ? ZONES.length - 1 // Портал сразу кидает в тварей Бездны
    : Math.min(Math.floor((wave - 1) / RUN_BOSS_EVERY), ZONES.length - 2);
  const z = ZONES[tier];
  const boss = wave % RUN_BOSS_EVERY === 0;
  const key = boss ? z.boss : z.mobs[Math.floor(Math.random() * z.mobs.length)];
  const hpK = kind === "portal" ? 1.42 : 1.33;
  const dmgK = kind === "portal" ? 1.3 : 1.24;
  // глубины Портала: Бездна I, II, III… каждая заметно злее
  const depthHp = kind === "portal" ? Math.pow(2.1, depth - 1) : 1;
  const depthDmg = kind === "portal" ? Math.pow(1.68, depth - 1) : 1;
  const hp = 60 * Math.pow(hpK, wave) * (boss ? 5 : 1) * depthHp;
  const dmg = 8 * Math.pow(dmgK, wave) * (boss ? 1.6 : 1) * depthDmg;
  const gold = Math.round((10 + wave * 3) * (boss ? 8 : 1) * (0.9 + Math.random() * 0.2) * (kind === "portal" ? 1.6 * depth : 1));
  const r = Math.round(hp);
  return { key, name: MOBS[key]?.n ?? key, hp: r, maxHp: r, dmg, as: boss ? 0.55 : 0.9, boss, gold, xp: 0 };
}

/** предмет Сета Бездны (фиксированные мощные статы, редкость «Бездна») */
export function genAbyssItem(ilvl: number, uid: number, classId: ClassId, wave: number): Item {
  const bases = Object.keys(ABYSS_SET) as BaseSlot[];
  const base = bases[Math.floor(Math.random() * bases.length)];
  const def = ABYSS_SET[base]!;
  const scale = 1 + wave * 0.05;
  const stats: Partial<Record<StatKey, number>> = {};
  for (const [k, v] of Object.entries(def.stats)) {
    let val = (v ?? 0) * scale;
    if (k === "dmg") val *= classId === "mage" ? 1.2 : 0.95;
    stats[k as StatKey] = Math.round(val * 10) / 10;
  }
  const name = base === "weapon"
    ? (classId === "mage" ? "Жезл Пожирателя" : "Лук Пустоты")
    : def.name;
  return { uid, base, name, rarity: 5, ilvl, stats, sell: 400 + ilvl * 6, abyss: true };
}

/* =============== ДУЭЛИ =============== */
export const newDuel = (): DuelS => ({
  state: "idle", mmr: 1000, tokens: DUEL_TOKENS_START, wins: 0, losses: 0,
  searchT: 0, foe: null, heroHp: 0, heroT: 0, foeT: 0, skillT: 0, foeSkillT: 0, dotDps: 0, dotT: 0,
  cds: {}, fx: [], log: [], result: null, delta: 0, reward: 0, rankClaimed: false,
});

const eloDelta = (myMmr: number, foeMmr: number, win: boolean) => {
  const expected = 1 / (1 + Math.pow(10, (foeMmr - myMmr) / 400));
  return win ? Math.max(6, Math.round(32 * (1 - expected))) : -Math.max(6, Math.round(32 * expected));
};

function genFoe(s: GameState, opponent?: { name: string; classId: ClassId; mmr: number; power: number; serverId?: number }): DuelFoe {
  const st = getStats(s);
  if (opponent) {
    // Реальный соперник с сервера: масштабируем статы под его power относительно нашего.
    const foePower = Math.max(1, opponent.power);
    const myPower = Math.max(1, Math.round(st.dps * (1 + (st.crit / 100) * (st.critDmg / 100 - 1))));
    const scale = Math.sqrt(foePower / myPower);
    const as = st.as * (0.92 + Math.random() * 0.16);
    const dmg = (st.dps / st.as) * scale * (0.9 + Math.random() * 0.2);
    const maxHp = Math.round(st.maxHp * scale * (0.9 + Math.random() * 0.2));
    const power = Math.round(dmg * as + maxHp / 10);
    return {
      name: opponent.name || "Герой",
      classId: opponent.classId,
      mmr: opponent.mmr,
      maxHp, hp: maxHp, dmg, as,
      crit: Math.min(70, st.crit * (0.6 + Math.random() * 0.5)),
      critDmg: st.critDmg * (0.85 + Math.random() * 0.3),
      power,
      serverId: opponent.serverId,
      isBot: false,
    };
  }
  const mmr = Math.max(100, s.duel.mmr + Math.round(Math.random() * 460 - 230));
  const scale = (0.85 + Math.random() * 0.3) * (1 + (mmr - s.duel.mmr) / 1600);
  const as = st.as * (0.9 + Math.random() * 0.25);
  const dmg = (st.dps / st.as) * scale;
  const maxHp = Math.round(st.maxHp * scale * (0.95 + Math.random() * 0.2));
  const power = Math.round(dmg * as + maxHp / 10);
  return {
    name: DUEL_NAMES[Math.floor(Math.random() * DUEL_NAMES.length)],
    classId: Math.random() < 0.5 ? "mage" : "archer",
    mmr, maxHp, hp: maxHp, dmg, as,
    crit: Math.min(70, st.crit * (0.6 + Math.random() * 0.5)),
    critDmg: st.critDmg * (0.85 + Math.random() * 0.3),
    power,
    isBot: true,
  };
}

function duelFx(st: GameState, text: string, kind: "dmg" | "crit" | "hurt" | "heal" | "gold" | "xp", x: number, y: number) {
  st.fxSeq += 1;
  st.duel.fx = [{ id: st.fxSeq, text, kind, x, y, life: 0.95 }, ...st.duel.fx].slice(0, 14);
}

function duelFinish(st: GameState, win: boolean): GameState {
  const foe = st.duel.foe;
  const delta = foe ? eloDelta(st.duel.mmr, foe.mmr, win) : (win ? 20 : -16);
  st.duel.mmr = Math.max(100, st.duel.mmr + delta);
  st.duel.delta = delta;
  let reward = 0;
  if (win) {
    st.duel.wins += 1;
    reward = Math.round(100 + st.duel.mmr * 0.15 + Math.random() * 80);
    st.hero.gold += reward;
    st.totals.goldEarned += reward;
    if (Math.random() < 0.3) { st.duel.tokens = Math.min(DUEL_TOKENS_MAX, st.duel.tokens + 1); }
    if (Math.random() < 0.08) { st.hero.gems += 3; }
    st.duel.log = [`${foe?.name} повержен! MMR ${delta >= 0 ? "+" : ""}${delta}`, ...st.duel.log].slice(0, 5);
  } else {
    st.duel.losses += 1;
    reward = Math.round(20 + st.duel.mmr * 0.03);
    st.hero.gold += reward;
    st.totals.goldEarned += reward;
    st.duel.log = [`Поражение… MMR ${delta}. Утешительные ${reward} зол.`, ...st.duel.log].slice(0, 5);
  }
  st.duel.reward = reward;
  st.duel.result = win ? "win" : "lose";
  st.duel.state = "result";
  return st;
}

function duelTick(st: GameState, dt: number) {
  const D = st.duel;
  D.fx = D.fx.map(f => ({ ...f, life: f.life - dt })).filter(f => f.life > 0).slice(0, 14);
  for (const k of Object.keys(D.cds)) if (D.cds[k] > 0) D.cds[k] = Math.max(0, D.cds[k] - dt);

  if (D.state === "search") {
    D.searchT -= dt;
    if (D.searchT <= 0) {
      D.foe = genFoe(st);
      D.heroHp = getStats(st).maxHp;
      D.heroT = 0; D.foeT = 0; D.skillT = 3; D.foeSkillT = 4; D.dotDps = 0; D.dotT = 0;
      D.state = "fight";
      D.log = [`Соперник найден: ${D.foe.name} (MMR ${D.foe.mmr})`, ...D.log].slice(0, 5);
    }
    return;
  }
  if (D.state !== "fight" || !D.foe) return;

  const stats = getStats(st);
  if (stats.regen > 0) D.heroHp = Math.min(stats.maxHp, D.heroHp + stats.maxHp * stats.regen / 100 * dt);
  // герой лупит
  D.heroT += stats.as * dt; 
  if (D.dotT > 0 && D.foe) {
    D.dotT -= dt;
    D.foe = { ...D.foe, hp: D.foe.hp - D.dotDps * dt };
    if (D.foe.hp <= 0) { duelFinish(st, true); return; }
  }
  while (D.heroT >= 1 && D.foe.hp > 0 && D.heroHp > 0) {
    D.heroT -= 1;
    const isCrit = Math.random() * 100 < stats.crit;
    let dmg = stats.dmg * (0.9 + Math.random() * 0.2);
    if (isCrit) dmg *= stats.critDmg / 100;
    const d = Math.max(1, Math.round(dmg));
    D.foe = { ...D.foe, hp: D.foe.hp - d };
    if (stats.lifesteal > 0) D.heroHp = Math.min(stats.maxHp, D.heroHp + d * stats.lifesteal / 100);
    duelFx(st, fmt(d), isCrit ? "crit" : "dmg", 55 + Math.random() * 30, 25 + Math.random() * 35);
  }
  if (D.foe.hp <= 0) { duelFinish(st, true); return; }

  // скилл героя — автокаст каждые ~7 сек
  D.skillT -= dt;
  if (D.skillT <= 0) {
    D.skillT = 7;
    const ready = SKILLS.filter(k => k.classId === st.hero.classId && st.hero.level >= k.unlockLevel && (D.cds[k.id] || 0) <= 0);
    if (ready.length) {
      const def = ready[Math.floor(Math.random() * ready.length)];
      D.cds[def.id] = def.cd * (1 - stats.cooldownPct / 100);
      const lvl = st.skills[def.id] || 1;
      const dmg = Math.max(1, Math.round(stats.dmg * def.mult(lvl) * def.hits(lvl) * 0.75 * (1 + stats.extraSkillDamagePct / 100)));
      D.foe = { ...D.foe, hp: D.foe.hp - dmg };
      if (stats.lifesteal > 0) D.heroHp = Math.min(stats.maxHp, D.heroHp + dmg * stats.lifesteal / 100);
      if (def.slow) D.foeT = Math.max(0, D.foeT - 1);
      if (def.dotPct) { D.dotDps = stats.dmg * def.dotPct(lvl); D.dotT = 5; }
      duelFx(st, fmt(dmg), "crit", 60 + Math.random() * 20, 20 + Math.random() * 20);
      D.log = [`Авто-каст: «${def.name}» на ${fmt(dmg)}`, ...D.log].slice(0, 5);
      if (D.foe.hp <= 0) { duelFinish(st, true); return; }
    }
  }

  // соперник отвечает
  D.foeT += D.foe.as * dt;
  while (D.foeT >= 1 && D.heroHp > 0) {
    D.foeT -= 1;
    if (stats.dodge > 0 && Math.random() * 100 < stats.dodge) continue;
    const isCrit = Math.random() * 100 < D.foe.crit;
    let dmg = D.foe.dmg * (0.9 + Math.random() * 0.2);
    if (isCrit) dmg *= D.foe.critDmg / 100;
    const d = Math.max(1, Math.round(dmg * (1 - stats.mit)));
    D.heroHp -= d;
    duelFx(st, `-${fmt(d)}`, "hurt", 10 + Math.random() * 25, 30 + Math.random() * 30);
  }
  if (D.heroHp <= 0) { D.heroHp = 0; duelFinish(st, false); return; }

  // скилл соперника
  D.foeSkillT -= dt;
  if (D.foeSkillT <= 0) {
    D.foeSkillT = 5.5 + Math.random() * 2;
    if (stats.dodge > 0 && Math.random() * 100 < stats.dodge) {
      D.log = [`Вы уклонились от коронного приёма!`, ...D.log].slice(0, 5);
      return;
    }
    const dmg = Math.max(1, Math.round(D.foe.dmg * 2.4 * (1 - stats.mit)));
    D.heroHp -= dmg;
    duelFx(st, `-${fmt(dmg)}`, "hurt", 12 + Math.random() * 20, 25);
    D.log = [`${D.foe.name} применяет коронный приём!`, ...D.log].slice(0, 5);
    if (D.heroHp <= 0) { D.heroHp = 0; duelFinish(st, false); }
  }
}

/** статы героя с учётом даров забега */
export function runStats(s: GameState): Stats & { lifesteal: number; thorns: number; skillLvl: number; bossGoldMult: number } {
  const base = getStats(s);
  let dmgPct = 0, as = 0, crit = 0, critDmg = 0, hpPct = 0, luck = 0, goldPct = 0, xpPct = 0;
  let lifesteal = 0, thorns = 0, skillLvl = 0, bossGoldMult = 1;
  for (const def of RELICS) {
    const r = s.run.relics[def.id] || 0;
    if (!r) continue;
    if (def.dmgPct) dmgPct += def.dmgPct * r;
    if (def.as) as += def.as * r;
    if (def.crit) crit += def.crit * r;
    if (def.critDmg) critDmg += def.critDmg * r;
    if (def.hpPct) hpPct += def.hpPct * r;
    if (def.luck) luck += def.luck * r;
    if (def.goldPct) goldPct += def.goldPct * r;
    if (def.xpPct) xpPct += def.xpPct * r;
    if (def.lifesteal) lifesteal += def.lifesteal * r;
    if (def.thorns) thorns += def.thorns * r;
    if (def.skillLvl) skillLvl += def.skillLvl * r;
    if (def.bossGold) bossGoldMult += def.bossGold * r;
  }
  return {
    ...base,
    dmg: base.dmg * (1 + dmgPct / 100),
    as: base.as * (1 + as / 100),
    crit: Math.min(90, base.crit + crit),
    critDmg: base.critDmg + critDmg,
    maxHp: Math.round(base.maxHp * (1 + hpPct / 100)),
    luck: base.luck + luck,
    goldPct: base.goldPct + goldPct,
    xpPct: base.xpPct + xpPct,
    lifesteal: base.lifesteal + lifesteal, thorns, skillLvl, bossGoldMult,
  };
}

export const relicOffer = (relics: Record<string, number>): string[] => {
  const pool = RELICS.filter(r => (relics[r.id] || 0) < r.max);
  const out: string[] = [];
  const copy = [...pool];
  while (out.length < 3 && copy.length) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0].id);
  }
  return out;
};

function runHeroHit(st: GameState, mult: number) {
  const e = st.run.enemy;
  if (!e) return;
  const rs = runStats(st);
  const isCrit = Math.random() * 100 < rs.crit;
  let dmg = rs.dmg * mult * (0.9 + Math.random() * 0.2);
  if (isCrit) dmg *= rs.critDmg / 100;
  const d = Math.max(1, Math.round(dmg));
  st.run.enemy = { ...e, hp: e.hp - d };
  if (rs.dotPct > 0 && st.run.enemy) {
    st.run.dotDps = Math.max(st.run.dotDps, rs.dmg * rs.dotPct);
    st.run.dotT = Math.max(st.run.dotT, 5);
  }
  if (rs.lifesteal > 0) st.run.hp = Math.min(rs.maxHp, st.run.hp + d * rs.lifesteal / 100);
  if (isCrit) st.totals.crits += 1;
  st.totals.dmgDealt += d;
  if (st.run.enemy.hp <= 0) runKill(st);
}

function runKill(st: GameState) {
  const e = st.run.enemy;
  if (!e) return;
  const rs = runStats(st);
  const gold = Math.round(e.gold * (1 + rs.goldPct / 100) * (e.boss ? rs.bossGoldMult : 1));
  st.hero.gold += gold;
  st.totals.goldEarned += gold;
  st.run.goldEarned += gold;
  st.run.enemy = null;
  if (rs.lifesteal > 0) st.run.hp = Math.min(rs.maxHp, st.run.hp + rs.maxHp * rs.lifesteal / 100);

  const wasBoss = e.boss;
  if (wasBoss) st.run.bosses += 1;

  // --- добыча забега ---
  const giveItem = (it: Item) => {
    st.totals.items += 1;
    if (it.rarity === 4) st.totals.legendaries += 1;
    if (autoSellItem(st, it)) {
      st.run.goldEarned += Math.max(1, Math.round(it.sell * AUTO_SELL_RATE));
      return;
    }
    if (st.inv.length >= INV_CAP) {
      st.hero.gold += it.sell; st.totals.goldEarned += it.sell;
      st.run.goldEarned += it.sell;
      st.battle.log = [`Рюкзак полон: «${it.name}» продан за ${it.sell} зол.`, ...st.battle.log].slice(0, 6);
    } else {
      st.inv = [...st.inv, it];
      toast(st, `Добыча: ${it.name}`, "loot");
    }
  };
  if (st.run.kind === "portal") {
    // Портал Бездны: щедрый лут, сеты Бездны, шанс крови
    const ilvl = st.hero.level * 4 + st.run.wave * 2;
    if (wasBoss) {
      st.uidSeq += 1;
      giveItem(genAbyssItem(ilvl + 6, st.uidSeq, st.hero.classId, st.run.wave));
      if (Math.random() < 0.08) { st.blood += 1; toast(st, "Кровь Демона! Портал зовёт снова", "gem"); }
    } else if (Math.random() < 0.3) {
      st.uidSeq += 1;
      giveItem(genItem(ilvl, 2, st.hero.classId, rs.luck, st.uidSeq));
    }
  } else {
    // Экспедиция: с боссов очень редко капает Кровь Демона
    if (wasBoss && Math.random() < 0.07) {
      st.blood += 1;
      toast(st, "КРОВЬ ДЕМОНА! Ключ к Порталу Бездны", "gem");
    }
  }

  if (st.run.wave >= RUN_WAVES) { endRun(st, true); return; }
  st.run.wave += 1;
  st.run.enemy = spawnRunEnemy(st.run.wave, st.run.kind, st.run.depth);
  st.run.heroT = 0;
  st.run.enemyT = 0;
  if (wasBoss) {
    st.run.hp = Math.min(rs.maxHp, st.run.hp + rs.maxHp * 0.25);
    const options = relicOffer(st.run.relics);
    if (options.length) {
      const id = options[Math.floor(Math.random() * options.length)];
      st.run.relics[id] = (st.run.relics[id] || 0) + 1;
      toast(st, `Дар получен автоматически: «${RELICS.find(r => r.id === id)?.name ?? id}»`, "loot");
    }
  }
}

function runEnemyHit(st: GameState) {
  const e = st.run.enemy;
  if (!e) return;
  const rs = runStats(st);
  if (rs.dodge > 0 && Math.random() * 100 < rs.dodge) return;
  const mit = rs.armor / (rs.armor + 110);
  const taken = Math.max(1, Math.round(e.dmg * (0.9 + Math.random() * 0.2) * (1 - mit)));
  st.run.hp -= taken;
  if (rs.thorns > 0 && st.run.enemy) {
    const th = Math.round(rs.dmg * rs.thorns / 100);
    st.run.enemy = { ...st.run.enemy, hp: st.run.enemy.hp - th };
    if (st.run.enemy.hp <= 0) { runKill(st); return; }
  }
  if (st.run.hp <= 0) endRun(st, false);
}

function endRun(st: GameState, win: boolean, abandoned = false): GameState {
  const reached = st.run.wave;
  const kind = st.run.kind;
  let shards = 0;
  if (kind === "exp") {
    shards = abandoned ? Math.round(shardReward(reached, st.run.bosses, false) / 2) : shardReward(reached, st.run.bosses, win);
    st.shards += shards;
  } else if (win && !abandoned) {
    // победа в Портале: кристаллы + вещь Сета Бездны + шанс вещи сета Атласа
    const depth = st.run.depth;
    st.hero.gems += 12 + depth * 3;
    st.uidSeq += 1;
    const it = genAbyssItem(st.hero.level * 4 + reached * 2 + 8 + depth * 6, st.uidSeq, st.hero.classId, reached);
    st.totals.items += 1;
    if (autoSellItem(st, it)) { /* автопродажа уже выдала золото */ }
    else if (st.inv.length < INV_CAP) { st.inv = [...st.inv, it]; toast(st, `Награда Портала: ${it.name}`, "loot"); }
    else { st.hero.gold += it.sell; st.totals.goldEarned += it.sell; }
    // сет Атласа (шанс)
    if (Math.random() < 0.5) {
      const pool = allSetPool(depth);
      if (pool.length) {
        const sdef = pool[Math.floor(Math.random() * pool.length)];
        st.uidSeq += 1;
        const sit = genSetItem(sdef.id, st.hero.level * 3 + depth * 10, st.hero.classId, st.uidSeq);
        st.totals.items += 1; st.totals.setPieces += 1;
        if (autoSellItem(st, sit)) { /* автопродажа уже выдала золото */ }
        else if (st.inv.length < INV_CAP) {
          st.inv = [...st.inv, sit];
          toast(st, `Сет «${sdef.name}»: ${sit.name}`, "loot");
        } else {
          st.hero.gold += sit.sell;
          st.totals.goldEarned += sit.sell;
          toast(st, `Рюкзак полон: сет продан за ${sit.sell} зол.`, "gold");
        }
      }
    }
    // открыть следующую глубину и новую пассивную зону
    if (depth >= st.portalDepth) st.portalDepth = depth + 1;
    const newZones = Math.min(ZONES.length, 5 + depth);
    if (newZones > st.zones) {
      st.zones = newZones;
      toast(st, `Открыта зона: «${ZONES[newZones - 1].name}»`, "gem");
    }
  }
  st.bestWave = Math.max(st.bestWave, reached);
  st.run = { ...st.run, active: false, enemy: null };
  st.modal = { t: "runover", wave: reached, shards, win };
  const label = kind === "portal" ? "Портал" : "Экспедиция";
  toast(st, win ? `${label} пройден! Бездна впечатлена` : `${label} оборвался на волне ${reached}`, win ? "gem" : "warn");
  return st;
}

/* =============== helpers =============== */
function toast(st: GameState, text: string, kind: "info" | "gold" | "loot" | "warn" | "gem" = "info") {
  st.toastSeq += 1;
  st.toasts = [...st.toasts.slice(-2), { id: st.toastSeq, text, kind }];
}
function pushLog(st: GameState, msg: string) {
  st.battle.log = [msg, ...st.battle.log].slice(0, 6);
}
function pushFx(st: GameState, text: string, kind: "dmg" | "crit" | "hurt" | "heal" | "gold" | "xp", x: number, y: number) {
  st.fxSeq += 1;
  st.battle.fx = [{ id: st.fxSeq, text, kind, x, y, life: 0.95 }, ...st.battle.fx].slice(0, 16);
}

function gainXp(st: GameState, xp: number, silent = false) {
  st.hero.xp += xp;
  let leveled = false;
  while (st.hero.xp >= xpNeed(st.hero.level)) {
    st.hero.xp -= xpNeed(st.hero.level);
    st.hero.level += 1;
    st.hero.skillPoints += 1;
    leveled = true;
  }
  if (leveled) {
    st.hero.hp = getStats(st).maxHp;
    if (!silent) {
      if (!st.modal) st.modal = { t: "levelup", level: st.hero.level };
      toast(st, `Уровень ${st.hero.level}! +1 очко навыков`, "gem");
      pushLog(st, `Уровень ${st.hero.level}. Мир содрогнулся (немного)`);
    }
  }
}

function heroHit(st: GameState, stats: Stats, mult: number) {
  const e = st.battle.enemy;
  if (!e) return;
  const isCrit = Math.random() * 100 < stats.crit;
  let dmg = stats.dmg * mult * (0.9 + Math.random() * 0.2);
  if (isCrit) dmg *= stats.critDmg / 100;
  const d = Math.max(1, Math.round(dmg));
  st.battle.enemy = { ...e, hp: e.hp - d };
  if (stats.lifesteal > 0) st.hero.hp = Math.min(stats.maxHp, st.hero.hp + d * stats.lifesteal / 100);
  if (stats.dotPct > 0 && st.battle.enemy) {
    st.battle.dotDps = Math.max(st.battle.dotDps, stats.dmg * stats.dotPct);
    st.battle.dotT = Math.max(st.battle.dotT, 5);
  }
  pushFx(st, fmt(d), isCrit ? "crit" : "dmg", 28 + Math.random() * 44, 22 + Math.random() * 30);
  if (isCrit) st.totals.crits += 1;
  st.totals.dmgDealt += d;
  if (st.battle.enemy.hp <= 0) killEnemy(st, stats);
}

/** Добавить дроп в инвентарь (или автопродажа/продажа при полном рюкзаке). */
function giveItemDrop(st: GameState, it: Item) {
  st.totals.items += 1;
  if (it.rarity === 4) st.totals.legendaries += 1;
  if (autoSellItem(st, it)) {
    return;
  }
  if (st.inv.length >= INV_CAP) {
    st.hero.gold += it.sell;
    st.totals.goldEarned += it.sell;
    pushLog(st, `Рюкзак полон: «${it.name}» продан за ${it.sell} зол.`);
  } else {
    st.inv = [...st.inv, it];
    toast(st, `Добыча: ${it.name}`, "loot");
  }
}

/**
 * Бросок пулов дропа для источника (настраивается в админке: «где падает и с каким %»).
 * Приоритет источников: конкретный враг/босс -> зона -> глобально.
 * Каждая запись имеет свой шанс (0..100); максимум один предмет из пула за убийство.
 */
function rollPoolItem(st: GameState, zone: number, wave: number, boss: boolean, enemyKey: string): Item | null {
  const pools = getDropPools();
  if (!pools.length) return null;
  const classId = st.hero.classId;
  const exact = boss ? `boss:${enemyKey}` : `enemy:${enemyKey}`;
  const zoneKey = `zone:${zone}`;
  const groups: string[] = [exact, zoneKey, "global"];
  for (const src of groups) {
    for (const en of pools) {
      if (en.source !== src) continue;
      if (Math.random() * 100 >= en.chance) continue;
      const ilvl = Math.max(1, autoIlvl(zone, wave, boss) + en.ilvlDelta);
      // Это сет (встроенный или кастомный)?
      if (SETS.some(x => x.id === en.contentId) || getCustomSetById(en.contentId)) {
        st.uidSeq += 1;
        return genSetItem(en.contentId, ilvl, classId, st.uidSeq);
      }
      // Это кастомный предмет из админки?
      const cIt = getCustomItemById(en.contentId);
      if (cIt) {
        st.uidSeq += 1;
        return { ...cIt, uid: st.uidSeq, ilvl: Math.max(cIt.ilvl, ilvl) };
      }
      // Неизвестный контент — пропускаем запись.
    }
  }
  return null;
}

function dropItem(st: GameState, stats: Stats, boss: boolean) {
  const ilvl = autoIlvl(st.battle.zone, st.battle.wave, boss);
  st.uidSeq += 1;
  // Кастомный предмет из админки (своим шансом drop_chance), если повезло.
  const customIt = getCustomItems().length ? rollCustomItem(st.uidSeq) : null;
  const it = customIt ?? genItem(ilvl, boss ? 1 : 0, st.hero.classId, stats.luck, st.uidSeq);
  giveItemDrop(st, it);
}

// Начисляет очки сезонного ивента за игровую активность.
function gainSeasonal(st: GameState, metric: SeasonalEventDef["metric"], units: number): void {
  const ev = activeSeasonalEvent();
  if (!ev || ev.metric !== metric || units <= 0) return;
  // если у игрока ивент не совпадает (старый/новый месяц) — сбрасываем прогресс
  if (st.seasonal.id !== ev.id) st.seasonal = { id: ev.id, points: 0, claimed: [] };
  st.seasonal = { ...st.seasonal, points: st.seasonal.points + units / ev.perPoint };
}

function killEnemy(st: GameState, stats: Stats) {
  const e = st.battle.enemy;
  if (!e) return;
  st.battle.enemy = null;
  st.totals.kills += 1;
  st.daily.kills += 1;
  st.weekly.kills += 1;
  gainSeasonal(st, "kills", 1);
  if (e.boss) { st.totals.bosses += 1; st.daily.bosses += 1; st.weekly.bosses += 1; gainSeasonal(st, "bosses", 1); }

  const gold = Math.round(e.gold * (1 + stats.goldPct / 100));
  st.hero.gold += gold;
  st.totals.goldEarned += gold;
  st.daily.gold += gold;
  st.weekly.gold += gold;
  gainSeasonal(st, "gold", gold);
  pushFx(st, `+${fmt(gold)}`, "gold", 40 + Math.random() * 20, 55);
  gainXp(st, Math.round(e.xp * (1 + stats.xpPct / 100)));

  const b = getBalance();
  if (Math.random() < b.potionChance) { st.hero.potions += 1; pushLog(st, "С врага шлёпнулось зелье"); }
  // Ресурсы крафта: каждая зона даёт свои ресурсы (стимул сидеть в старых зонах).
  const zoneRes = ZONE_RESOURCES[st.battle.zone] ?? [];
  if (zoneRes.length) {
    const gained: string[] = [];
    let gainedTotal = 0;
    const count = e.boss ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const key = zoneRes[Math.floor(Math.random() * zoneRes.length)];
      const amt = 1 + Math.floor(Math.random() * (e.boss ? 3 : 2));
      st.resources[key] = (st.resources[key] || 0) + amt;
      gainedTotal += amt;
      gained.push(`${amt}× ${key}`);
    }
    st.daily.resources += gainedTotal;
    st.weekly.resources += gainedTotal;
    gainSeasonal(st, "resources", gainedTotal);
    if (gained.length) pushLog(st, `Ресурсы: ${gained.join(", ")}`);
  }
  // Дроп камней заточки: эпические и легендарные — только в Бездне (зоны 4+).
  // Чем глубже зона и выше волна, тем выше шанс.
  if (st.battle.zone >= 4) {
    const depth = (st.battle.zone - 4) + st.battle.wave / 20;
    const epicChance = Math.min(0.02 + depth * 0.004, 0.10);
    const legChance = Math.min(0.004 + depth * 0.001, 0.03);
    if (Math.random() < legChance) {
      st.resources.stone_legendary = (st.resources.stone_legendary || 0) + 1;
      pushLog(st, "Из глубин Бездны выпал Легендарный камень заточки!");
    } else if (Math.random() < epicChance) {
      st.resources.stone_epic = (st.resources.stone_epic || 0) + 1;
      pushLog(st, "Из глубин Бездны выпал Эпический камень заточки!");
    }
  }
  // Пулы дропа (настраиваются в админке): свой шанс на каждое убийство источника.
  const poolIt = rollPoolItem(st, st.battle.zone, st.battle.wave, e.boss, e.key);
  if (poolIt) giveItemDrop(st, poolIt);
  // Обычный дроп.
  const dropChance = (e.boss ? b.bossDropChance : b.dropBaseChance) + stats.luck / 100;
  if (Math.random() < dropChance) dropItem(st, stats, e.boss);
  if (e.boss && Math.random() < b.bossExtraChance) dropItem(st, stats, true);

  pushLog(st, KILL_PHRASES[Math.floor(Math.random() * KILL_PHRASES.length)].replace("{e}", e.name));

  if (e.boss) {
    st.battle.bossLocked = false; // босс повержен — блокировка снята
    if (!st.bossDone[st.battle.zone]) {
      st.bossDone = [...st.bossDone];
      st.bossDone[st.battle.zone] = true;
    }
    if (st.battle.zone + 1 < ZONES.length && st.zones < st.battle.zone + 2) {
      st.zones = st.battle.zone + 2;
      toast(st, `Открыта зона: ${ZONES[st.battle.zone + 1].name}!`, "gem");
    }
    if (Math.random() < 0.65 && !st.modal) {
      const ids = ["toad", "chest", "bard", "goblin"];
      st.modal = { t: "event", id: ids[Math.floor(Math.random() * ids.length)] };
    }
  }

  st.battle.wave += 1;
  st.totals.maxWave = Math.max(st.totals.maxWave, st.battle.zone * 10 + st.battle.wave);
  st.battle.enemyT = 0;
  st.battle.dotT = 0;
  st.battle.dotDps = 0;
  st.battle.enemy = spawnEnemy(st.battle.zone, st.battle.wave, st.battle.bossLocked);
}

function enemyHit(st: GameState, stats: Stats) {
  const e = st.battle.enemy;
  if (!e || st.battle.paused) return;
  if (stats.dodge > 0 && Math.random() * 100 < stats.dodge) {
    pushFx(st, "УКЛОН!", "hurt", 18 + Math.random() * 24, 62 + Math.random() * 12);
    return;
  }
  const taken = Math.max(1, Math.round(e.dmg * (0.9 + Math.random() * 0.2) * (1 - stats.mit)));
  st.hero.hp -= taken;
  pushFx(st, `-${fmt(taken)}`, "hurt", 18 + Math.random() * 24, 62 + Math.random() * 12);
  if (st.hero.hp <= 0) {
    st.hero.hp = 0;
    st.battle.paused = true;
    st.totals.deaths += 1;
    // если повалил босс — он «отбит»: дальше фарм волн, босса призывать вручную
    if (e.boss && !st.battle.bossLocked) {
      st.battle.bossLocked = true;
      pushLog(st, "Босс отбил атаку! Призовите его снова, когда будете готовы");
    }
    // автовоскрешение: никакой вечной модалки, таймер тикает в TICK. Золото не отнимается!
    st.battle.respawnT = respawnTime(st.vip);
    pushLog(st, `Вы пали. Автовоскрешение через ${st.battle.respawnT} с...`);
  }
}

/* =============== metric =============== */
export function getMetric(s: GameState, key: string): number {
  const t = s.totals;
  const eq = SLOTS.filter(sl => s.equip[sl]).length;
  switch (key) {
    case "kills": return t.kills;
    case "bosses": return t.bosses;
    case "crits": return t.crits;
    case "goldEarned": return t.goldEarned;
    case "level": return s.hero.level;
    case "equippedCount": return eq;
    case "invCount": return s.inv.length;
    case "casts": return t.casts;
    case "maxWave": return t.maxWave;
    case "legendaries": return t.legendaries;
    case "potionsUsed": return t.potions;
    case "deaths": return t.deaths;
    case "boss1": return s.bossDone[0] ? 1 : 0;
    case "boss2": return s.bossDone[1] ? 1 : 0;
    case "dkills": return s.daily.kills;
    case "dbosses": return s.daily.bosses;
    case "dgold": return s.daily.gold;
    case "dres": return s.daily.resources;
    case "wkills": return s.weekly?.kills ?? 0;
    case "wbosses": return s.weekly?.bosses ?? 0;
    case "wgold": return s.weekly?.gold ?? 0;
    case "wcasts": return s.weekly?.casts ?? 0;
    case "wres": return s.weekly?.resources ?? 0;
    default: return 0;
  }
}

/* =============== state factory =============== */
export function newGame(): GameState {
  return {
    v: 1,
    hero: { classId: "mage", name: "Бродяга", level: 1, xp: 0, skillPoints: 1, gold: 100, gems: 10, potions: 2, hp: 95 },
    equip: { weapon: null, helm: null, amulet: null, armor: null, gloves: null, boots: null, ring1: null, ring2: null },
    inv: [], skills: {}, passives: {},
    battle: { zone: 0, wave: 1, enemy: null, heroT: 0, enemyT: 0, dotDps: 0, dotT: 0, skillT: 4, cds: {}, fx: [], log: [], paused: false, respawnT: 0, bossLocked: false },
    zones: 1, bossDone: ZONES.map(() => false),
    totals: { kills: 0, bosses: 0, crits: 0, goldEarned: 0, dmgDealt: 0, items: 0, legendaries: 0, maxWave: 0, deaths: 0, casts: 0, potions: 0, events: 0, questsDone: 0, partyWins: 0, setPieces: 0 },
    achClaimed: [], questsClaimed: [], resources: {}, buffs: [], toasts: [],
    modal: { t: "class" },
    daily: { date: todayStr(), kills: 0, bosses: 0, gold: 0, resources: 0, claimed: [], tickets: PARTY_TICKETS_DAILY },
    activity: { day: 1, claimed: [], lastClaimDate: "" },
    weekly: emptyWeekly(),
    vip: 0,
    slotLevel: { weapon: 0, helm: 0, amulet: 0, armor: 0, gloves: 0, boots: 0, ring1: 0, ring2: 0 },
    portalDepth: 1, path: null, pathXp: 0, atlas: {}, party: null, autoSellRarities: {},
    seasonal: { id: activeSeasonalEvent()?.id ?? "", points: 0, claimed: [] },
    run: newRun(),
    shards: 0,
    meta: {},
    bestWave: 0,
    blood: 0,
    godstone: null,
    duel: newDuel(),
    shopBuys: {}, lastSeen: Date.now(), uidSeq: 1, fxSeq: 1, toastSeq: 1,
  };
}

/* =============== reducer =============== */
export function reducer(s: GameState, a: Action): GameState {
  switch (a.type) {
    case "HYDRATE_STATE": return migrateState(a.state);
    case "INBOX_ADD": {
      if (!a.items.length) return s;
      const st = { ...s, inv: [...s.inv], hero: { ...s.hero } };
      let gold = 0;
      for (const it of a.items) {
        if (st.inv.length >= INV_CAP) { gold += it.sell; continue; }
        st.inv = [...st.inv, it];
      }
      if (gold > 0) { st.hero.gold += gold; st.totals.goldEarned += gold; toast(st, `Рюкзак полон: часть наград продана за ${gold} зол.`, "gold"); }
      else toast(st, `Получено с сервера: ${a.items.length} предм.`, "loot");
      return st;
    }
    case "TICK": return tick(s, a.dt);

    case "CHOOSE_CLASS": {
      const st = { ...s, hero: { ...s.hero }, battle: { ...s.battle, fx: [], log: [] } };
      st.hero.classId = a.classId;
      st.hero.name = a.name.trim() || (a.classId === "mage" ? "Пиромант" : "Стрелка");
      st.hero.hp = getStats(st).maxHp;
      st.battle.enemy = spawnEnemy(0, 1);
      st.battle.wave = 1;
      st.modal = null;
      toast(st, `${CLASSES[a.classId].name} в деле. Вперёд, за лутом!`, "gem");
      pushLog(st, "Поход начался. Прелый лес уже жалеет об этом");
      return st;
    }

    case "SET_ZONE": {
      if (a.zone >= s.zones || a.zone === s.battle.zone) return s;
      const st = { ...s, battle: { ...s.battle, cds: { ...s.battle.cds }, fx: [...s.battle.fx], log: [...s.battle.log] } };
      st.battle.zone = a.zone;
      st.battle.wave = 1;
      st.battle.heroT = 0; st.battle.enemyT = 0; st.battle.dotT = 0; st.battle.paused = false; st.battle.respawnT = 0;
      st.battle.enemy = spawnEnemy(a.zone, 1);
      pushLog(st, `Вы вошли в «${ZONES[a.zone].name}»`);
      return st;
    }

    case "CAST": {
      const def = SKILLS.find(k => k.id === a.id);
      if (!def || def.classId !== s.hero.classId) return s;
      const st = { ...s, battle: { ...s.battle, cds: { ...s.battle.cds }, fx: [...s.battle.fx], log: [...s.battle.log] }, totals: { ...s.totals }, weekly: { ...s.weekly, claimed: [...s.weekly.claimed] } };
      if (s.hero.level < def.unlockLevel) { toast(st, `${def.name}: откроется на ${def.unlockLevel} уровне`, "warn"); return st; }
      if (!st.battle.enemy || st.battle.paused) return s;
      if ((st.battle.cds[a.id] || 0) > 0) return s;
      st.battle.cds[a.id] = def.cd * (1 - getStats(s).cooldownPct / 100);
      st.totals.casts += 1;
      st.weekly.casts += 1;
      const stats = getStats(s);
      const lvl = s.skills[a.id] || 1;
      const hits = def.hits(lvl);
      for (let i = 0; i < hits; i++) heroHit(st, stats, def.mult(lvl));
      if (def.slow && st.battle.enemy) st.battle.enemyT = Math.max(0, st.battle.enemyT - 1);
      if (def.dotPct && st.battle.enemy) { st.battle.dotDps = stats.dmg * def.dotPct(lvl); st.battle.dotT = 5; }
      pushLog(st, `${def.name}!`);
      return st;
    }

    case "USE_POTION": {
      const st = { ...s, hero: { ...s.hero }, totals: { ...s.totals }, battle: { ...s.battle, fx: [...s.battle.fx], log: [...s.battle.log] } };
      const stats = getStats(s);
      if (st.hero.potions <= 0) { toast(st, "Зелий нет. Гоблин уже потирает руки", "warn"); return st; }
      if (st.hero.hp >= stats.maxHp) { toast(st, "HP и так полное", "info"); return st; }
      st.hero.potions -= 1;
      st.hero.hp = Math.min(stats.maxHp, st.hero.hp + stats.maxHp * 0.45);
      st.totals.potions += 1;
      pushFx(st, "ХРУМ!", "heal", 30, 65);
      pushLog(st, "Зелье выпито. Вкус — компот, эффект — жизнь");
      return st;
    }

    case "EQUIP": {
      const it = s.inv.find(i => i.uid === a.uid);
      if (!it) return s;
      const st = { ...s, inv: s.inv.filter(i => i.uid !== a.uid), equip: { ...s.equip }, hero: { ...s.hero } };
      let slot: Slot = it.base as Slot;
      if (it.base === "ring") slot = !s.equip.ring1 ? "ring1" : !s.equip.ring2 ? "ring2" : "ring1";
      const old = st.equip[slot];
      st.equip[slot] = it;
      if (old) st.inv = [...st.inv, old];
      st.hero.hp = Math.min(st.hero.hp, getStats(st).maxHp);
      return st;
    }

    case "UNEQUIP": {
      const it = s.equip[a.slot];
      if (!it) return s;
      if (s.inv.length >= INV_CAP) { const st = { ...s }; toast(st, "Рюкзак полон!", "warn"); return st; }
      const st = { ...s, equip: { ...s.equip, [a.slot]: null }, inv: [...s.inv, it], hero: { ...s.hero } };
      st.hero.hp = Math.min(st.hero.hp, getStats(st).maxHp);
      return st;
    }

    case "SELL": {
      const it = s.inv.find(i => i.uid === a.uid);
      if (!it) return s;
      const st = { ...s, inv: s.inv.filter(i => i.uid !== a.uid), hero: { ...s.hero, gold: s.hero.gold + it.sell }, totals: { ...s.totals, goldEarned: s.totals.goldEarned + it.sell } };
      toast(st, `Продано за ${it.sell} зол.`, "gold");
      return st;
    }

    case "SELL_JUNK": {
      const junk = s.inv.filter(i => i.rarity === 0);
      if (!junk.length) { const st = { ...s }; toast(st, "Серого хлама нет", "info"); return st; }
      const sum = junk.reduce((acc, i) => acc + i.sell, 0);
      const st = { ...s, inv: s.inv.filter(i => i.rarity !== 0), hero: { ...s.hero, gold: s.hero.gold + sum }, totals: { ...s.totals, goldEarned: s.totals.goldEarned + sum } };
      toast(st, `Продано ${junk.length} шт. хлама за ${sum} зол.`, "gold");
      return st;
    }

    case "TOGGLE_AUTO_SELL": {
      if (a.rarity < 0 || a.rarity > 5) return s;
      return {
        ...s,
        autoSellRarities: {
          ...s.autoSellRarities,
          [String(a.rarity)]: !s.autoSellRarities?.[String(a.rarity)],
        },
      };
    }

    case "BUY_SHOP": {
      const def = SHOP.find(x => x.id === a.id);
      if (!def) return s;
      const buys = s.shopBuys[a.id] || 0;
      const cost = shopCost(def, buys);
      const st = { ...s, hero: { ...s.hero }, shopBuys: { ...s.shopBuys }, totals: { ...s.totals }, inv: [...s.inv], battle: { ...s.battle, log: [...s.battle.log] } };
      const pay = def.currency === "gold" ? st.hero.gold : st.hero.gems;
      if (pay < cost) { toast(st, def.currency === "gold" ? "Не хватает золота" : "Не хватает кристаллов", "warn"); return st; }
      if (def.currency === "gold") st.hero.gold -= cost; else st.hero.gems -= cost;
      st.shopBuys[a.id] = buys + 1;
      if (def.kind === "potion") {
        st.hero.potions += 1;
        toast(st, "Зелье куплено. Гоблин довольно хрюкнул", "gold");
      } else if (def.kind === "boost" && def.boost) {
        const b = def.boost;
        st.buffs = st.buffs.filter(x => x.id !== b.id);
        const buff: Buff = b.id === "boost_gold"
          ? { id: b.id, label: def.name, goldMult: b.mult, t: b.seconds }
          : { id: b.id, label: def.name, xpMult: b.mult, t: b.seconds };
        st.buffs.push(buff);
        toast(st, `${def.name} активен 5 минут`, "gem");
      } else {
        const ilvl = autoIlvl(st.battle.zone, st.battle.wave, false) + 3;
        st.uidSeq += 1;
        const it = genItem(ilvl, def.minRarity ?? 0, st.hero.classId, getStats(s).luck, st.uidSeq);
        st.totals.items += 1;
        if (it.rarity === 4) st.totals.legendaries += 1;
        if (autoSellItem(st, it)) {
          // автопродажа уже выдала золото
        } else if (st.inv.length >= INV_CAP) {
          st.hero.gold += it.sell;
          st.totals.goldEarned += it.sell;
          toast(st, `Рюкзак полон — ${it.name} сразу продан`, "gold");
        } else {
          st.inv.push(it);
          toast(st, `Из ларца: ${it.name}`, "loot");
        }
      }
      return st;
    }

    case "LEVEL_SKILL": {
      const def = SKILLS.find(k => k.id === a.id);
      if (!def) return s;
      const lvl = s.skills[a.id] || 1;
      const cost = skillCost(lvl);
      const st = { ...s, hero: { ...s.hero }, skills: { ...s.skills } };
      if (s.hero.gold < cost) { toast(st, "Не хватает золота", "warn"); return st; }
      st.hero.gold -= cost;
      st.skills[a.id] = lvl + 1;
      toast(st, `${def.name} ур. ${lvl + 1}`, "gem");
      return st;
    }

    case "LEVEL_PASSIVE": {
      const def = PASSIVES.find(p => p.id === a.id);
      if (!def) return s;
      const rank = s.passives[a.id] || 0;
      const st = { ...s, hero: { ...s.hero }, passives: { ...s.passives } };
      if (rank >= def.max) return s;
      if (s.hero.skillPoints <= 0) { toast(st, "Нет очков навыков — качайте уровень", "warn"); return st; }
      st.hero.skillPoints -= 1;
      st.passives[a.id] = rank + 1;
      return st;
    }

    case "CRAFT": {
      const def = CRAFT_RECIPES.find(r => r.id === a.id);
      if (!def) return s;
      // Проверяем ресурсы
      for (const m of def.mats) if ((s.resources[m.type] || 0) < m.amount) { toast({ ...s }, "Не хватает ресурсов", "warn"); return s; }
      const st = { ...s, hero: { ...s.hero }, resources: { ...s.resources }, inv: [...s.inv], totals: { ...s.totals }, slotLevel: { ...s.slotLevel }, battle: { ...s.battle, log: [...s.battle.log] } };
      for (const m of def.mats) st.resources[m.type] -= m.amount;
      const r = def.result;
      if (r.kind === "potion") {
        st.hero.potions += r.value ?? 1;
        toast(st, `Создано: ${r.value ?? 1} зелий`, "gold");
      } else if (r.kind === "gold") {
        st.hero.gold += r.value ?? 0;
        st.totals.goldEarned += r.value ?? 0;
        toast(st, `Выручка: ${r.value} золота`, "gold");
      } else if (r.kind === "gem") {
        st.hero.gems += r.value ?? 0;
        toast(st, `Получено: ${r.value} кристаллов`, "gem");
      } else if (r.kind === "stone") {
        const idx = r.value ?? 0;
        const def = SHARPEN_STONES[idx];
        const key = def?.key ?? "stone_common";
        st.resources[key] = (st.resources[key] || 0) + 1;
        toast(st, `${def?.name ?? "Камень"} создан`, "gold");
      } else if (r.kind === "item") {
        const ilvl = autoIlvl(st.battle.zone, st.battle.wave, false) + (r.ilvlBonus ?? 0);
        st.uidSeq += 1;
        const it = genItem(ilvl, r.minRarity ?? 0, st.hero.classId, getStats(s).luck, st.uidSeq);
        st.totals.items += 1;
        if (it.rarity === 4) st.totals.legendaries += 1;
        if (st.inv.length >= INV_CAP) {
          st.hero.gold += it.sell;
          st.totals.goldEarned += it.sell;
          toast(st, `Рюкзак полон — ${it.name} сразу продан`, "gold");
        } else {
          st.inv.push(it);
          toast(st, `Выковано: ${it.name}`, "loot");
        }
      }
      return st;
    }

    // Крафт с выбором слота: заточка в конкретный слот / ковка предмета под слот.
    case "CRAFT_SLOT": {
      const def = CRAFT_RECIPES.find(r => r.id === a.id);
      if (!def) return s;
      const slot: Slot = a.slot;
      // Проверяем ресурсы
      for (const m of def.mats) if ((s.resources[m.type] || 0) < m.amount) { toast({ ...s }, "Не хватает ресурсов", "warn"); return s; }
      const st = { ...s, hero: { ...s.hero }, resources: { ...s.resources }, inv: [...s.inv], totals: { ...s.totals }, slotLevel: { ...s.slotLevel }, battle: { ...s.battle, log: [...s.battle.log] } };
      for (const m of def.mats) st.resources[m.type] -= m.amount;
      const r = def.result;
      if (r.kind === "item") {
        const ilvl = autoIlvl(st.battle.zone, st.battle.wave, false) + (r.ilvlBonus ?? 0);
        st.uidSeq += 1;
        const base: BaseSlot = slot === "ring1" || slot === "ring2" ? "ring" : slot;
        const it = genItem(ilvl, r.minRarity ?? 0, st.hero.classId, getStats(s).luck, st.uidSeq, base);
        st.totals.items += 1;
        if (it.rarity === 4) st.totals.legendaries += 1;
        if (st.inv.length >= INV_CAP) {
          st.hero.gold += it.sell;
          st.totals.goldEarned += it.sell;
          toast(st, `Рюкзак полон — ${it.name} сразу продан`, "gold");
        } else {
          st.inv.push(it);
          toast(st, `Выковано: ${it.name}`, "loot");
        }
      }
      return st;
    }

    case "CLAIM_QUEST": {
      const def = QUESTS.find(q => q.id === a.id);
      if (!def || s.questsClaimed.includes(a.id)) return s;
      if (getMetric(s, def.metric) < def.target) return s;
      const st = { ...s, hero: { ...s.hero }, questsClaimed: [...s.questsClaimed, a.id], totals: { ...s.totals, questsDone: s.totals.questsDone + 1 }, duel: { ...s.duel } };
      if (def.reward.gold) st.hero.gold += def.reward.gold;
      if (def.reward.gems) st.hero.gems += def.reward.gems;
      if (def.reward.tokens) st.duel.tokens = Math.min(DUEL_TOKENS_MAX, st.duel.tokens + def.reward.tokens);
      toast(st, `Квест выполнен: «${def.title}»`, "gem");
      return st;
    }

    case "CLAIM_DAILY": {
      const def = DAILIES.find(q => q.id === a.id);
      if (!def || s.daily.claimed.includes(a.id)) return s;
      if (getMetric(s, def.metric) < def.target) return s;
      const st = { ...s, hero: { ...s.hero }, daily: { ...s.daily, claimed: [...s.daily.claimed, a.id] }, duel: { ...s.duel } };
      if (def.reward.gold) st.hero.gold += def.reward.gold;
      if (def.reward.gems) st.hero.gems += def.reward.gems;
      if (def.reward.tokens) st.duel.tokens = Math.min(DUEL_TOKENS_MAX, st.duel.tokens + def.reward.tokens);
      toast(st, `Ежедневка получена: «${def.title}»`, "gem");
      return st;
    }

    case "CLAIM_ACH": {
      const def = ACHS.find(q => q.id === a.id);
      if (!def || s.achClaimed.includes(a.id)) return s;
      if (getMetric(s, def.metric) < def.target) return s;
      const st = { ...s, hero: { ...s.hero, gems: s.hero.gems + (def.reward.gems || 0) }, achClaimed: [...s.achClaimed, a.id] };
      toast(st, `Достижение: «${def.title}» +${def.reward.gems || 0} крист.`, "gem");
      return st;
    }

    case "CHOOSE_EVENT": return chooseEvent(s, a.idx);

    case "CLAIM_WEEKLY": {
      const def = WEEKLIES.find(q => q.id === a.id);
      if (!def || s.weekly.claimed.includes(a.id)) return s;
      if (getMetric(s, def.metric) < def.target) return s;
      const st = { ...s, hero: { ...s.hero }, weekly: { ...s.weekly, claimed: [...s.weekly.claimed, a.id] }, duel: { ...s.duel } };
      if (def.reward.gold) st.hero.gold += def.reward.gold;
      if (def.reward.gems) st.hero.gems += def.reward.gems;
      if (def.reward.tokens) st.duel.tokens = Math.min(DUEL_TOKENS_MAX, st.duel.tokens + def.reward.tokens);
      toast(st, `Еженедельник получен: «${def.title}»`, "gem");
      return st;
    }

    case "UPGRADE_SLOT": {
      const lvl = s.slotLevel[a.slot] || 0;
      const st = { ...s, hero: { ...s.hero }, slotLevel: { ...s.slotLevel }, resources: { ...s.resources } };
      if (lvl >= SLOT_UP_MAX) { toast(st, "Заточка на пределе", "warn"); return st; }
      const it = s.equip[a.slot];
      if (!it) { toast(st, "Слот пуст — надень предмет, чтобы точить", "warn"); return st; }
      const stoneDef = SHARPEN_STONES[a.stone] ?? SHARPEN_STONES[0];
      const stone = st.resources[stoneDef.key] || 0;
      if (stone < 1) { toast(st, `Нужен ${stoneDef.name} — крафт в Мастерской или дроп в Бездне`, "warn"); return st; }
      if (st.hero.gold < SHARPEN_COST_GOLD) { toast(st, `Нужно ${SHARPEN_COST_GOLD} золота на заточку`, "warn"); return st; }
      st.hero.gold -= SHARPEN_COST_GOLD;
      st.resources[stoneDef.key] = stone - 1;
      const chance = sharpenChance(a.stone, lvl);
      if (Math.random() * 100 < chance) {
        st.slotLevel[a.slot] = lvl + 1;
        toast(st, `Заточка удалась: +${lvl + 1} (${SLOT_UP_BONUS * (lvl + 1)}% к статам)`, "gem");
      } else {
        toast(st, `Заточка не удалась (${stoneDef.name}, шанс был ${chance}%)`, "warn");
      }
      return st;
    }

    case "BUY_VIP": {
      if (s.vip >= VIP_LEVELS.length) return s;
      const def = VIP_LEVELS[s.vip];
      const st = { ...s, hero: { ...s.hero } };
      if (s.hero.gems < def.cost) { toast(st, "Не хватает кристаллов на VIP", "warn"); return st; }
      st.hero.gems -= def.cost;
      st.vip = s.vip + 1;
      toast(st, `VIP «${def.name}» активирован!`, "gem");
      return st;
    }

    case "START_RUN": {
      if (s.run.active) return s;
      const kind = a.kind;
      if (kind === "portal" && s.blood < 1) {
        const st0 = { ...s };
        toast(st0, "Нужна Кровь Демона — выбивай боссов в Экспедиции", "warn");
        return st0;
      }
      const depth = kind === "portal"
        ? Math.min(Math.max(1, a.depth || 1), Math.max(1, s.portalDepth))
        : 1;
      const st: GameState = {
        ...s, hero: { ...s.hero }, run: { ...newRun(kind, depth), relics: {} },
        battle: { ...s.battle, paused: true, log: [...s.battle.log] },
      };
      if (kind === "portal") st.blood -= 1;
      const rs = runStats(st);
      st.run.maxHp = rs.maxHp;
      st.run.hp = rs.maxHp;
      st.run.active = true;
      const headstartRank = s.meta?.headstart || 0;
      for (let i = 0; i < headstartRank; i++) {
        const options = relicOffer(st.run.relics);
        if (!options.length) break;
        const id = options[Math.floor(Math.random() * options.length)];
        st.run.relics[id] = (st.run.relics[id] || 0) + 1;
      }
      if (headstartRank > 0) {
        const boosted = runStats(st);
        st.run.maxHp = boosted.maxHp;
        st.run.hp = boosted.maxHp;
      }
      st.run.enemy = spawnRunEnemy(1, kind, depth);
      pushLog(st, kind === "portal" ? "Портал Бездны поглотил героя. Назад — только с лутом" : "Экспедиция началась! Фарм на паузе — герой в Бездне");
      return st;
    }

    case "ABANDON_RUN": {
      if (!s.run.active) return s;
      const st: GameState = { ...s, run: { ...s.run, relics: { ...s.run.relics } }, hero: { ...s.hero }, totals: { ...s.totals } };
      return endRun(st, false, true);
    }

    case "RUN_CAST": {
      if (!s.run.active || !s.run.enemy) return s;
      const def = SKILLS.find(k => k.id === a.id);
      if (!def || def.classId !== s.hero.classId) return s;
      if (s.hero.level < def.unlockLevel) return s;
      if ((s.run.cds[a.id] || 0) > 0) return s;
      const st: GameState = { ...s, run: { ...s.run, cds: { ...s.run.cds } }, totals: { ...s.totals } };
      st.run.cds[a.id] = def.cd * (1 - runStats(s).cooldownPct / 100);
      st.totals.casts += 1;
      st.weekly.casts += 1;
      const rs = runStats(s);
      const lvl = (s.skills[a.id] || 1) + rs.skillLvl;
      for (let i = 0; i < def.hits(lvl); i++) runHeroHit(st, def.mult(lvl));
      if (def.slow && st.run.enemy) st.run.enemyT = Math.max(0, st.run.enemyT - 1);
      if (def.dotPct && st.run.enemy) { st.run.dotDps = rs.dmg * def.dotPct(lvl); st.run.dotT = 5; }
      return st;
    }

    case "RUN_USE_POTION": {
      if (!s.run.active || s.hero.potions <= 0) return s;
      const st: GameState = { ...s, hero: { ...s.hero }, run: { ...s.run }, totals: { ...s.totals } };
      const rs = runStats(s);
      if (st.run.hp >= rs.maxHp) return s;
      st.hero.potions -= 1;
      st.run.hp = Math.min(rs.maxHp, st.run.hp + rs.maxHp * 0.45);
      st.totals.potions += 1;
      return st;
    }

    case "RUN_PICK": {
      const def = RELICS.find(r => r.id === a.id);
      if (!def) return s;
      const st: GameState = { ...s, run: { ...s.run, relics: { ...s.run.relics } }, modal: null };
      st.run.relics[a.id] = (st.run.relics[a.id] || 0) + 1;
      const rs = runStats(st);
      st.run.maxHp = rs.maxHp;
      if (def.hpPct && def.hpPct > 0) st.run.hp = Math.min(rs.maxHp, st.run.hp + rs.maxHp * 0.3);
      toast(st, `Дар принят: «${def.name}»`, "loot");
      return st;
    }

    case "RUN_CLOSE": {
      const st: GameState = { ...s, modal: null, battle: { ...s.battle, paused: false }, run: { ...newRun() } };
      st.hero.hp = Math.max(st.hero.hp, 1);
      pushLog(st, "Герой вернулся с экспедиции. Фарм продолжается");
      return st;
    }

    case "BUY_META": {
      const def = META.find(m => m.id === a.id);
      if (!def) return s;
      const rank = s.meta?.[a.id] || 0;
      if (rank >= def.max) return s;
      const cost = def.cost(rank);
      const st: GameState = { ...s, meta: { ...s.meta } };
      if (s.shards < cost) { toast(st, "Не хватает осколков бездны", "warn"); return st; }
      st.shards -= cost;
      st.meta[a.id] = rank + 1;
      toast(st, `Алтарь: «${def.name}» ур. ${rank + 1}`, "gem");
      return st;
    }

    /* ---------- КАМЕНЬ БОГА ---------- */
    case "BUY_GODSTONE": {
      if (s.godstone != null) return s;
      const st = { ...s, hero: { ...s.hero } };
      if (s.hero.gems < GODSTONE.price) { toast(st, "Не хватает кристаллов", "warn"); return st; }
      st.hero.gems -= GODSTONE.price;
      st.godstone = 0;
      toast(st, "Камень Бога пробуждён! Теперь точи его в экране Героя", "gem");
      return st;
    }

    case "UP_GODSTONE": {
      if (s.godstone == null) return s;
      const lvl = s.godstone;
      const cost = GODSTONE.cost(lvl);
      const st = { ...s, hero: { ...s.hero } };
      if (s.hero.gold < cost) { toast(st, "Не хватает золота на ритуал", "warn"); return st; }
      st.hero.gold -= cost;
      const chance = GODSTONE.chance(lvl);
      if (Math.random() * 100 < chance) {
        st.godstone = lvl + 1;
        toast(st, `Камень Бога впитал силу: ур. ${lvl + 1}!`, "gem");
      } else {
        toast(st, `Камень отторг подношение (шанс был ${chance}%)…`, "warn");
      }
      return st;
    }

    /* ---------- ДУЭЛИ ---------- */
    case "DUEL_SEARCH": {
      const st = { ...s, duel: { ...s.duel, cds: { ...s.duel.cds }, fx: [...s.duel.fx], log: [...s.duel.log] } };
      if (st.duel.state === "search" || st.duel.state === "fight") return s;
      if (st.duel.tokens < 1) { toast(st, "Нет жетонов дуэлей. +1 каждый день", "warn"); return st; }
      st.duel.tokens -= 1;
      st.duel.state = "search";
      st.duel.searchT = 2.2 + Math.random() * 1.2;
      st.duel.result = null;
      return st;
    }

    case "DUEL_FOUND": {
      const st = { ...s, duel: { ...s.duel, cds: { ...s.duel.cds }, fx: [...s.duel.fx], log: [...s.duel.log] } };
      if (st.duel.state !== "search") return s;
      st.duel.foe = genFoe(st, a.opponent ?? undefined);
      st.duel.heroHp = getStats(st).maxHp;
      st.duel.heroT = 0; st.duel.foeT = 0; st.duel.skillT = 3; st.duel.foeSkillT = 4;
      st.duel.state = "confirm";
      const src = st.duel.foe.isBot ? "Бот найден" : "Соперник найден";
      st.duel.log = [`${src}: ${st.duel.foe.name} (MMR ${st.duel.foe.mmr})`, ...st.duel.log].slice(0, 5);
      return st;
    }

    case "DUEL_CONFIRM": {
      const st = { ...s, duel: { ...s.duel, state: "fight" as const } };
      return st;
    }

    case "DUEL_CAST": {
      const def = SKILLS.find(k => k.id === a.id);
      if (!def || def.classId !== s.hero.classId) return s;
      const st = { ...s, duel: { ...s.duel, cds: { ...s.duel.cds }, fx: [...s.duel.fx], log: [...s.duel.log] } };
      if (st.duel.state !== "fight" || !st.duel.foe) return s;
      if (s.hero.level < def.unlockLevel || (st.duel.cds[a.id] || 0) > 0) return s;
      st.duel.cds[a.id] = def.cd * (1 - getStats(s).cooldownPct / 100);
      const stats = getStats(s);
      const lvl = s.skills[a.id] || 1;
      const hits = def.hits(lvl);
      for (let i = 0; i < hits; i++) {
        const isCrit = Math.random() * 100 < stats.crit;
        let dmg = stats.dmg * def.mult(lvl) * (0.9 + Math.random() * 0.2) * (1 + stats.extraSkillDamagePct / 100);
        if (isCrit) dmg *= stats.critDmg / 100;
        const d = Math.max(1, Math.round(dmg));
        st.duel.foe = { ...st.duel.foe, hp: st.duel.foe.hp - d };
        if (stats.lifesteal > 0) st.duel.heroHp = Math.min(stats.maxHp, st.duel.heroHp + d * stats.lifesteal / 100);
        duelFx(st, fmt(d), isCrit ? "crit" : "dmg", 55 + Math.random() * 30, 25 + Math.random() * 30);
      }
      if (def.slow) st.duel.foeT = Math.max(0, st.duel.foeT - 1);
      if (def.dotPct) { st.duel.dotDps = stats.dmg * def.dotPct(lvl); st.duel.dotT = 5; }
      st.duel.log = [`Ваш «${def.name}» попадает в цель!`, ...st.duel.log].slice(0, 5);
      if (st.duel.foe.hp <= 0) return duelFinish(st, true);
      return st;
    }

    case "DUEL_CLOSE": {
      const st = { ...s, duel: { ...s.duel, state: "idle" as const, foe: null, fx: [], log: [] } };
      return st;
    }

    case "DUEL_RANK_CLAIM": {
      const st = { ...s, hero: { ...s.hero, gold: s.hero.gold + a.gold, gems: s.hero.gems + a.gems }, duel: { ...s.duel, rankClaimed: true } };
      return st;
    }

    case "DUEL_MMR_SET": {
      const st = { ...s, duel: { ...s.duel, mmr: a.mmr } };
      return st;
    }

    case "SUMMON_BOSS": {
      if (!s.battle.bossLocked) return s;
      const st = { ...s, battle: { ...s.battle, bossLocked: false, log: [...s.battle.log] } };
      st.battle.enemy = spawnEnemy(st.battle.zone, st.battle.wave, false);
      pushLog(st, "Босс призван! Он недоволен, что его разбудили");
      return st;
    }

    case "CHOOSE_PATH": {
      const def = ASCENDANCIES.find(p => p.id === a.id);
      if (!def) return s;
      if (def.classId !== s.hero.classId) return s;
      if (s.path === a.id) return s;
      const st = { ...s };
      toast(st, s.path ? `Восхождение сменено на «${def.name}»` : `Выбрано восхождение «${def.name}»`, "gem");
      st.path = a.id;
      return st;
    }

    case "ATLAS_UP": {
      const node = ATLAS_NODES.find(n => n.id === a.id);
      if (!node) return s;
      const rank = s.atlas?.[a.id] || 0;
      if (rank >= node.max) return s;
      const spent = atlasPointsSpent(s.atlas || {});
      const avail = atlasPointsForHeroLevel(s.hero.level);
      if (spent >= avail) { toast(s, "Нет очков атласа — качай путь (пати)", "warn"); return s; }
      const st = { ...s, atlas: { ...(s.atlas || {}), [a.id]: rank + 1 } };
      return st;
    }

    case "PARTY_START": {
      if (s.party && s.party.state === "fight") return s;
      const dun = DUNGEONS.find(x => x.tier === a.tier);
      if (!dun) return s;
      const st = { ...s, daily: { ...s.daily }, totals: { ...s.totals }, hero: { ...s.hero } };
      if (s.hero.level < dun.minLevel) { toast(st, `Нужен ${dun.minLevel} уровень героя`, "warn"); return st; }
      if (s.totals.partyWins < dun.needWins) { toast(st, `Нужно ${dun.needWins} побед в пати`, "warn"); return st; }
      if (st.daily.tickets < 1) { toast(st, "Нет билетов пати. +3 каждый день", "warn"); return st; }
      st.daily.tickets -= 1;
      const stats = getStats(s);
      st.party = spawnParty(dun, stats, s.hero.level, a.bots);
      st.battle.paused = true;
      pushLog(st, `Пати вошла в «${dun.name}». Босс уже точит зубы`);
      return st;
    }

    case "PARTY_CLOSE": {
      return { ...s, party: null, battle: { ...s.battle, paused: false } };
    }

    case "CLAIM_AD_OFFLINE": {
      if (s.modal?.t !== "offline") return s;
      const st = { ...s, hero: { ...s.hero }, totals: { ...s.totals } };
      st.hero.gold += Math.max(0, Math.round(a.gold));
      st.totals.goldEarned += Math.max(0, Math.round(a.gold));
      gainXp(st, Math.max(0, Math.round(a.xp)), true);
      return st;
    }

    case "CLAIM_ACTIVITY": {
      const activity = s.activity ?? { day: 1, claimed: [], lastClaimDate: "" };
      if (activity.lastClaimDate === todayStr()) return s;
      const day = Math.max(1, Math.min(7, activity.day || 1));
      const reward = LOGIN_REWARDS[day - 1];
      const st = { ...s, hero: { ...s.hero }, modal: null, activity: { ...activity, claimed: [...activity.claimed] }, totals: { ...s.totals } };
      st.hero.gold += reward.gold;
      st.hero.gems += reward.gems;
      st.hero.potions += reward.potions;
      st.totals.goldEarned += reward.gold;
      st.activity.claimed.push(day);
      st.activity.lastClaimDate = todayStr();
      st.activity.day = day >= 7 ? 1 : day + 1;
      if (day >= 7) st.activity.claimed = [];
      toast(st, `Награда за вход: день ${day}`, "gem");
      return st;
    }

    case "CLAIM_SEASON_TIER": {
      const ev = activeSeasonalEvent();
      if (!ev || s.seasonal.id !== ev.id) return s;
      const tier = ev.tiers[a.idx];
      if (!tier || s.seasonal.claimed.includes(a.idx) || s.seasonal.points < tier.pts) return s;
      const st = { ...s, hero: { ...s.hero }, seasonal: { ...s.seasonal, claimed: [...s.seasonal.claimed, a.idx] }, totals: { ...s.totals } };
      const r = tier.reward;
      if (r.gold) { st.hero.gold += r.gold; st.totals.goldEarned += r.gold; }
      if (r.gems) st.hero.gems += r.gems;
      if (r.potions) st.hero.potions += r.potions;
      if (r.box) {
        const ilvl = autoIlvl(st.battle.zone, st.battle.wave, false) + 6;
        st.uidSeq += 1;
        const it = genItem(ilvl, r.box.minRarity, st.hero.classId, getStats(st).luck, st.uidSeq);
        st.totals.items += 1;
        if (it.rarity === 4) st.totals.legendaries += 1;
        if (st.inv.length >= INV_CAP) { st.hero.gold += it.sell; st.totals.goldEarned += it.sell; toast(st, `Рюкзак полон — ${it.name} продан`, "gold"); }
        else { st.inv = [...st.inv, it]; toast(st, `Награда ивента: ${it.name}`, "loot"); }
      } else {
        toast(st, `Награда ивента «${ev.name}» получена`, "gem");
      }
      return st;
    }

    case "CLOSE_MODAL": return { ...s, modal: null };
    case "DISMISS_TOAST": return { ...s, toasts: s.toasts.filter(t => t.id !== a.id) };
    case "RESET": {
      try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ }
      const fresh = newGame();
      // Явный сброс: помечаем, чтобы сервер разрешил пустой сейв перезаписать
      // существующий прогресс (обход защиты от случайного затирания).
      fresh.meta = { ...(fresh.meta || {}), cloudReset: Date.now() };
      return fresh;
    }
    default: return s;
  }
}

/* =============== tick =============== */
function runTick(s: GameState, dt: number): GameState {
  const st: GameState = {
    ...s, hero: { ...s.hero }, totals: { ...s.totals }, weekly: { ...s.weekly },
    run: { ...s.run, cds: { ...s.run.cds }, relics: { ...s.run.relics } },
  };
  const R = st.run;
  for (const k of Object.keys(R.cds)) if (R.cds[k] > 0) R.cds[k] = Math.max(0, R.cds[k] - dt);

  if (!R.enemy || !R.active) return st;
  const rs = runStats(st);
  if (rs.regen > 0) R.hp = Math.min(rs.maxHp, R.hp + rs.maxHp * rs.regen / 100 * dt);

  if (R.dotT > 0 && R.enemy) {
    R.dotT -= dt;
    R.enemy = { ...R.enemy, hp: R.enemy.hp - R.dotDps * dt };
    if (R.enemy.hp <= 0) runKill(st);
  }

  R.heroT += rs.as * dt;
  while (R.heroT >= 1 && R.enemy && R.active && !st.modal) { R.heroT -= 1; runHeroHit(st, 1); }
  if (R.enemy && R.active) {
    R.enemyT += R.enemy.as * dt;
    while (R.enemyT >= 1 && R.enemy && R.active && !st.modal) { R.enemyT -= 1; runEnemyHit(st); }
  }
  // авто-каст скила (пассивные скилы — применяются сами, сразу как вышли из КД)
  if (R.enemy && R.active && !st.modal) {
    for (const def of SKILLS) {
      if (def.classId !== st.hero.classId) continue;
      if (st.hero.level < def.unlockLevel) continue;
      if ((R.cds[def.id] || 0) > 0) continue;
      R.cds[def.id] = def.cd * (1 - rs.cooldownPct / 100);
      st.totals.casts += 1;
      st.weekly.casts += 1;
      const lvl = st.skills[def.id] || 1;
      const dmg = Math.max(1, Math.round(rs.dmg * def.mult(lvl) * def.hits(lvl) * 0.6 * (1 + rs.extraSkillDamagePct / 100)));
      R.enemy = { ...R.enemy, hp: R.enemy.hp - dmg };
      if (def.slow) R.enemyT = Math.max(0, R.enemyT - 1);
      if (def.dotPct) { R.dotDps = rs.dmg * def.dotPct(lvl); R.dotT = 5; }
      if (R.enemy.hp <= 0) runKill(st);
    }
  }
  return st;
}

function tick(s: GameState, dt: number): GameState {
  let current = s;
  const rawActivity = s.activity ?? { day: 1, claimed: [], lastClaimDate: "" };
  let activity = rawActivity;
  if (rawActivity.lastClaimDate && rawActivity.lastClaimDate !== todayStr() && rawActivity.lastClaimDate !== yesterdayStr()) {
    activity = { day: 1, claimed: [], lastClaimDate: rawActivity.lastClaimDate };
  }
  if (activity.lastClaimDate !== todayStr() && !s.modal) {
    current = { ...current, activity, modal: { t: "activity" } };
  } else if (activity !== rawActivity) {
    current = { ...current, activity };
  }
  if (s.daily.date !== todayStr() || s.weekly.week !== weekKey()) {
    current = {
      ...current,
      daily: s.daily.date !== todayStr()
        ? { date: todayStr(), kills: 0, bosses: 0, gold: 0, resources: 0, claimed: [], tickets: PARTY_TICKETS_DAILY }
        : s.daily,
      weekly: s.weekly.week !== weekKey() ? emptyWeekly() : s.weekly,
      duel: { ...s.duel, tokens: s.daily.date !== todayStr() ? Math.min(DUEL_TOKENS_MAX, s.duel.tokens + 1) : s.duel.tokens, rankClaimed: s.daily.date !== todayStr() ? false : s.duel.rankClaimed },
    };
    if (current.daily.date !== s.daily.date) toast(current, "Новый день: +1 жетон дуэлей", "gem");
  }
  const st = current.party ? partyTick(current, dt) : current.run.active ? runTick(current, dt) : farmTick(current, dt);
  if (st.duel.state === "idle" && !st.duel.fx.length) return st;
  const d2: GameState = {
    ...st, hero: { ...st.hero }, totals: { ...st.totals },
    duel: { ...st.duel, cds: { ...st.duel.cds }, fx: st.duel.fx.map(f => ({ ...f })), log: [...st.duel.log], foe: st.duel.foe ? { ...st.duel.foe } : null },
  };
  duelTick(d2, dt);
  return d2;
}

function farmTick(s: GameState, dt: number): GameState {
  if (!s.battle.enemy && !s.battle.fx.length && !s.buffs.length) {
    // даже без боя нужны сбросы дня/недели
    const daily = s.daily.date !== todayStr() ? { date: todayStr(), kills: 0, bosses: 0, gold: 0, resources: 0, claimed: [] as string[], tickets: PARTY_TICKETS_DAILY } : s.daily;
    const weekly = s.weekly?.week !== weekKey() ? emptyWeekly() : s.weekly;
    if (daily !== s.daily || weekly !== s.weekly) return { ...s, daily, weekly };
    return s;
  }
  const st: GameState = {
    ...s,
    hero: { ...s.hero },
    totals: { ...s.totals },
    daily: { ...s.daily, claimed: [...s.daily.claimed] },
    weekly: { ...s.weekly, claimed: [...s.weekly.claimed] },
    buffs: s.buffs.map(b => ({ ...b })),
    battle: { ...s.battle, cds: { ...s.battle.cds }, fx: s.battle.fx.map(f => ({ ...f })), log: [...s.battle.log] },
    duel: { ...s.duel, cds: { ...s.duel.cds }, fx: s.duel.fx.map(f => ({ ...f })), log: [...s.duel.log], foe: s.duel.foe ? { ...s.duel.foe } : null },
  };
  const B = st.battle;

  B.fx = B.fx.map(f => ({ ...f, life: f.life - dt })).filter(f => f.life > 0).slice(0, 16);

  if (st.buffs.length) {
    st.buffs = st.buffs.map(b => ({ ...b, t: b.t - dt })).filter(b => {
      if (b.t <= 0) pushLog(st, `Эффект «${b.label}» развеялся`);
      return b.t > 0;
    });
  }
  for (const k of Object.keys(B.cds)) if (B.cds[k] > 0) B.cds[k] = Math.max(0, B.cds[k] - dt);
  if (st.weekly.week !== weekKey()) st.weekly = emptyWeekly();

  // автовоскрешение — без модалок и кликов
  if (B.paused && B.respawnT > 0) {
    B.respawnT -= dt;
    if (B.respawnT <= 0) {
      B.respawnT = 0;
      B.paused = false;
      B.enemyT = 0;
      B.heroT = 0;
      const oldWave = B.wave;
      B.wave = Math.max(1, B.wave - DEATH_WAVE_ROLLBACK);
      B.enemy = spawnEnemy(B.zone, B.wave, false);
      st.hero.hp = getStats(st).maxHp;
      if (B.wave < oldWave) {
        pushLog(st, `Автовоскрешение! Откат на ${oldWave - B.wave} волн — фарм продолжается`);
      } else {
        pushLog(st, "Автовоскрешение! Помятый, но злой — снова в строю");
      }
      return st;
    }
  }

  if (!B.enemy || B.paused) return st;

  const stats = getStats(st);
  if (stats.regen > 0) st.hero.hp = Math.min(stats.maxHp, st.hero.hp + (stats.maxHp * stats.regen / 100) * dt);

  if (B.dotT > 0 && B.enemy) {
    B.dotT -= dt;
    B.enemy = { ...B.enemy, hp: B.enemy.hp - B.dotDps * dt };
    if (B.enemy.hp <= 0) killEnemy(st, stats);
  }
  if (B.enemy && !B.paused) {
    B.heroT += stats.as * dt;
    while (B.heroT >= 1 && B.enemy && !B.paused) { B.heroT -= 1; heroHit(st, stats, 1); }
  }
  if (B.enemy && !B.paused) {
    B.enemyT += B.enemy.as * dt;
    while (B.enemyT >= 1 && B.enemy && !B.paused) { B.enemyT -= 1; enemyHit(st, stats); }
  }

  // авто-каст скила (пассивные скилы — применяются сами, сразу как вышли из КД)
  if (B.enemy && !B.paused) {
    for (const def of SKILLS) {
      if (def.classId !== st.hero.classId) continue;
      if (st.hero.level < def.unlockLevel) continue;
      if ((B.cds[def.id] || 0) > 0) continue;
      B.cds[def.id] = def.cd * (1 - stats.cooldownPct / 100);
      st.totals.casts += 1;
      st.weekly.casts += 1;
      const lvl = st.skills[def.id] || 1;
      const dmg = Math.max(1, Math.round(stats.dmg * def.mult(lvl) * def.hits(lvl) * 0.6 * (1 + stats.extraSkillDamagePct / 100)));
      B.enemy = { ...B.enemy, hp: B.enemy.hp - dmg };
      if (def.slow && B.enemy) B.enemyT = Math.max(0, B.enemyT - 1);
      if (def.dotPct && B.enemy) { B.dotDps = stats.dmg * def.dotPct(lvl); B.dotT = 5; }
      pushLog(st, `«${def.name}» — ${fmt(dmg)} урона`);
      if (B.enemy.hp <= 0) { killEnemy(st, stats); break; }
    }
  }
  return st;
}

/* =============== events =============== */
function chooseEvent(s: GameState, idx: number): GameState {
  if (!s.modal || s.modal.t !== "event") return s;
  const id = s.modal.id;
  const st: GameState = {
    ...s, hero: { ...s.hero }, modal: null, buffs: [...s.buffs],
    battle: { ...s.battle, fx: [...s.battle.fx], log: [...s.battle.log] },
    totals: { ...s.totals, events: s.totals.events + 1 },
  };
  const stats = getStats(s);

  if (id === "toad") {
    if (idx === 0) {
      if (Math.random() < 0.5) {
        st.buffs.push({ id: "toad", label: "Поцелуй жабы", dmgMult: 1.3, t: 90 });
        pushLog(st, "Жаба чмокнула в ответ. Урон +30% на 90 сек!");
      } else {
        st.hero.hp = stats.maxHp;
        pushLog(st, "Жаба оказалась принцессой-целительницей. HP восстановлено");
      }
    } else {
      st.hero.gold += 60; st.totals.goldEarned += 60;
      pushLog(st, "Жаба вздохнула и отсыпала 60 золота на дорогу");
    }
  } else if (id === "chest") {
    if (idx === 0) {
      if (Math.random() < 0.6) {
        const g = 120 + st.hero.level * 40;
        st.hero.gold += g; st.totals.goldEarned += g;
        toast(st, `В сундуке ${g} золота!`, "gold");
      } else {
        st.hero.hp = Math.max(1, st.hero.hp - stats.maxHp * 0.2);
        pushLog(st, "ЭТО БЫЛ МИМИК! Откусил 20% HP и извинился");
      }
    } else {
      gainXp(st, 40 + st.hero.level * 10);
      pushLog(st, "Осторожность — тоже опыт. +XP");
    }
  } else if (id === "bard") {
    if (idx === 0) {
      gainXp(st, 60 + st.hero.level * 25);
      pushLog(st, "Баллада была так себе, но душа наполнилась. +XP");
    } else {
      if (st.hero.gold >= 40) {
        st.hero.gold -= 40;
        st.buffs.push({ id: "karma", label: "Карма гоблина", luckAdd: 60, t: 120 });
        pushLog(st, "Бард записал вас в «свои». Дроп +60% на 2 мин");
      } else {
        toast(st, "Не хватает 40 золота на барда", "warn");
      }
    }
  } else if (id === "goblin") {
    if (idx === 0) {
      if (st.hero.gold >= 60) {
        st.hero.gold -= 60;
        st.hero.potions += 1;
        pushLog(st, "Зелье куплено у стажёра. Шеф будет доволен");
      } else {
        toast(st, "Не хватает 60 золота", "warn");
      }
    } else {
      pushLog(st, "Гоблин ушёл в лес. Он там, кстати, работает");
    }
  }
  return st;
}

/* =============== persistence =============== */
export function saveGame(s: GameState) {
  try {
    const persistModal = s.modal?.t === "class" || s.modal?.t === "activity" ? s.modal : null;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s, lastSeen: Date.now(), meta: { ...(s.meta || {}), savedAt: Date.now() }, toasts: [], modal: persistModal }));
  } catch { /* noop */ }
}

// Приведение состояния к актуальной схеме (миграция со старых сейвов).
// Вызывается и при загрузке с диска, и при гидратации из облака.
export function migrateState(s: GameState): GameState {
  s.toasts = [];
  // Гарантируем наличие всех обязательных полей: старые/облачные сейвы могут не
  // содержать их, и тогда UI/редьюсер упадут (s.totals.kills, s.inv, s.daily.date…).
  // Берём отсутствующие поля из эталонного newGame().
  const ref = newGame();
  if (!s.inv) s.inv = [];
  if (!s.skills) s.skills = {};
  if (!s.passives) s.passives = {};
  if (!s.equip) s.equip = ref.equip;
  if (!s.totals) s.totals = { ...ref.totals };
  if (!s.hero) s.hero = { ...ref.hero };
  if (s.hero.gold == null) s.hero.gold = 100;
  if (s.hero.gems == null) s.hero.gems = 10;
  if (s.hero.potions == null) s.hero.potions = 2;
  s.daily = { ...ref.daily, ...(s.daily || {}), claimed: [...(s.daily?.claimed || [])] };
  if (!s.zones || s.zones < 1) s.zones = 1;
  if (!s.bossDone) s.bossDone = ZONES.map(() => false);
  if (!s.achClaimed) s.achClaimed = [];
  if (!s.questsClaimed) s.questsClaimed = [];
  if (!s.buffs) s.buffs = [];
  s.battle = {
    ...ref.battle,
    ...(s.battle || {}),
    cds: { ...ref.battle.cds, ...(s.battle?.cds || {}) },
    fx: [],
    log: [...(s.battle?.log || [])],
    respawnT: s.battle?.respawnT ?? 0,
  };
  if (s.vip == null) s.vip = 0;
  if (!s.slotLevel) s.slotLevel = { weapon: 0, helm: 0, amulet: 0, armor: 0, gloves: 0, boots: 0, ring1: 0, ring2: 0 };
  for (const sl of SLOTS) if (s.slotLevel[sl] == null) s.slotLevel[sl] = 0;
  if (!s.weekly || s.weekly.week !== weekKey()) s.weekly = emptyWeekly();
  else s.weekly = { ...emptyWeekly(), ...s.weekly, claimed: [...(s.weekly.claimed || [])] };
  if (!s.run) s.run = newRun();
  else s.run = { ...newRun(s.run.kind, s.run.depth), ...s.run, cds: { ...(s.run.cds || {}) }, relics: { ...(s.run.relics || {}) } };
  if (!s.activity) s.activity = { day: 1, claimed: [], lastClaimDate: "" };
  if (!s.run.kind) s.run = { ...s.run, kind: "exp" };
  if (s.shards == null) s.shards = 0;
  if (!s.meta) s.meta = {};
  if (s.bestWave == null) s.bestWave = 0;
  if (s.blood == null) s.blood = 0;
  if (s.godstone === undefined) s.godstone = null;
  if (!s.duel) s.duel = newDuel();
  else s.duel = { ...newDuel(), ...s.duel, cds: { ...(s.duel.cds || {}) }, fx: [], log: [...(s.duel.log || [])] };
  if (s.duel.rankClaimed === undefined) s.duel = { ...s.duel, rankClaimed: false };
  if (!s.resources) s.resources = {};
  if (s.resources.whetstone) { s.resources.stone_common = (s.resources.stone_common || 0) + s.resources.whetstone; delete s.resources.whetstone; }
  if (!s.autoSellRarities) s.autoSellRarities = {};
  if (!s.atlas) s.atlas = {};
  if (!s.seasonal) s.seasonal = { id: activeSeasonalEvent()?.id ?? "", points: 0, claimed: [] };
  if (s.modal?.t === "runpick") s.modal = null;
  s.duel.fx = [];
  if (s.duel.state === "search") s.duel = { ...s.duel, state: "idle", tokens: s.duel.tokens + 1 };
  if (s.party) {
    const maxHp = getStats(s).maxHp;
    s.party = {
      ...s.party,
      heroHp: s.party.heroHp ?? maxHp,
      heroMaxHp: s.party.heroMaxHp ?? maxHp,
      heroReviveT: s.party.heroReviveT ?? 0,
      mates: (s.party.mates ?? []).map((mate, index) => ({
        ...mate,
        level: mate.level ?? s.hero.level,
        bot: mate.bot ?? true,
        source: mate.source ?? "local",
        dps: mate.dps ?? getStats(s).dps * (0.42 + index * 0.06),
        reviveT: mate.reviveT ?? 0,
      })),
    };
  }
  // если герой застрял мёртвым в старом сейве — сразу воскрешаем
  if (s.hero.hp <= 0) s.hero = { ...s.hero, hp: Math.round(getStats(s).maxHp * 0.6) };
  if (s.battle.paused && s.battle.respawnT <= 0 && s.battle.enemy) s.battle.paused = false;
  return s;
}

export function loadGame(): GameState {
  let s: GameState;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return newGame();
    s = JSON.parse(raw) as GameState;
    if (!s || s.v !== 1 || !s.hero || !s.battle) return newGame();
  } catch {
    return newGame();
  }
  migrateState(s);
  const elapsed = (Date.now() - (s.lastSeen || Date.now())) / 1000;
  if (elapsed > 90 && s.battle.enemy && !s.battle.paused) {
    const stats = getStats(s);
    const sec = Math.min(elapsed, 8 * 3600);
    const gold = Math.round(stats.offline * sec);
    const xp = Math.round((stats.dps / 18) * sec * (1 + stats.xpPct / 100));
    s.hero = { ...s.hero, gold: s.hero.gold + gold };
    s.totals = { ...s.totals, goldEarned: s.totals.goldEarned + gold };
    gainXp(s, xp, true);
    s.modal = { t: "offline", gold, xp, sec };
  }
  s.lastSeen = Date.now();
  return s;
}
