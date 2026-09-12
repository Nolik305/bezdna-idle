import type { BaseSlot, ClassId, Item, Rarity, StatKey } from "./types";
import { rarityWeight, rarityMult, statValue, statRoll } from "./balanceConfig";

/* ================= CLASSES ================= */
export const CLASSES: Record<ClassId, {
  name: string; title: string; desc: string; color: string;
  base: { dmg: number; as: number; hp: number; crit: number };
}> = {
  mage: {
    name: "Маг", title: "Пиро-бездельник", color: "#4cc3ff",
    desc: "Бьёт редко, но так, что у боссов отваливается полоска HP. Стеклянная пушка с манией величия.",
    base: { dmg: 9.5, as: 0.85, hp: 95, crit: 5 },
  },
  archer: {
    name: "Лучница", title: "Штурмовик кустов", color: "#4ade80",
    desc: "Строчит стрелами как пулемёт, уворачивается от налогов и медленно, но верно закликивает врагов.",
    base: { dmg: 6.2, as: 1.4, hp: 115, crit: 9 },
  },
};

/* ================= SKILLS ================= */
export interface SkillDef {
  id: string; classId: ClassId; name: string; icon: string; cd: number;
  unlockLevel: number; desc: (lvl: number) => string;
  kind: "burst" | "multi" | "dot";
  mult: (lvl: number) => number; // per hit
  hits: (lvl: number) => number;
  dotPct?: (lvl: number) => number; // % of dmg per second
  slow?: boolean;
}

export const SKILLS: SkillDef[] = [
  {
    id: "fireball", classId: "mage", name: "Огненный шар", icon: "flame", cd: 6, unlockLevel: 1,
    kind: "burst", mult: l => 2.1 + 0.45 * l, hits: () => 1,
    desc: l => `Сгусток пламени на ${(210 + 45 * l)}% урона. Поджаривает даже совесть.`,
  },
  {
    id: "frost", classId: "mage", name: "Ледяной раскол", icon: "snow", cd: 10, unlockLevel: 3,
    kind: "burst", mult: l => 3 + 0.6 * l, hits: () => 1, slow: true,
    desc: l => `Лёд на ${(300 + 60 * l)}% урона, враг цепенеет и пропускает замах.`,
  },
  {
    id: "meteor", classId: "mage", name: "Метеор «Хрум»", icon: "meteor", cd: 24, unlockLevel: 6,
    kind: "burst", mult: l => 6.5 + 1.1 * l, hits: () => 1,
    desc: l => `Небо падает на ${(650 + 110 * l)}% урона. Боссы пишут жалобы.`,
  },
  {
    id: "triple", classId: "archer", name: "Тройной выстрел", icon: "arrows", cd: 6, unlockLevel: 1,
    kind: "multi", mult: l => 1.05 + 0.22 * l, hits: () => 3,
    desc: l => `3 стрелы по ${(105 + 22 * l)}% урона. Одна — в цель, две — для стиля.`,
  },
  {
    id: "poison", classId: "archer", name: "Гнилая стрела", icon: "venom", cd: 9, unlockLevel: 3,
    kind: "dot", mult: l => 1.1 + 0.2 * l, hits: () => 1, dotPct: l => 0.45 + 0.09 * l,
    desc: l => `Удар ${(110 + 20 * l)}% + яд ${(45 + 9 * l)}% урона/сек на 5 сек.`,
  },
  {
    id: "rain", classId: "archer", name: "Ливень стрел", icon: "rain", cd: 22, unlockLevel: 6,
    kind: "multi", mult: l => 0.7 + 0.13 * l, hits: () => 8,
    desc: l => `8 стрел по ${(70 + 13 * l)}% урона. Погода: дождь, местами боль.`,
  },
];

export const skillCost = (lvl: number) => Math.round(70 * Math.pow(2.15, lvl - 1));

/* ================= PASSIVES ================= */
export interface PassiveDef {
  id: string; name: string; icon: string; max: number;
  desc: (rank: number) => string; stat: string;
}
export const PASSIVES: PassiveDef[] = [
  { id: "power", name: "Мощь", icon: "sword", max: 10, stat: "dmgPct", desc: r => `+${8 * r}% к урону` },
  { id: "focus", name: "Фокус", icon: "target", max: 10, stat: "crit", desc: r => `+${(2.5 * r).toFixed(1)}% шанса крита` },
  { id: "vitality", name: "Живучесть", icon: "heart", max: 10, stat: "hpPct", desc: r => `+${8 * r}% к здоровью` },
  { id: "skin", name: "Каменная кожа", icon: "shield", max: 10, stat: "armor", desc: r => `+${6 * r} брони` },
  { id: "greed", name: "Жадность", icon: "coin", max: 10, stat: "goldPct", desc: r => `+${8 * r}% золота с врагов` },
  { id: "wisdom", name: "Мудрость", icon: "scroll", max: 10, stat: "xpPct", desc: r => `+${7 * r}% опыта` },
  { id: "fortune", name: "Удача", icon: "clover", max: 10, stat: "luck", desc: r => `+${5 * r}% к шансу дропа` },
  { id: "treasury", name: "Скрытая казна", icon: "chest", max: 10, stat: "offline", desc: r => `+${12 * r}% к офлайн-доходу` },
];

/* ================= ZONES & MOBS ================= */
export interface ZoneDef {
  name: string; flavor: string; mobs: string[]; boss: string; tint: string; endless?: boolean;
}
export const ZONES: ZoneDef[] = [
  { name: "Прелый лес", flavor: "Пахнет грибами и плохими решениями", mobs: ["slime", "shroom", "wolf"], boss: "treant", tint: "#7dc95e" },
  { name: "Костяные пещеры", flavor: "Скелеты тут работают за еду. Которую не едят", mobs: ["skel", "rat", "bat"], boss: "boneTyrant", tint: "#c9d4de" },
  { name: "Логово разбойников", flavor: "Вход бесплатный. Выход — по тарифу", mobs: ["bandit", "thrower", "ogre"], boss: "ataman", tint: "#e0a34e" },
  { name: "Цитадель Пустоты", flavor: "Здесь даже эхо говорит шёпотом", mobs: ["wisp", "golem", "acolyte"], boss: "devourer", tint: "#9b7bd8" },
  { name: "Бездна", flavor: "Бесконечный этаж. Лифт не предусмотрен", mobs: ["voidling", "golem", "wisp"], boss: "voidmaw", tint: "#ff6b8d", endless: true },
  { name: "Разлом Эха", flavor: "Здесь звук приходит раньше, чем его источник", mobs: ["voidling", "acolyte", "golem"], boss: "devourer", tint: "#7fe0d0" },
  { name: "Сад Костей", flavor: "Цветёт всё. К сожалению", mobs: ["skel", "shroom", "bat"], boss: "boneTyrant", tint: "#c9d4de" },
  { name: "Город Цепей", flavor: "В каждом доме жилец. На цепи", mobs: ["bandit", "golem", "wisp"], boss: "ataman", tint: "#e0a34e" },
  { name: "Трон Пустоты", flavor: "Трон занят. Давно. Навсегда", mobs: ["acolyte", "voidling", "wisp"], boss: "devourer", tint: "#9b7bd8" },
];

