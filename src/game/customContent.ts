import type { BaseSlot, ClassId, Item, Rarity, StatKey } from "./types";
import type { SetDef } from "./data";
import type { AdminContent } from "../platform/vk";

/**
 * Кастомный контент, созданный через админку. Загружается асинхронно с сервера
 * и хранится в этом singleton-модуле. Редуктор читает его синхронно при дропе.
 */
let customSets: SetDef[] = [];
let customItems: Item[] = [];
let itemDropChances: Record<number, number> = {}; // uid -> drop_chance (0..100)
let customItemsById: Record<string, Item> = {}; // contentId (DB id) -> Item
let customSetsById: Record<string, SetDef> = {}; // contentId (DB id) -> SetDef
let loaded = false;

export function customLoaded(): boolean {
  return loaded;
}

/** Разбирает кастомный контент с сервера в сеты и предметы. */
export function registerCustomContent(contents: AdminContent[]): void {
  const sets: SetDef[] = [];
  const items: Item[] = [];
  const chances: Record<number, number> = {};
  const itemsById: Record<string, Item> = {};
  const setsById: Record<string, SetDef> = {};
  for (const c of contents) {
    const d = c.data as Record<string, unknown>;
    if (c.kind === "set") {
      // Пытаемся собрать SetDef из произвольного набора полей.
      const pieces = Array.isArray(d.pieces) ? (d.pieces as BaseSlot[]) : [];
      const bonuses = Array.isArray(d.bonuses) ? (d.bonuses as SetDef["bonuses"]) : [];
      if (!c.id || !pieces.length) continue;
      const def: SetDef = {
        id: c.id,
        name: c.name || String(d.name || c.id),
        path: (d.path as SetDef["path"]) ?? null,
        tier: Math.max(1, Math.min(5, Number(d.tier) || 1)),
        color: String(d.color || "#f0b429"),
        icon: String(d.icon || "spark"),
        pieces,
        bias: Array.isArray(d.bias) ? (d.bias as StatKey[]) : [],
        bonuses,
      };
      sets.push(def);
      setsById[c.id] = def;
    } else {
      // Кастомный предмет: фиксированные статы, как готовый Item.
      const stats = (d.stats && typeof d.stats === "object" ? d.stats : {}) as Partial<Record<StatKey, number>>;
      const base = (["weapon", "helm", "amulet", "armor", "gloves", "boots", "ring"] as BaseSlot[]).includes(d.base as BaseSlot)
        ? (d.base as BaseSlot) : "weapon";
      const rarity = Math.max(0, Math.min(5, Number(d.rarity) || 1)) as Rarity;
      const ilvl = Math.max(1, Math.min(9999, Number(d.ilvl) || 1));
      const item: Item = {
        uid: Date.now() + items.length,
        base,
        name: c.name || String(d.name || "Артефакт"),
        rarity,
        ilvl,
        stats,
        sell: Math.max(1, Number(d.sell) || Math.round(60 + ilvl * 3)),
      };
      items.push(item);
      itemsById[c.id] = item;
      chances[item.uid] = Math.max(0, Math.min(100, c.drop_chance || 0));
    }
  }
  customSets = sets;
  customItems = items;
  itemDropChances = chances;
  customItemsById = itemsById;
  customSetsById = setsById;
  loaded = true;
}

/** Кастомные сеты для пула дропа. */
export function getCustomSets(): SetDef[] {
  return customSets;
}

/** Кастомный предмет, если сработал шанс дропа; иначе null. */
export function rollCustomItem(uid: number): Item | null {
  for (const it of customItems) {
    const chance = itemDropChances[it.uid] ?? 0;
    if (chance > 0 && Math.random() * 100 < chance) {
      return { ...it, uid };
    }
  }
  return null;
}

/** Все кастомные предметы (для админки). */
export function getCustomItems(): Item[] {
  return customItems;
}

/** Кастомный предмет по contentId (DB id). */
export function getCustomItemById(id: string): Item | null {
  const it = customItemsById[id];
  return it ? { ...it } : null;
}

/** Кастомный сет по contentId (DB id). */
export function getCustomSetById(id: string): SetDef | null {
  const s = customSetsById[id];
  return s ? { ...s } : null;
}

export type { ClassId };
