import type { Rarity, StatKey } from "./types";

/**
 * Серверный конфиг баланса. Качается с /api/balance при старте и хранится здесь.
 * Если конфиг не загружен (нет сети/не запустился) — используются встроенные дефолты,
 * поэтому игра не ломается. Позволяет менять баланс без пересборки фронтенда.
 */

export interface StatBaseOverride { base: number; perIlvl: number; }

export interface BalanceConfig {
  rarityWeights: number[];     // 5 элементов: обычный..легендарный
  rarityLuckScale: number[];   // 5 элементов: коэфф. влияния удачи (знак как в коде)
  rarityMult: number[];        // 6 элементов: множители редкости 0..5
  statRollMin: number;
  statRollMax: number;
  statBase: Partial<Record<StatKey, StatBaseOverride>>;
  dropBaseChance: number;      // шанс дропа с обычного врага
  bossDropChance: number;      // шанс дропа с босса (0..1)
  bossExtraChance: number;     // шанс второго дропа с босса (0..1)
  potionChance: number;        // шанс зелья с врага
  ilvlZoneMult: number;        // ilvl = zone*mult + wave*? + bossBonus
  ilvlWaveAdd: number;
  ilvlBossBonus: number;
  // Враги: HP = (hpBase + zone*hpPerZone) * hpPow^(zone*12+wave) * (boss ? bossHpMult : 1)
  enemyHpBase: number;
  enemyHpPerZone: number;
  enemyHpPow: number;
  enemyDmgBase: number;
  enemyDmgPerZone: number;
  enemyDmgPow: number;
  bossHpMult: number;
  bossDmgMult: number;
}

export interface DropPoolEntry {
  source: string;     // "global" | "zone:N" | "enemy:KEY" | "boss:KEY"
  contentId: string;  // id сета (встроенный или кастомный) или id кастомного предмета
  chance: number;     // 0..100, свой % у каждого
  ilvlDelta: number;  // сдвиг ilvl относительно автоматического (может быть отрицательным)
}

export const DEFAULT_BALANCE: BalanceConfig = {
  rarityWeights: [46, 27, 15, 8, 4],
  rarityLuckScale: [-0.2, 0, 0.1, 0.08, 0.05],
  rarityMult: [1, 1.35, 1.8, 2.4, 3.2, 4.4],
  statRollMin: 0.85,
  statRollMax: 1.15,
  statBase: {},
  dropBaseChance: 0.34,
  bossDropChance: 1,
  bossExtraChance: 0.5,
  potionChance: 0.14,
  ilvlZoneMult: 12,
  // Лут постепенно догоняет рост мобов внутри зоны, иначе все обычные вещи
  // одной зоны имеют одинаковый ilvl независимо от достигнутой волны.
  ilvlWaveAdd: 0.5,
  ilvlBossBonus: 4,
  // Сглаженная кривая врагов: экспонента снижена (1.17->1.09 HP, 1.135->1.07 урон),
  // множитель босса смягчён (7->4 HP, 1.8->1.5 урон), чтобы шмот (линейный по ilvl) поспевал.
  enemyHpBase: 26,
  enemyHpPerZone: 14,
  enemyHpPow: 1.09,
  enemyDmgBase: 5,
  enemyDmgPerZone: 3.2,
  enemyDmgPow: 1.07,
  bossHpMult: 4,
  bossDmgMult: 1.5,
};

// Дефолтная база статов (дублирует прежние формулы).
const DEFAULT_STAT_BASE: Record<StatKey, { base: number; perIlvl: number }> = {
  dmg: { base: 2, perIlvl: 0.85 },
  dmgPct: { base: 3, perIlvl: 0.12 },
  hp: { base: 9, perIlvl: 2.1 },
  hpPct: { base: 2, perIlvl: 0 },
  armor: { base: 1.5, perIlvl: 0.45 },
  crit: { base: 2, perIlvl: 0 },
  critDmg: { base: 7, perIlvl: 0 },
  as: { base: 3, perIlvl: 0 },
  goldPct: { base: 4, perIlvl: 0 },
  xpPct: { base: 4, perIlvl: 0 },
  luck: { base: 2.5, perIlvl: 0 },
  regen: { base: 0.35, perIlvl: 0 },
};

let balance: BalanceConfig = { ...DEFAULT_BALANCE, statBase: {} };
let dropPools: DropPoolEntry[] = [];
let loaded = false;

export function balanceLoaded(): boolean {
  return loaded;
}