export const MOBS: Record<string, { n: string; c1: string; c2: string }> = {
  slime: { n: "Слизень-бухгалтер", c1: "#8ee06e", c2: "#4f8f3a" },
  shroom: { n: "Гнилошляп", c1: "#e06a5a", c2: "#8f3b30" },
  wolf: { n: "Лютый волк", c1: "#9fb2c8", c2: "#5a6b80" },
  treant: { n: "Гнилодрев", c1: "#7a5a34", c2: "#4a3620" },
  skel: { n: "Скелет-работяга", c1: "#e8e2d0", c2: "#9a947f" },
  rat: { n: "Крысолюд", c1: "#b08d6a", c2: "#6e5638" },
  bat: { n: "Летуха-крикуха", c1: "#8a7fae", c2: "#544b70" },
  boneTyrant: { n: "Костяной Тиран", c1: "#f0ead8", c2: "#a89f85" },
  bandit: { n: "Разбойник", c1: "#c8794a", c2: "#7c4526" },
  thrower: { n: "Метатель ножей", c1: "#a8b8c8", c2: "#5f7185" },
  ogre: { n: "Огр-вышибала", c1: "#9fbf6a", c2: "#5e7a3a" },
  ataman: { n: "Атаман Шлык", c1: "#d8a04a", c2: "#8a5f22" },
  wisp: { n: "Блуждающий огонёк", c1: "#7fe0d0", c2: "#2a8f80" },
  golem: { n: "Голем-консьерж", c1: "#8a93a8", c2: "#4a5266" },
  acolyte: { n: "Послушник Пустоты", c1: "#b49ae0", c2: "#6a4fa0" },
  devourer: { n: "Пожиратель Пустоты", c1: "#c77fe0", c2: "#7a2aa0" },
  voidling: { n: "Отголосок Бездны", c1: "#ff8fae", c2: "#a03a5f" },
  voidmaw: { n: "Отродье Бездны", c1: "#ff6b8d", c2: "#8f1f4a" },
};

export const KILL_PHRASES = [
  "{e} рассыпался на пиксели",
  "{e} ушёл перерождаться в жабу",
  "{e} выронил всё и обиделся",
  "Крит! {e} пишет жалобу в гильдию",
  "{e} узнал, что такое баланс... урона",
  "{e} передал привет респауну",
  "{e} выбыл. Ставки сделаны",
  "{e} телепортировался в небытие",
];

/* ================= ITEMS ================= */
export const RARITY: { name: string; color: string; mult: number }[] = [
  { name: "Обычный", color: "#9aa4b2", mult: 1 },
  { name: "Необычный", color: "#4ade80", mult: 1.35 },
  { name: "Редкий", color: "#38bdf8", mult: 1.8 },
  { name: "Эпический", color: "#c084fc", mult: 2.4 },
  { name: "Легендарный", color: "#fbbf24", mult: 3.2 },
  { name: "Бездна", color: "#ff4d6d", mult: 4.4 },
];

/* ================= СЕТ БЕЗДНЫ (Портал) ================= */
export const ABYSS_SET: Partial<Record<BaseSlot, { name: string; stats: Partial<Record<StatKey, number>> }>> = {
  weapon: { name: "Коготь Пожирателя", stats: { dmg: 16, dmgPct: 14, crit: 6 } },
  helm: { name: "Венец Пустоты", stats: { hp: 90, armor: 22, xpPct: 8 } },
  amulet: { name: "Око Бездны", stats: { crit: 9, critDmg: 28, dmgPct: 10 } },
  armor: { name: "Панцирь Отродья", stats: { armor: 30, hp: 120, regen: 1.4 } },
  gloves: { name: "Когтистые перчатки Бездны", stats: { as: 12, crit: 6, dmgPct: 8 } },
  boots: { name: "Поступь Тьмы", stats: { armor: 18, goldPct: 16, hp: 60 } },
  ring: { name: "Печатка Отродья", stats: { critDmg: 24, luck: 10, dmgPct: 10 } },
};
export const ABYSS_SET_BONUS = 3; // % урона и HP за каждую надетую вещь сета

export const SLOT_INFO: Record<BaseSlot, { n: string; icon: string }> = {
  weapon: { n: "Оружие", icon: "sword" },
  helm: { n: "Шлем", icon: "helm" },
  amulet: { n: "Амулет", icon: "amulet" },
  armor: { n: "Доспех", icon: "shield" },
  gloves: { n: "Перчатки", icon: "gloves" },
  boots: { n: "Сапоги", icon: "boots" },
  ring: { n: "Кольцо", icon: "ring" },
};

const BASE_NAMES: Record<BaseSlot, string[]> = {
  weapon: ["Клинок", "Жезл", "Посох", "Лук", "Кинжал", "Молот"],
  helm: ["Шлем", "Капюшон", "Венец", "Каска", "Тиара"],
  amulet: ["Амулет", "Кулон", "Оберег", "Медальон"],
  armor: ["Кираса", "Мантия", "Кольчуга", "Нагрудник"],
  gloves: ["Перчатки", "Рукавицы", "Наручи"],
  boots: ["Сапоги", "Ботинки", "Поножи"],
  ring: ["Кольцо", "Перстень", "Печатка"],
};

const PREFIX: string[][] = [
  ["Ржавый", "Потрёпанный", "Б/у"],
  ["Крепкий", "Ладный", "Смазанный"],
  ["Зачарованный", "Сияющий", "Грозный"],
  ["Проклятый", "Древний", "Бездонный"],
  ["Легендарный", "Божественный", "Хтонический"],
];

const SUFFIX = [
  "великого пончика", "хромой утки", "тысячи лягушек", "Грязного Шлыка",
  "последнего понедельника", "сырого подвала", "жадного гоблина",
  "утреннего кофе", "злого тапка", "восьмого носка",
];

const SLOT_STATS: Record<BaseSlot, StatKey[]> = {
  weapon: ["dmg", "dmgPct", "crit"],
  helm: ["hp", "armor", "xpPct"],
  amulet: ["crit", "dmgPct", "critDmg"],
  armor: ["armor", "hp", "regen"],
  gloves: ["as", "crit", "dmgPct"],
  boots: ["armor", "goldPct", "hp"],
  ring: ["critDmg", "luck", "dmgPct", "goldPct"],
};

// Гарантированный «сигнатурный» стат слота на эпик+ (редкость 3 и 4).
// Напр. перчатки всегда дают крит, оружие всегда флэт урон и т.д.
const SIGNATURE: Record<BaseSlot, StatKey> = {
  weapon: "dmg", helm: "hp", amulet: "critDmg", armor: "armor",
  gloves: "crit", boots: "armor", ring: "dmgPct",
};

const STAT_BASE: Record<StatKey, (ilvl: number) => number> = {
  dmg: il => 2 + il * 0.85,
  dmgPct: il => 3 + il * 0.12,
  hp: il => 9 + il * 2.1,
  hpPct: () => 2,
  armor: il => 1.5 + il * 0.45,
  crit: () => 2,
  critDmg: () => 7,
  as: () => 3,
  goldPct: () => 4,
  xpPct: () => 4,
  luck: () => 2.5,
  regen: () => 0.35,
};

export const STAT_LABEL: Record<StatKey, string> = {
  dmg: "Урон", dmgPct: "Урон %", hp: "Здоровье", hpPct: "Здоровье %", armor: "Броня",
  crit: "Крит %", critDmg: "Крит. урон %", as: "Скор. атаки %",
  goldPct: "Золото %", xpPct: "Опыт %", luck: "Удача %", regen: "Реген %/с",
};

export function rollRarity(min: number, luck: number): Rarity {
  const w = [0, 1, 2, 3, 4].map(i => rarityWeight(i, luck));
  for (let i = 0; i < min; i++) w[i] = 0;
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum <= 0) return 4;
  let r = Math.random() * sum;
  for (let i = 0; i < 5; i++) { r -= w[i]; if (r <= 0) return i as Rarity; }
  return 4;
}

