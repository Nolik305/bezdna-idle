export type ClassId = "mage" | "archer";

export type BaseSlot = "weapon" | "helm" | "amulet" | "armor" | "gloves" | "boots" | "ring";
export type Slot = Exclude<BaseSlot, "ring"> | "ring1" | "ring2";
export type Rarity = 0 | 1 | 2 | 3 | 4 | 5; // 5 = «Бездна» (сет Портала)

export type StatKey =
  | "dmg" | "dmgPct" | "hp" | "hpPct" | "armor" | "crit" | "critDmg"
  | "as" | "goldPct" | "xpPct" | "luck" | "regen";

export interface Item {
  uid: number;
  base: BaseSlot;
  name: string;
  rarity: Rarity;
  ilvl: number;
  stats: Partial<Record<StatKey, number>>;
  sell: number;
  abyss?: boolean; // предмет Сета Бездны
  set?: string; // id сета (атлас)
}

export interface Enemy {
  key: string;
  name: string;
  hp: number;
  maxHp: number;
  dmg: number;
  as: number;
  boss: boolean;
  gold: number;
  xp: number;
}

export interface Fx {
  id: number;
  text: string;
  kind: "dmg" | "crit" | "hurt" | "heal" | "gold" | "xp";
  x: number; // 0..100
  y: number; // 0..100
  life: number;
}

export interface Buff {
  id: string;
  label: string;
  t: number;
  dmgMult?: number;
  luckAdd?: number;
  goldMult?: number;
  xpMult?: number;
}

export interface HeroS {
  classId: ClassId;
  name: string;
  level: number;
  xp: number;
  skillPoints: number;
  gold: number;
  gems: number;
  potions: number;
  hp: number;
}

export interface BattleS {
  zone: number;
  wave: number;
  enemy: Enemy | null;
  heroT: number;
  enemyT: number;
  dotDps: number;
  dotT: number;
  skillT: number; // таймер авто-каста скила
  cds: Record<string, number>;
  fx: Fx[];
  log: string[];
  paused: boolean;
  respawnT: number; // автовоскрешение: сек до возрождения (0 = не мёртв)
  bossLocked: boolean; // босс отбил атаку — нужен ручной призыв
}

export interface TotalsS {
  kills: number;
  bosses: number;
  crits: number;
  goldEarned: number;
  dmgDealt: number;
  items: number;
  legendaries: number;
  maxWave: number;
  deaths: number;
  casts: number;
  potions: number;
  events: number;
  questsDone: number;
  partyWins: number; // победы в пати-подземельях
  setPieces: number; // добыто сетовых вещей
}

export interface DailyS {
  date: string;
  kills: number;
  bosses: number;
  gold: number;
  resources: number; // собранные ресурсы за день (квесты крафта)
  claimed: string[];
  tickets: number; // билеты пати-подземелий (восполняются ежедневно)
}

export interface ActivityS {
  day: number;
  claimed: number[];
  lastClaimDate: string;
}

export interface WeeklyS {
  week: string;
  kills: number;
  bosses: number;
  gold: number;
  casts: number;
  resources: number;
  claimed: string[];
}

// Прогресс сезонного ивента (ограничен по времени).
export interface SeasonalS {
  id: string;          // id текущего активного ивента ("" — нет)
  points: number;      // накопленные очки события
  claimed: number[];   // индексы забранных наград-ступеней
}

export interface DuelFoe {
  name: string;
  classId: ClassId;
  mmr: number;
  hp: number;
  maxHp: number;
  dmg: number;
  as: number;
  crit: number;
  critDmg: number;
  power: number;
  serverId?: number; // id реального игрока с сервера (если соперник реальный)
  isBot?: boolean;   // true — локальный бот (нет реального противника)
}

export interface DuelS {
  state: "idle" | "search" | "confirm" | "fight" | "result";
  mmr: number;
  tokens: number;
  wins: number;
  losses: number;
  searchT: number;
  foe: DuelFoe | null;
  heroHp: number;
  heroT: number;
  foeT: number;
  skillT: number;
  foeSkillT: number;
  dotDps: number;
  dotT: number;
  cds: Record<string, number>;
  fx: Fx[];
  log: string[];
  result: "win" | "lose" | null;
  delta: number;
  reward: number;
  rankClaimed: boolean; // забрана ли ежедневная награда за ранг сегодня
}

export interface PartyMate {
  name: string;
  classId: ClassId;
  level: number;
  bot: boolean;
  source: "server" | "local";
  hp: number;
  maxHp: number;
  dps: number;
  reviveT: number;
}

export interface PartyBotProfile {
  name: string;
  classId: ClassId;
  level: number;
  power: number;
  source?: "server" | "local";
}

export interface PartyS {
  tier: number;
  bossKey: string;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  bossDmg: number;
  t: number; // оставшееся время
  atkT: number;
  heroHp: number;
  heroMaxHp: number;
  heroReviveT: number;
  mates: PartyMate[];
  state: "fight" | "win" | "fail";
  reward: { gold: number; gems: number; pathXp: number; setItem: string | null };
}

export interface RunS {
  active: boolean;
  kind: "exp" | "portal"; // экспедиция или Портал Бездны
  depth: number; // глубина Портала (1 = Бездна I)
  wave: number; // 1..20
  enemy: Enemy | null;
  heroT: number;
  enemyT: number;
  skillT: number;
  dotDps: number;
  dotT: number;
  hp: number;
  maxHp: number;
  cds: Record<string, number>;
  relics: Record<string, number>; // id -> rank
  bosses: number;
  goldEarned: number;
}