/** Нормализует и загружает конфиг с сервера. */
export function loadBalanceConfig(raw: unknown): void {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const b = r.balance as Record<string, unknown> | undefined;
  const pools = r.dropPools as unknown[] | undefined;

  const numArr = (v: unknown, len: number, def: number[]): number[] =>
    Array.isArray(v) && v.length === len && v.every(x => Number.isFinite(x))
      ? v.map(x => Number(x)) : def;
  const num = (v: unknown, def: number): number =>
    Number.isFinite(v) ? Number(v) : def;

  balance = {
    rarityWeights: numArr(b?.rarityWeights, 5, DEFAULT_BALANCE.rarityWeights),
    rarityLuckScale: numArr(b?.rarityLuckScale, 5, DEFAULT_BALANCE.rarityLuckScale),
    rarityMult: numArr(b?.rarityMult, 6, DEFAULT_BALANCE.rarityMult),
    statRollMin: num(b?.statRollMin, DEFAULT_BALANCE.statRollMin),
    statRollMax: num(b?.statRollMax, DEFAULT_BALANCE.statRollMax),
    statBase: {},
    dropBaseChance: num(b?.dropBaseChance, DEFAULT_BALANCE.dropBaseChance),
    bossDropChance: num(b?.bossDropChance, DEFAULT_BALANCE.bossDropChance),
    bossExtraChance: num(b?.bossExtraChance, DEFAULT_BALANCE.bossExtraChance),
    potionChance: num(b?.potionChance, DEFAULT_BALANCE.potionChance),
    ilvlZoneMult: num(b?.ilvlZoneMult, DEFAULT_BALANCE.ilvlZoneMult),
    ilvlWaveAdd: num(b?.ilvlWaveAdd, DEFAULT_BALANCE.ilvlWaveAdd),
    ilvlBossBonus: num(b?.ilvlBossBonus, DEFAULT_BALANCE.ilvlBossBonus),
    enemyHpBase: num(b?.enemyHpBase, DEFAULT_BALANCE.enemyHpBase),
    enemyHpPerZone: num(b?.enemyHpPerZone, DEFAULT_BALANCE.enemyHpPerZone),
    enemyHpPow: num(b?.enemyHpPow, DEFAULT_BALANCE.enemyHpPow),
    enemyDmgBase: num(b?.enemyDmgBase, DEFAULT_BALANCE.enemyDmgBase),
    enemyDmgPerZone: num(b?.enemyDmgPerZone, DEFAULT_BALANCE.enemyDmgPerZone),
    enemyDmgPow: num(b?.enemyDmgPow, DEFAULT_BALANCE.enemyDmgPow),
    bossHpMult: num(b?.bossHpMult, DEFAULT_BALANCE.bossHpMult),
    bossDmgMult: num(b?.bossDmgMult, DEFAULT_BALANCE.bossDmgMult),
  };
  if (b?.statBase && typeof b.statBase === "object") {
    for (const [k, v] of Object.entries(b.statBase as Record<string, unknown>)) {
      if (v && typeof v === "object" && Number.isFinite((v as StatBaseOverride).base)) {
        (balance.statBase as Record<string, StatBaseOverride>)[k] = {
          base: Number((v as StatBaseOverride).base),
          perIlvl: Number((v as StatBaseOverride).perIlvl) || 0,
        };
      }
    }
  }

  dropPools = (Array.isArray(pools) ? pools : []).filter(e => {
    const x = e as Record<string, unknown>;
    return x && typeof x.source === "string" && typeof x.contentId === "string"
      && Number.isFinite(x.chance);
  }).map(e => {
    const x = e as Record<string, unknown>;
    return {
      source: String(x.source),
      contentId: String(x.contentId),
      chance: Math.max(0, Math.min(100, Number(x.chance))),
      ilvlDelta: Number.isFinite(x.ilvlDelta) ? Number(x.ilvlDelta) : 0,
    };
  });
  loaded = true;
}

/** Текущий баланс. */
export function getBalance(): BalanceConfig {
  return balance;
}

/** Все пулы дропа. */
export function getDropPools(): DropPoolEntry[] {
  return dropPools;
}

/** Вес редкости с учётом удачи. */
export function rarityWeight(i: number, luck: number): number {
  const w = balance.rarityWeights[i] ?? DEFAULT_BALANCE.rarityWeights[i] ?? 0;
  const s = balance.rarityLuckScale[i] ?? 0;
  return Math.max(0, w + luck * s);
}

/** Множитель редкости. */
export function rarityMult(r: Rarity): number {
  return balance.rarityMult[r] ?? DEFAULT_BALANCE.rarityMult[r] ?? 1;
}

/** Случайный коэффициент разброса стата. */
export function statRoll(): number {
  const lo = balance.statRollMin;
  const hi = balance.statRollMax;
  return lo + Math.random() * (hi - lo);
}

/** База стата (значение без множителей). */
export function statValue(key: StatKey, ilvl: number): number {
  const ov = balance.statBase[key];
  if (ov) return ov.base + ov.perIlvl * ilvl;
  const d = DEFAULT_STAT_BASE[key];
  return d.base + d.perIlvl * ilvl;
}

/** Автоматический ilvl от источника. */
export function autoIlvl(zone: number, wave: number, boss: boolean): number {
  return zone * balance.ilvlZoneMult + wave * balance.ilvlWaveAdd + (boss ? balance.ilvlBossBonus : 0);
}