export function genItem(ilvl: number, minRarity: number, classId: ClassId, luck: number, uid: number, forceBase?: BaseSlot): Item {
  const rarity = rollRarity(minRarity, luck);
  const base = forceBase ?? (Object.keys(SLOT_STATS) as BaseSlot[])[Math.floor(Math.random() * 7)];
  const pool = [...SLOT_STATS[base]];
  const nStats = rarity <= 1 ? rarity + 1 : 3;
  const stats: Partial<Record<StatKey, number>> = {};
  // Эпик+ (3,4): гарантированный «сигнатурный» стат слота (напр. перчатки всегда +крит, оружие всегда флэт урон).
  if (rarity >= 3) {
    const sig = SIGNATURE[base];
    const si = pool.indexOf(sig);
    if (si >= 0) {
      pool.splice(si, 1);
      let v = statValue(sig, ilvl) * rarityMult(rarity) * statRoll();
      if (sig === "dmg" && base === "weapon") v *= classId === "mage" ? 1.25 : 0.9;
      stats[sig] = sig === "dmg" || sig === "hp" ? Math.round(v) : Math.round(v * 10) / 10;
    }
  }
  while (Object.keys(stats).length < nStats && pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    const key = pool.splice(idx, 1)[0];
    let v = statValue(key, ilvl) * rarityMult(rarity) * statRoll();
    if (key === "dmg" && base === "weapon") v *= classId === "mage" ? 1.25 : 0.9;
    stats[key] = key === "dmg" || key === "hp" ? Math.round(v) : Math.round(v * 10) / 10;
  }
  const names = BASE_NAMES[base];
  let name = `${PREFIX[rarity][Math.floor(Math.random() * 3)]} ${names[Math.floor(Math.random() * names.length)].toLowerCase()}`;
  if (rarity >= 2 && Math.random() < 0.55) name += ` ${SUFFIX[Math.floor(Math.random() * SUFFIX.length)]}`;
  if (base === "weapon") {
    if (classId === "mage") name = name.replace(/^(\w+)\s(лук|кинжал|молот|клинок)/i, "$1 посох");
    if (classId === "archer") name = name.replace(/^(\w+)\s(посох|жезл|молот)/i, "$1 лук");
  }
  const sell = Math.round(Math.pow(rarity + 1, 2.1) * 9 + ilvl * 1.4);
  return { uid, base, name, rarity, ilvl, stats, sell };
}

export const INV_CAP = 40;

/* ================= QUESTS ================= */
export interface QuestDef {
  id: string; title: string; desc: string; metric: string; target: number;
  reward: { gold?: number; gems?: number; tokens?: number }; flavor: string;
}

/* ================= КАМЕНЬ БОГА ================= */
export const GODSTONE = {
  price: 40, // кристаллы за пробуждение
  cost: (lvl: number) => Math.round(400 * Math.pow(1.33, lvl)),
  chance: (lvl: number) => Math.max(1.5, Math.round(90 * Math.pow(0.92, lvl) * 10) / 10),
  desc: "бесконечная шкала: урон, HP, крит, скорость, удача, золото, опыт, броня",
};

/* ================= ДУЭЛИ ================= */
export const DUEL_NAMES = [
  "Шмыга Одноглазый", "Барон фон Тыква", "Лысый Джакомо", "Сэр Помидор",
  "Хозяйка Болота", "Граф Носок", "Ведьма с 8-го этажа", "Кузнец Хряк",
  "Тёмный Олег", "Инквизитор Булка", "Паладин Штифт", "Жнец-стажёр",
  "Королева Слизней", "Гном-переросток", "Мастер Меча (самоучка)", "Тень Утюга",
];
export const mmrRank = (mmr: number) =>
  mmr < 900 ? "Новичок" : mmr < 1150 ? "Боец" : mmr < 1400 ? "Гладиатор" :
  mmr < 1650 ? "Чемпион" : mmr < 1900 ? "Мастер" : "Легенда Бездны";
export const DUEL_TOKENS_START = 3;
export const DUEL_TOKENS_MAX = 10;

/* ================= АТЛАС: ВОСХОЖДЕНИЕ + ВЕТКИ ================= */
// Очки атласа: 1 за каждый уровень пути (до 40). Узлов суммарно ~125 рангов,
// поэтому на 40 очков хватает только на ~1/3 — есть выбор, всё взять нельзя (как в PoE).

export interface AscendancyDef {
  id: string; classId: ClassId; name: string; icon: string; color: string; desc: string;
  mods: Partial<Record<StatKey, number>>;
  lifesteal?: number;
  dodge?: number;
  dotPct?: number;
  cooldownPct?: number;
  extraSkillDamagePct?: number;
}
export const ASCENDANCIES: AscendancyDef[] = [
  { id: "pyro", classId: "mage", name: "Пиромант", icon: "flame", color: "#ff6b3d",
    desc: "Чистое пламя. Урон и криты пылают, враги горят.", mods: { dmgPct: 10, crit: 4 }, dotPct: 0.35 },
  { id: "cryo", classId: "mage", name: "Ледяной архимаг", icon: "snow", color: "#4cc3ff",
    desc: "Стужа и точность. Криты чаще и больнее, навыки быстрее.", mods: { crit: 8, critDmg: 12 }, cooldownPct: 20 },
  { id: "steel", classId: "archer", name: "Стальной стрелок", icon: "arrows", color: "#4ade80",
    desc: "Скорость и пробивание. Автокаст навыков наносит больше урона.", mods: { as: 10, dmgPct: 4 }, extraSkillDamagePct: 30 },
  { id: "venom", classId: "archer", name: "Отравитель", icon: "venom", color: "#c084fc",
    desc: "Яд, уклонение и вампиризм. Каждый удар кормит тебя.", mods: { critDmg: 14, luck: 6 }, lifesteal: 4, dodge: 10, dotPct: 0.5 },
];