export type Modal =
  | { t: "class" }
  | { t: "offline"; gold: number; xp: number; sec: number }
  | { t: "event"; id: string }
  | { t: "levelup"; level: number }
  | { t: "activity" }
  | { t: "runpick"; options: string[] }
  | { t: "runover"; wave: number; shards: number; win: boolean };

export interface Toast { id: number; text: string; kind: "info" | "gold" | "loot" | "warn" | "gem"; }

export interface GameState {
  v: number;
  hero: HeroS;
  equip: Record<Slot, Item | null>;
  inv: Item[];
  skills: Record<string, number>;
  passives: Record<string, number>;
  battle: BattleS;
  zones: number;
  bossDone: boolean[];
  totals: TotalsS;
  achClaimed: string[];
  questsClaimed: string[];
  resources: Record<string, number>; // ресурсы крафта (wood, ore, leather...)
  buffs: Buff[];
  toasts: Toast[];
  modal: Modal | null;
  daily: DailyS;
  activity: ActivityS;
  weekly: WeeklyS;
  vip: number; // 0..5
  slotLevel: Record<Slot, number>; // заточка слотов (привязана к слоту, не к предмету)
  run: RunS; // рогалик-режим «Экспедиция» / «Портал Бездны»
  shards: number; // осколки бездны — мета-валюта
  meta: Record<string, number>; // мета-апгрейды (Алтарь)
  bestWave: number;
  blood: number; // кровь демона — ключ к Порталу Бездны
  godstone: number | null; // Камень Бога: null — не пробуждён, иначе уровень 0..∞
  duel: DuelS; // дуэли с MMR
  portalDepth: number; // открытая глубина Портала (1 = Бездна I)
  path: string | null; // выбранное восхождение (ascendancy)
  pathXp: number; // опыт атласа (1 очко = 1 уровень пути)
  atlas: Record<string, number>; // ранги узлов атласа (nodeId -> rank)
  party: PartyS | null; // пати-подземелье
  autoSellRarities: Record<string, boolean>; // редкости для автопродажи
  seasonal: SeasonalS; // прогресс сезонного ивента
  shopBuys: Record<string, number>;
  lastSeen: number;
  uidSeq: number;
  fxSeq: number;
  toastSeq: number;
}

export interface Stats {
  dmg: number;
  dps: number;
  as: number;
  crit: number;
  critDmg: number;
  maxHp: number;
  armor: number;
  mit: number;
  goldPct: number;
  xpPct: number;
  luck: number;
  regen: number;
  offline: number;
  lifesteal: number;
  dodge: number;
  dotPct: number;
  cooldownPct: number;
  extraSkillDamagePct: number;
}

export type Action =
  | { type: "TICK"; dt: number }
  | { type: "HYDRATE_STATE"; state: GameState }
  | { type: "INBOX_ADD"; items: Item[] }
  | { type: "CHOOSE_CLASS"; classId: ClassId; name: string }
  | { type: "SET_ZONE"; zone: number }
  | { type: "CAST"; id: string }
  | { type: "USE_POTION" }
  | { type: "EQUIP"; uid: number }
  | { type: "UNEQUIP"; slot: Slot }
  | { type: "SELL"; uid: number }
  | { type: "SELL_JUNK" }
  | { type: "TOGGLE_AUTO_SELL"; rarity: number }
  | { type: "BUY_SHOP"; id: string }
  | { type: "LEVEL_SKILL"; id: string }
  | { type: "LEVEL_PASSIVE"; id: string }
  | { type: "CLAIM_QUEST"; id: string }
  | { type: "CLAIM_DAILY"; id: string }
  | { type: "CLAIM_WEEKLY"; id: string }
  | { type: "CLAIM_ACH"; id: string }
  | { type: "CHOOSE_EVENT"; idx: number }
  | { type: "UPGRADE_SLOT"; slot: Slot; stone: number }
  | { type: "BUY_VIP" }
  | { type: "START_RUN"; kind: "exp" | "portal"; depth?: number }
  | { type: "ABANDON_RUN" }
  | { type: "RUN_CAST"; id: string }
  | { type: "RUN_USE_POTION" }
  | { type: "RUN_PICK"; id: string }
  | { type: "RUN_CLOSE" }
  | { type: "BUY_META"; id: string }
  | { type: "BUY_GODSTONE" }
  | { type: "UP_GODSTONE" }
  | { type: "DUEL_SEARCH" }
  | { type: "DUEL_FOUND"; opponent?: { name: string; classId: ClassId; mmr: number; power: number; serverId?: number } | null }
  | { type: "DUEL_CAST"; id: string }
  | { type: "DUEL_CLOSE" }
  | { type: "DUEL_CONFIRM" }
  | { type: "DUEL_RANK_CLAIM"; gold: number; gems: number }
  | { type: "DUEL_MMR_SET"; mmr: number }
  | { type: "SUMMON_BOSS" }
  | { type: "CHOOSE_PATH"; id: string }
  | { type: "ATLAS_UP"; id: string }
  | { type: "PARTY_START"; tier: number; bots?: PartyBotProfile[] }
  | { type: "PARTY_CLOSE" }
  | { type: "CLAIM_AD_OFFLINE"; gold: number; xp: number }
  | { type: "CLAIM_ACTIVITY" }
  | { type: "CLAIM_SEASON_TIER"; idx: number }
  | { type: "CRAFT"; id: string }
  | { type: "CRAFT_SLOT"; id: string; slot: Slot }
  | { type: "CLOSE_MODAL" }
  | { type: "DISMISS_TOAST"; id: number }
  | { type: "RESET" };