export interface AtlasNodeDef {
  id: string; branch: "dmg" | "life" | "loot"; name: string; icon: string; max: number;
  mods: Partial<Record<StatKey, number>>; // за ранг
  desc: string;
}
// Каждый узел качается очками атласа (1 очко = 1 ранг). Всего ~125 рангов.
export const ATLAS_NODES: AtlasNodeDef[] = [
  // — Ветка УРОНА —
  { id: "d1", branch: "dmg", name: "Клинок", icon: "sword", max: 5, mods: { dmgPct: 2 }, desc: "+2% урона за ранг" },
  { id: "d2", branch: "dmg", name: "Глаз охотника", icon: "target", max: 5, mods: { crit: 1.2 }, desc: "+1.2% крита за ранг" },
  { id: "d3", branch: "dmg", name: "Смертоносность", icon: "skull", max: 5, mods: { critDmg: 4 }, desc: "+4% крит. урона за ранг" },
  { id: "d4", branch: "dmg", name: "Жажда боя", icon: "bolt", max: 5, mods: { dmgPct: 1.4, crit: 0.6 }, desc: "+1.4% урона и +0.6% крита за ранг" },
  { id: "d5", branch: "dmg", name: "Закалённая сталь", icon: "gear", max: 4, mods: { dmgPct: 2.5 }, desc: "+2.5% урона за ранг" },
  { id: "d6", branch: "dmg", name: "Точный расчёт", icon: "bow", max: 4, mods: { crit: 1.5, critDmg: 3 }, desc: "+1.5% крита и +3% крит. урона за ранг" },
  // — Ветка ВЫЖИВАНИЯ —
  { id: "l1", branch: "life", name: "Крепкая плоть", icon: "heart", max: 5, mods: { hpPct: 2 }, desc: "+2% макс. HP за ранг" },
  { id: "l2", branch: "life", name: "Крепкая броня", icon: "shield", max: 5, mods: { armor: 3 }, desc: "+3 брони за ранг" },
  { id: "l3", branch: "life", name: "Регенерация", icon: "drop", max: 5, mods: { regen: 0.12 }, desc: "+0.12% регена HP за ранг" },
  { id: "l4", branch: "life", name: "Живучесть", icon: "heart", max: 5, mods: { hpPct: 1.4, armor: 2 }, desc: "+1.4% HP и +2 брони за ранг" },
  { id: "l5", branch: "life", name: "Несокрушимость", icon: "stone", max: 4, mods: { hpPct: 2.5 }, desc: "+2.5% макс. HP за ранг" },
  { id: "l6", branch: "life", name: "Стоик", icon: "shield", max: 4, mods: { armor: 4, regen: 0.1 }, desc: "+4 брони и +0.1% регена за ранг" },
  // — Ветка ФАРМА —
  { id: "g1", branch: "loot", name: "Алчность", icon: "coin", max: 5, mods: { goldPct: 2.5 }, desc: "+2.5% золота за ранг" },
  { id: "g2", branch: "loot", name: "Удача", icon: "clover", max: 5, mods: { luck: 2 }, desc: "+2 удачи за ранг" },
  { id: "g3", branch: "loot", name: "Опыт", icon: "book", max: 5, mods: { xpPct: 1.8 }, desc: "+1.8% опыта за ранг" },
  { id: "g4", branch: "loot", name: "Сборщик", icon: "bag", max: 5, mods: { goldPct: 1.4, luck: 1.2 }, desc: "+1.4% золота и +1.2 удачи за ранг" },
  { id: "g5", branch: "loot", name: "Магнит монет", icon: "coin", max: 4, mods: { goldPct: 3 }, desc: "+3% золота за ранг" },
  { id: "g6", branch: "loot", name: "Находчивость", icon: "clover", max: 4, mods: { luck: 2.5, xpPct: 1.2 }, desc: "+2.5 удачи и +1.2% опыта за ранг" },
];
export const ATLAS_BRANCHES: { id: "dmg" | "life" | "loot"; name: string; icon: string; color: string }[] = [
  { id: "dmg", name: "Урон", icon: "sword", color: "#ff6b3d" },
  { id: "life", name: "Выживание", icon: "heart", color: "#4ade80" },
  { id: "loot", name: "Фарм", icon: "coin", color: "#f0b429" },
];

export const PATH_LEVEL_CAP = 40;
export const pathXpNeed = (lvl: number) => Math.round(120 * Math.pow(lvl, 1.85));
export const ATLAS_SWITCH_COST = 60; // кристаллы за смену восхождения


/* ================= СЕТЫ ================= */
export interface SetDef {
  id: string; name: string; path: string | null; tier: number; color: string; icon: string;
  pieces: BaseSlot[];
  bias: StatKey[];
  bonuses: { need: number; mods: Partial<Record<StatKey, number>> }[];
}
export const SETS: SetDef[] = [
  {
    id: "dawn", name: "Рассвет Аркана", path: "arcan", tier: 1, color: "#4cc3ff", icon: "star",
    pieces: ["weapon", "helm", "amulet", "armor", "ring"], bias: ["dmgPct", "crit", "xpPct"],
    bonuses: [
      { need: 2, mods: { dmgPct: 8 } },
      { need: 3, mods: { crit: 5, xpPct: 8 } },
      { need: 5, mods: { dmgPct: 14, critDmg: 22 } },
    ],
  },
  {
    id: "huntset", name: "Дикая Охота", path: "hunt", tier: 1, color: "#4ade80", icon: "arrows",
    pieces: ["weapon", "gloves", "boots", "helm", "ring"], bias: ["as", "crit", "dmgPct"],
    bonuses: [
      { need: 2, mods: { as: 8 } },
      { need: 3, mods: { crit: 6, dmgPct: 6 } },
      { need: 5, mods: { as: 10, critDmg: 20 } },
    ],
  },
  {
    id: "grave", name: "Хранитель Могил", path: "curse", tier: 2, color: "#c084fc", icon: "skull",
    pieces: ["weapon", "helm", "armor", "amulet", "boots"], bias: ["critDmg", "crit", "dmgPct"],
    bonuses: [
      { need: 2, mods: { critDmg: 18 } },
      { need: 3, mods: { crit: 6, dmgPct: 8 } },
      { need: 5, mods: { critDmg: 30, dmgPct: 12 } },
    ],
  },
  {
    id: "rabbit", name: "Лапа Кролика", path: "beast", tier: 2, color: "#f0b429", icon: "clover",
    pieces: ["gloves", "boots", "amulet", "ring", "helm"], bias: ["luck", "goldPct", "xpPct"],
    bonuses: [
      { need: 2, mods: { luck: 15 } },
      { need: 3, mods: { goldPct: 14, xpPct: 8 } },
      { need: 5, mods: { luck: 25, goldPct: 16 } },
    ],
  },
  {
    id: "feast", name: "Кровавый Пир", path: "flesh", tier: 3, color: "#ff6b8d", icon: "fang",
    pieces: ["weapon", "armor", "gloves", "ring", "amulet"], bias: ["hp", "dmgPct", "armor"],
    bonuses: [
      { need: 2, mods: { hpPct: 12 } },
      { need: 3, mods: { dmgPct: 10, regen: 0.8 } },
      { need: 5, mods: { hpPct: 18, dmgPct: 14 } },
    ],
  },
  {
    id: "idol", name: "Золотой Идол", path: null, tier: 3, color: "#ffd166", icon: "coin",
    pieces: ["amulet", "ring", "boots", "helm"], bias: ["goldPct", "luck", "xpPct"],
    bonuses: [
      { need: 2, mods: { goldPct: 18 } },
      { need: 3, mods: { luck: 18, xpPct: 8 } },
      { need: 4, mods: { goldPct: 26, luck: 20 } },
    ],
  },
  {
    id: "starweave", name: "Звёздный Ткач", path: "arcan", tier: 4, color: "#7ee8d6", icon: "spark",
    pieces: ["weapon", "amulet", "ring", "helm", "armor", "boots"], bias: ["xpPct", "dmgPct", "crit"],
    bonuses: [
      { need: 2, mods: { xpPct: 14 } },
      { need: 4, mods: { dmgPct: 12, crit: 6 } },
      { need: 6, mods: { xpPct: 20, dmgPct: 16, critDmg: 24 } },
    ],
  },
  {
    id: "bonecrown", name: "Костяная Корона", path: "curse", tier: 4, color: "#e8e2d0", icon: "crown",
    pieces: ["helm", "armor", "weapon", "gloves", "ring"], bias: ["crit", "armor", "hp"],
    bonuses: [
      { need: 2, mods: { armor: 30 } },
      { need: 3, mods: { crit: 8, hpPct: 8 } },
      { need: 5, mods: { critDmg: 26, armor: 40, hpPct: 10 } },
    ],
  },
  {
    id: "ironoath", name: "Железная Клятва", path: "flesh", tier: 2, color: "#9aa4b2", icon: "shield",
    pieces: ["armor", "helm", "gloves", "boots"], bias: ["armor", "hp", "regen"],
    bonuses: [
      { need: 2, mods: { armor: 24 } },
      { need: 3, mods: { hpPct: 10, regen: 0.6 } },
      { need: 4, mods: { armor: 36, hpPct: 12 } },
    ],
  },
  {
    id: "wildfang", name: "Клык Пустоши", path: "hunt", tier: 3, color: "#e0a34e", icon: "fang",
    pieces: ["weapon", "gloves", "boots", "ring"], bias: ["dmg", "as", "critDmg"],
    bonuses: [
      { need: 2, mods: { dmgPct: 9 } },
      { need: 3, mods: { as: 9, crit: 5 } },
      { need: 4, mods: { dmgPct: 14, critDmg: 24 } },
    ],
  },
];
export const SET_PIECE_NAMES: Record<BaseSlot, string> = {
  weapon: "Клык", helm: "Венец", amulet: "Оберег", armor: "Панцирь",
  gloves: "Хват", boots: "Поступь", ring: "Печать",
};
export const setPoolForTier = (tier: number): SetDef[] => SETS.filter(x => x.tier <= tier);

/* ================= ПАТИ-ПОДЗЕМЕЛЬЯ ================= */
export interface DungeonDef {
  tier: number; name: string; desc: string; bossKey: string;
  minLevel: number; needWins: number;
}
export const DUNGEONS: DungeonDef[] = [
  { tier: 1, name: "Погребок Шёпотов", desc: "Тихое место. Слишком тихое", bossKey: "treant", minLevel: 12, needWins: 0 },
  { tier: 2, name: "Костехранилище", desc: "Скелеты хранят тут не только кости", bossKey: "boneTyrant", minLevel: 18, needWins: 2 },
  { tier: 3, name: "Логово Атамана", desc: "Шлык дома. И он не один", bossKey: "ataman", minLevel: 25, needWins: 5 },
  { tier: 4, name: "Разлом Эха", desc: "Эхо здесь отвечает первым", bossKey: "devourer", minLevel: 32, needWins: 9 },
  { tier: 5, name: "Сердце Бездны", desc: "Финальная точка маршрута. Пока что", bossKey: "voidmaw", minLevel: 40, needWins: 14 },
];
export const PARTY_TICKETS_DAILY = 3;
export const PARTY_TIME = 60; // сек на убийство босса
export const MATE_NAMES = [
  "Борода из Бряцании", "Тихоня Лю", "Сэр Швабра", "Матушка Гроза",
  "Хмырь", "Дон Кихот 2.0", "Ведьмочка Чуча", "Капитан Очевидность",
];

export const LOGIN_REWARDS = [
  { gold: 500, gems: 5, potions: 2 },
  { gold: 1200, gems: 10, potions: 2 },
  { gold: 2500, gems: 15, potions: 3 },
  { gold: 5000, gems: 25, potions: 4 },
  { gold: 9000, gems: 40, potions: 5 },
  { gold: 15000, gems: 60, potions: 7 },
  { gold: 30000, gems: 150, potions: 10 },
] as const;
export const QUESTS: QuestDef[] = [
  { id: "q1", title: "Разминка", desc: "Победи 15 врагов", metric: "kills", target: 15, reward: { gold: 120 }, flavor: "Гильдия даёт новичкам самое грязное дело. Держи метлу... то есть меч." },
  { id: "q2", title: "Приодеться", desc: "Надень 3 предмета экипировки", metric: "equippedCount", target: 3, reward: { gold: 200, gems: 3 }, flavor: "Голый герой — плохая реклама для гильдии." },
  { id: "q3", title: "Фокус-покус", desc: "Примени навыки 5 раз", metric: "casts", target: 5, reward: { gold: 180 }, flavor: "Кнопки внизу сами себя не нажмут." },
  { id: "q4", title: "Первая голова", desc: "Победи босса", metric: "bosses", target: 1, reward: { gems: 10 }, flavor: "Гнилодрев сам себя не срубит." },
  { id: "q5", title: "Пятый уровень", desc: "Достигни 5 уровня", metric: "level", target: 5, reward: { gold: 350 }, flavor: "Борода растёт — опыт капает." },
  { id: "q6", title: "Гроза леса", desc: "Одолей босса Прелого леса", metric: "boss1", target: 1, reward: { gems: 12 }, flavor: "Лес больше не пахнет плохими решениями. Только пеплом." },
  { id: "q7", title: "Плюшкин", desc: "Собери 12 предметов в рюкзаке", metric: "invCount", target: 12, reward: { gold: 500 }, flavor: "«А вдруг пригодится» — девиз всех великих." },
  { id: "q8", title: "Заклинатель", desc: "Примени навыки 30 раз", metric: "casts", target: 30, reward: { gems: 15 }, flavor: "Мана не бесконечна. А вот энтузиазм — да." },
  { id: "q9", title: "Владыка пещер", desc: "Одолей Костяного Тирана", metric: "boss2", target: 1, reward: { gems: 25 }, flavor: "Тиран пал. В пещерах ввели демократию скелетов." },
  { id: "q10", title: "Легенда Бездны", desc: "Добудь легендарный предмет", metric: "legendaries", target: 1, reward: { gems: 50 }, flavor: "О таком луте слагают баллады. Призрак барда уже записывает." },
];

export const DAILIES: QuestDef[] = [
  { id: "d1", title: "Ежедневная зачистка", desc: "Победи 100 врагов сегодня", metric: "dkills", target: 100, reward: { gold: 250 }, flavor: "" },
  { id: "d2", title: "Охота на главаря", desc: "Победи 1 босса сегодня", metric: "dbosses", target: 1, reward: { gems: 5, tokens: 1 }, flavor: "" },
  { id: "d3", title: "Золотая лихорадка", desc: "Заработай 2000 золота сегодня", metric: "dgold", target: 2000, reward: { gems: 3 }, flavor: "" },
  { id: "d4", title: "Запасливый", desc: "Собери 25 ресурсов сегодня", metric: "dres", target: 25, reward: { gold: 300 }, flavor: "В чулане всегда есть место для ещё одной кучки хлама." },
];

export const WEEKLIES: QuestDef[] = [
  { id: "w1", title: "Неделя зачистки", desc: "Победи 500 врагов за неделю", metric: "wkills", target: 500, reward: { gold: 1500, gems: 15 }, flavor: "Гильдия объявила тотальную зачистку. Слизни создают профсоюз." },
  { id: "w2", title: "Гроза главарей", desc: "Победи 5 боссов за неделю", metric: "wbosses", target: 5, reward: { gems: 30, tokens: 2 }, flavor: "Пять голов — пять наград. Боссы скидываются на адвоката." },
  { id: "w3", title: "Скиллодром", desc: "Примени навыки 100 раз за неделю", metric: "wcasts", target: 100, reward: { gold: 1000, gems: 10 }, flavor: "Кнопки стёрлись до дыр. Это считается за кардио." },
  { id: "w4", title: "Кладовщик", desc: "Собери 150 ресурсов за неделю", metric: "wres", target: 150, reward: { gold: 1500, gems: 15 }, flavor: "Склад ломится. Инвентаризация отменяется на неопределённый срок." },
];

/* ================= ACHIEVEMENTS ================= */
export const ACHS: QuestDef[] = [
  { id: "a1", title: "Зачистка", desc: "100 побед", metric: "kills", target: 100, reward: { gems: 5 }, flavor: "" },
  { id: "a2", title: "Конвейер смерти", desc: "1000 побед", metric: "kills", target: 1000, reward: { gems: 20 }, flavor: "" },
  { id: "a3", title: "Гроза боссов", desc: "5 боссов", metric: "bosses", target: 5, reward: { gems: 15 }, flavor: "" },
  { id: "a4", title: "Меткий глаз", desc: "100 критов", metric: "crits", target: 100, reward: { gems: 5 }, flavor: "" },
  { id: "a5", title: "Скряга", desc: "10 000 золота за всё время", metric: "goldEarned", target: 10000, reward: { gems: 10 }, flavor: "" },
  { id: "a6", title: "Десятка", desc: "10 уровень", metric: "level", target: 10, reward: { gems: 10 }, flavor: "" },
  { id: "a7", title: "Ветеран Бездны", desc: "25 уровень", metric: "level", target: 25, reward: { gems: 30 }, flavor: "" },
  { id: "a8", title: "Охотник за легендами", desc: "1 легендарный предмет", metric: "legendaries", target: 1, reward: { gems: 10 }, flavor: "" },
  { id: "a9", title: "Модник", desc: "Заполни все 8 слотов", metric: "equippedCount", target: 8, reward: { gems: 15 }, flavor: "" },
  { id: "a10", title: "Глубоководье", desc: "Волна 50 (Бездна, волна 10)", metric: "maxWave", target: 50, reward: { gems: 15 }, flavor: "" },
  { id: "a11", title: "Аптечка", desc: "Выпей 10 зелий", metric: "potionsUsed", target: 10, reward: { gems: 5 }, flavor: "" },
  { id: "a12", title: "Бывалый", desc: "Умри хотя бы раз", metric: "deaths", target: 1, reward: { gems: 5 }, flavor: "" },
];

/* ================= EVENTS ================= */
export interface EventDef {
  id: string; icon: string; title: string; text: string;
  options: { label: string; hint: string }[];
}
export const EVENTS: EventDef[] = [
  {
    id: "toad", icon: "toad", title: "Целующаяся жаба",
    text: "Огромная жаба в короне преграждает путь и томно хлопает ресницами. «Поцелуй меня, герой, не пожалеешь... наверное».",
    options: [
      { label: "Поцеловать", hint: "???" },
      { label: "Вежливо отказаться", hint: "+60 золота на дорожные расходы" },
    ],
  },
  {
    id: "chest", icon: "chest", title: "Подозрительный сундук",
    text: "Посреди коридора стоит сундук. Слишком красивый. Из щелей доносится тихое хихиканье.",
    options: [
      { label: "Открыть", hint: "60% — золото, 40% — мимик" },
      { label: "Обойти", hint: "+40 опыта за осторожность" },
    ],
  },
  {
    id: "bard", icon: "ghost", title: "Призрак барда",
    text: "Полупрозрачный бард настраивает лютню: «О, герой! Баллада о твоих подвигах? Оплата — по настроению».",
    options: [
      { label: "Послушать балладу", hint: "Опыт и лёгкая грусть" },
      { label: "Кинуть 40 золота", hint: "Карма гоблина: +60% дропа на 2 мин" },
    ],
  },
  {
    id: "goblin", icon: "goblin", title: "Гоблин-стажёр",
    text: "«Здрасьте, я гоблин-стажёр из лавки. Шеф послал торговать в поле. Зелье будете? Почти не кусается».",
    options: [
      { label: "Купить зелье (60 зол.)", hint: "+1 зелье" },
      { label: "Послать в лес", hint: "Он и так знает дорогу" },
    ],
  },
];

/* ================= SHOP ================= */
export interface ShopDef {
  id: string; name: string; desc: string; icon: string;
  cost: number; currency: "gold" | "gems"; kind: "box" | "potion" | "boost"; minRarity?: number; boost?: { id: string; mult: number; seconds: number };
}
export const SHOP: ShopDef[] = [
  { id: "box1", name: "Мешок с хламом", desc: "Случайный предмет. Гоблин клянётся, что не кусается", icon: "bag", cost: 160, currency: "gold", kind: "box", minRarity: 0 },
  { id: "box2", name: "Сундук наёмника", desc: "Случайный предмет, необычный или лучше", icon: "chest", cost: 650, currency: "gold", kind: "box", minRarity: 1 },
  { id: "box3", name: "Королевский ларец", desc: "Случайный предмет, редкий или лучше. Блеск!", icon: "crown", cost: 25, currency: "gems", kind: "box", minRarity: 2 },
  { id: "potion", name: "Зелье бодрости", desc: "Лечит 45% HP в бою. На вкус — компот", icon: "flask", cost: 90, currency: "gold", kind: "potion" },
  { id: "boost_gold", name: "Свиток богатства", desc: "+100% золота на 5 минут", icon: "gold", cost: 30, currency: "gems", kind: "boost", boost: { id: "boost_gold", mult: 2, seconds: 300 } },
  { id: "boost_xp", name: "Свиток опыта", desc: "+100% опыта на 5 минут", icon: "xp", cost: 30, currency: "gems", kind: "boost", boost: { id: "boost_xp", mult: 2, seconds: 300 } },
];
export const shopCost = (def: ShopDef, buys: number) =>
  def.kind === "box" ? Math.round(def.cost * Math.pow(1.22, buys)) : def.cost;

/* ================= RESOURCES (крафт) ================= */
export interface ResourceDef {
  key: string; name: string; icon: string; color: string;
}
export const RESOURCES: ResourceDef[] = [
  { key: "wood", name: "Древесина", icon: "🪵", color: "#b5874e" },
  { key: "leather", name: "Кожа", icon: "🧶", color: "#c98f5f" },
  { key: "herb", name: "Травы", icon: "🌿", color: "#6fbf5a" },
  { key: "ore", name: "Руда", icon: "⛏️", color: "#9aa5b1" },
  { key: "bone", name: "Кости", icon: "🦴", color: "#e0d7c0" },
  { key: "crystal", name: "Кристалл", icon: "🔷", color: "#7fd4e8" },
  { key: "essence", name: "Эссенция", icon: "🌀", color: "#b98fe8" },
  { key: "gem", name: "Самоцвет", icon: "💎", color: "#f2c14e" },
  { key: "darkmatter", name: "Тёмная материя", icon: "🕳️", color: "#8f7bd8" },
  { key: "voidshard", name: "Осколок Бездны", icon: "🌑", color: "#ff6b8d" },
  { key: "stone_common", name: "Простой камень", icon: "🪨", color: "#9aa5b1" },
  { key: "stone_uncommon", name: "Необычный камень", icon: "🪨", color: "#4ade80" },
  { key: "stone_rare", name: "Редкий камень", icon: "🪨", color: "#38bdf8" },
  { key: "stone_epic", name: "Эпический камень", icon: "🪨", color: "#a855f7" },
  { key: "stone_legendary", name: "Легендарный камень", icon: "🪨", color: "#f0b429" },
];
export const RESOURCE_ICON: Record<string, string> = Object.fromEntries(RESOURCES.map(r => [r.key, r.icon]));

// Какие ресурсы падают в каждой зоне (индекс зоны → список).
export const ZONE_RESOURCES: Record<number, string[]> = {
  0: ["wood", "leather", "herb"],
  1: ["ore", "bone", "crystal"],
  2: ["herb", "leather", "essence"],
  3: ["crystal", "gem", "essence"],
  4: ["darkmatter", "voidshard", "essence"],
  5: ["essence", "gem", "crystal"],
  6: ["bone", "herb", "wood"],
  7: ["ore", "crystal", "darkmatter"],
  8: ["voidshard", "darkmatter", "gem"],
};

// Рецепты крафта.
export interface CraftRecipe {
  id: string; name: string; icon: string; desc: string;
  mats: { type: string; amount: number }[];
  result: { kind: "potion" | "gold" | "gem" | "item" | "stone"; value?: number; minRarity?: number; ilvlBonus?: number };
}
export const CRAFT_RECIPES: CraftRecipe[] = [
  { id: "c_potion", name: "Настой бодрости", icon: "🧪", desc: "Сварить 1 зелье (45% HP)", mats: [{ type: "herb", amount: 5 }], result: { kind: "potion", value: 1 } },
  { id: "c_potion5", name: "Аптечка гоблина", icon: "🧴", desc: "Сварить 5 зелий", mats: [{ type: "herb", amount: 20 }, { type: "wood", amount: 5 }], result: { kind: "potion", value: 5 } },
  { id: "c_stone0", name: "Простой камень", icon: "🪨", desc: "Крафт простого камня заточки (30%)", mats: [{ type: "ore", amount: 12 }, { type: "bone", amount: 6 }], result: { kind: "stone", value: 0 } },
  { id: "c_stone1", name: "Необычный камень", icon: "🪨", desc: "Крафт необычного камня заточки (45%)", mats: [{ type: "ore", amount: 20 }, { type: "crystal", amount: 8 }], result: { kind: "stone", value: 1 } },
  { id: "c_stone2", name: "Редкий камень", icon: "🪨", desc: "Крафт редкого камня заточки (60%)", mats: [{ type: "ore", amount: 30 }, { type: "gem", amount: 10 }], result: { kind: "stone", value: 2 } },
  { id: "c_gold", name: "Меняла", icon: "💰", desc: "Обменять ресурсы на 500 золота", mats: [{ type: "wood", amount: 15 }, { type: "leather", amount: 10 }], result: { kind: "gold", value: 500 } },
  { id: "c_gem", name: "Кристальная крошка", icon: "💎", desc: "Выжать 5 кристаллов из самоцветов", mats: [{ type: "gem", amount: 10 }, { type: "crystal", amount: 10 }], result: { kind: "gem", value: 5 } },
  { id: "c_item", name: "Кузня предков", icon: "⚒️", desc: "Выковать предмет (редкий+) под выбранный слот", mats: [{ type: "ore", amount: 25 }, { type: "crystal", amount: 15 }, { type: "essence", amount: 10 }], result: { kind: "item", minRarity: 2, ilvlBonus: 5 } },
  { id: "c_legend", name: "Легендарная кузня", icon: "⚔️", desc: "Гарантированно выковать легендарный предмет под выбранный слот", mats: [{ type: "gem", amount: 20 }, { type: "darkmatter", amount: 15 }, { type: "essence", amount: 20 }], result: { kind: "item", minRarity: 4, ilvlBonus: 8 } },
];

/* ================= РОГАЛИК: ДАРЫ БЕЗДНЫ ================= */
export interface RelicDef {
  id: string; name: string; icon: string; max: number; cursed?: boolean;
  desc: (rank: number) => string;
  // какие статы даёт за 1 ранг
  dmgPct?: number; as?: number; crit?: number; critDmg?: number; hpPct?: number;
  luck?: number; goldPct?: number; xpPct?: number; lifesteal?: number; thorns?: number;
  skillLvl?: number; bossGold?: number;
}
export const RELICS: RelicDef[] = [
  { id: "fang", name: "Клык ярости", icon: "fang", max: 3, dmgPct: 25, desc: r => `+${25 * r}% урона` },
  { id: "feather", name: "Перо сокола", icon: "feather", max: 3, as: 18, desc: r => `+${18 * r}% скорости атаки` },
  { id: "eye", name: "Глаз снайпера", icon: "target", max: 3, crit: 12, desc: r => `+${12 * r}% шанса крита` },
  { id: "heart2", name: "Бычье сердце", icon: "heart", max: 3, hpPct: 30, desc: r => `+${30 * r}% макс. HP` },
  { id: "clover2", name: "Клевер гоблина", icon: "clover", max: 3, luck: 25, desc: r => `+${25 * r}% удачи` },
  { id: "magnet", name: "Монетный магнит", icon: "coin", max: 3, goldPct: 35, desc: r => `+${35 * r}% золота` },
  { id: "crystal", name: "Кристалл мудрости", icon: "star", max: 3, xpPct: 30, desc: r => `+${30 * r}% опыта` },
  { id: "blood", name: "Кровавый клык", icon: "venom", max: 3, lifesteal: 8, desc: r => `Вампиризм: ${8 * r}% HP за убийство` },
  { id: "thorn", name: "Шипастая броня", icon: "thorn", max: 3, thorns: 60, desc: r => `Шипы: ${60 * r}% урона врагу за его удар` },
  { id: "focus", name: "Смертельный фокус", icon: "bolt", max: 3, critDmg: 40, desc: r => `+${40 * r}% крит. урона` },
  { id: "gambit", name: "Азарт бездны", icon: "spark", max: 2, skillLvl: 1, desc: r => `+${r} к уровню всех скилов в забеге` },
  { id: "idol", name: "Жадный идол", icon: "crown", max: 2, bossGold: 1, desc: r => `Золото с боссов ×${1 + r}` },
  { id: "cursed", name: "Проклятая сила", icon: "skull", max: 1, cursed: true, dmgPct: 60, hpPct: -25, desc: () => `+60% урона, но −25% макс. HP. Оно того стоит?` },
];

/* ================= РОГАЛИК: АЛТАРЬ (МЕТА) ================= */
export interface MetaDef {
  id: string; name: string; icon: string; max: number; cost: (rank: number) => number;
  desc: (rank: number) => string;
  dmgPct?: number; hpPct?: number; goldPct?: number; luck?: number; xpPct?: number; headstart?: number;
}
export const META: MetaDef[] = [
  { id: "temper", name: "Закалка", icon: "sword", max: 10, cost: r => 25 * (r + 1), dmgPct: 5, desc: r => `+${5 * r}% урона (везде)` },
  { id: "hide", name: "Шкура носорога", icon: "shield", max: 10, cost: r => 25 * (r + 1), hpPct: 6, desc: r => `+${6 * r}% HP (везде)` },
  { id: "hunch", name: "Предчувствие", icon: "clover", max: 10, cost: r => 20 * (r + 1), luck: 6, desc: r => `+${6 * r}% удачи (везде)` },
  { id: "greed", name: "Алчность", icon: "coin", max: 10, cost: r => 20 * (r + 1), goldPct: 10, desc: r => `+${10 * r}% золота (везде)` },
  { id: "savant", name: "Мудрец", icon: "book", max: 10, cost: r => 20 * (r + 1), xpPct: 8, desc: r => `+${8 * r}% опыта (везде)` },
  { id: "headstart", name: "Фора", icon: "spark", max: 3, cost: r => 60 * (r + 1), headstart: 1, desc: r => `Забег начинается с ${r} случайн. даром(ами)` },
];

export const RUN_WAVES = 20;
export const RUN_BOSS_EVERY = 5;
export const shardReward = (wave: number, bosses: number, win: boolean) =>
  wave * 2 + bosses * 10 + (win ? 100 : 0);

/* ================= VIP ================= */
export interface VipDef {
  name: string; color: string; cost: number;
  goldPct: number; xpPct: number; luck: number; dmgPct: number; hpPct: number; offlinePct: number;
  respawn: number; // секунды до автовоскрешения
  perks: string[];
}
export const VIP_LEVELS: VipDef[] = [
  {
    name: "Бронза", color: "#cd7f32", cost: 150,
    goldPct: 10, xpPct: 5, luck: 0, dmgPct: 0, hpPct: 0, offlinePct: 0, respawn: 2.5,
    perks: ["+10% золото", "+5% опыт", "Воскрешение за 2.5 с"],
  },
  {
    name: "Серебро", color: "#c9d4de", cost: 400,
    goldPct: 18, xpPct: 10, luck: 10, dmgPct: 0, hpPct: 0, offlinePct: 12, respawn: 2,
    perks: ["+18% золото", "+10% опыт", "+10 удача", "+12% офлайн-доход", "Воскрешение за 2 с"],
  },
  {
    name: "Золото", color: "#f0b429", cost: 900,
    goldPct: 28, xpPct: 15, luck: 18, dmgPct: 10, hpPct: 10, offlinePct: 25, respawn: 1.5,
    perks: ["+28% золото", "+15% опыт", "+18 удача", "+10% урон", "+10% HP", "Воскрешение за 1.5 с"],
  },
  {
    name: "Платина", color: "#9fd8e8", cost: 2000,
    goldPct: 40, xpPct: 22, luck: 28, dmgPct: 18, hpPct: 15, offlinePct: 40, respawn: 1,
    perks: ["+40% золото", "+22% опыт", "+28 удача", "+18% урон", "+15% HP", "Воскрешение за 1 с"],
  },
  {
    name: "Бездна", color: "#c084fc", cost: 4500,
    goldPct: 60, xpPct: 30, luck: 40, dmgPct: 30, hpPct: 25, offlinePct: 60, respawn: 0.5,
    perks: ["+60% золото", "+30% опыт", "+40 удача", "+30% урон", "+25% HP", "Воскрешение за 0.5 с"],
  },
];

/* ================= ЗАТОЧКА СЛОТОВ ================= */
// Бонус заточки: +10% ко всем статам предмета в слоте за каждый уровень.
// Привязана к слоту: сменил шмотку — бонус остался.
export const SLOT_UP_BONUS = 10; // % за уровень
export const SLOT_UP_MAX = 25;
export const slotUpCost = (lvl: number, ilvl: number) =>
  Math.round((80 + ilvl * 22) * Math.pow(1.6, lvl));

// Заточка: фикс. золото + 1 камень заточки. Шанс зависит от качества камня и падает с уровнем заточки.
export const SHARPEN_COST_GOLD = 500;
// Камни заточки: чем выше качество, тем выше базовый шанс.
export const SHARPEN_STONES = [
  { key: "stone_common", name: "Простой камень", chance: 30, color: "#9aa5b1" },
  { key: "stone_uncommon", name: "Необычный камень", chance: 45, color: "#4ade80" },
  { key: "stone_rare", name: "Редкий камень", chance: 60, color: "#38bdf8" },
  { key: "stone_epic", name: "Эпический камень", chance: 75, color: "#a855f7" },
  { key: "stone_legendary", name: "Легендарный камень", chance: 90, color: "#f0b429" },
] as const;
// Падение шанса за каждый уровень заточки (простой на 13-й заточке даёт ~1.4%).
export const SHARPEN_DROP_PER_LVL = 2.2;
export const SHARPEN_MIN_CHANCE = 1;
export const sharpenChance = (stoneIdx: number, level: number) => {
  const base = SHARPEN_STONES[stoneIdx]?.chance ?? 30;
  return Math.max(SHARPEN_MIN_CHANCE, Math.round(base - level * SHARPEN_DROP_PER_LVL));
};

/* ================= СЕЗОННЫЕ ИВЕНТЫ ================= */
// Ограниченные по времени события: во время окна (startTs..endTs) за игровую
// активность (убийства, золото, ресурсы) копятся очки ивента, которые открывают
// ступени наград. Время — epoch ms. Если событий несколько, активным считается
// то, чьё окно содержит текущий момент (при совпадении — с наибольшим приоритетом).
export type SeasonalMetric = "kills" | "bosses" | "gold" | "resources";

export interface SeasonalReward {
  gold?: number;
  gems?: number;
  potions?: number;
  box?: { minRarity: number; name: string };
}

export interface SeasonalTier {
  pts: number;              // сколько очков нужно для ступени
  reward: SeasonalReward;
  label: string;            // подпись награды (например, «Королевский ларец»)
}

export interface SeasonalEventDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  startTs: number;
  endTs: number;
  metric: SeasonalMetric;
  perPoint: number;         // сколько единиц метрики дают 1 очко
  tiers: SeasonalTier[];
}

const D = 24 * 3600 * 1000;

// Окно ивента = календарный месяц. Каждый ивент занимает свой месяц,
// поэтому в любой момент есть активный ивент (для теста и реальной игры).
function monthWindow(monthOffset: number): { startTs: number; endTs: number } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset + 1, 1, 0, 0, 0, 0));
  return { startTs: start.getTime(), endTs: end.getTime() };
}

const FEAST = monthWindow(0);
const HARVEST = monthWindow(1);
const COLLECT = monthWindow(2);

export const SEASONAL_EVENTS: SeasonalEventDef[] = [
  {
    id: "goblin_feast",
    name: "Пир Гоблина",
    icon: "goblin",
    desc: "Гоблины накрыли поляну. Убивай врагов — собирай очки на праздничный ларь.",
    startTs: FEAST.startTs,
    endTs: FEAST.endTs,
    metric: "kills",
    perPoint: 3,             // каждые 3 убийства = 1 очко
    tiers: [
      { pts: 5, reward: { gold: 300 }, label: "300 золота" },
      { pts: 12, reward: { potions: 2 }, label: "2 зелья" },
      { pts: 25, reward: { box: { minRarity: 2, name: "Королевский ларец" } }, label: "Королевский ларец" },
      { pts: 45, reward: { gems: 10 }, label: "10 кристаллов" },
      { pts: 70, reward: { box: { minRarity: 3, name: "Ларец редкости" } }, label: "Ларец редкости" },
    ],
  },
  {
    id: "harvest_moon",
    name: "Кровавая жатва",
    icon: "flame",
    desc: "Луна красна — боссы теряют голову. Собирай очки с убитых боссов и их золота.",
    startTs: HARVEST.startTs,
    endTs: HARVEST.endTs,
    metric: "bosses",
    perPoint: 1,             // каждый босс = 1 очко
    tiers: [
      { pts: 3, reward: { gold: 800 }, label: "800 золота" },
      { pts: 7, reward: { gems: 8 }, label: "8 кристаллов" },
      { pts: 14, reward: { box: { minRarity: 3, name: "Ларец редкости" } }, label: "Ларец редкости" },
    ],
  },
  {
    id: "collector",
    name: "Сборщик Бездны",
    icon: "bag",
    desc: "Бездна собирает ресурсы. Фарми зоны — копи очки ивента за добытые ресурсы.",
    startTs: COLLECT.startTs,
    endTs: COLLECT.endTs,
    metric: "resources",
    perPoint: 5,             // каждые 5 ресурсов = 1 очко
    tiers: [
      { pts: 10, reward: { gold: 400 }, label: "400 золота" },
      { pts: 25, reward: { box: { minRarity: 2, name: "Королевский ларец" } }, label: "Королевский ларец" },
      { pts: 50, reward: { gems: 15 }, label: "15 кристаллов" },
    ],
  },
];

/** Активный сезонный ивент в момент времени now (epoch ms), или null. */
export function activeSeasonalEvent(now = Date.now()): SeasonalEventDef | null {
  const hits = SEASONAL_EVENTS.filter(e => now >= e.startTs && now <= e.endTs);
  if (!hits.length) return null;
  // при совпадении окон берём самый «свежий» (по концу окна)
  hits.sort((a, b) => b.endTs - a.endTs);
  return hits[0];
}
