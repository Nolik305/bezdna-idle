import type { Item, BaseSlot } from "./types";

/* =========================================================================
   СПРАЙТЫ МОБОВ И ШМОТОК
   Файлы лежат в public/sprites/{mobs,items}/*.png (Vite отдаёт их как статику).
   Моб выбирает вариант спрайта по элементу зоны (по зоне/элементу).
   ========================================================================= */

const SPRITE_BASE = import.meta.env.BASE_URL; // "./" в проде, "/" в dev
const pad = (n: number) => String(n).padStart(3, "0");
const mobPath = (n: number) => `${SPRITE_BASE}sprites/mobs/mob_${pad(n)}.png`;
const itemPath = (n: number) => `${SPRITE_BASE}sprites/items/item_${pad(n)}.png`;

/* Элемент зоны по индексу зоны (0-8).
   Соответствует палитре спрайтов: nature/bone/fire/void/abyss/echo. */
const ZONE_ELEM = ["nature", "bone", "fire", "void", "abyss", "echo", "bone", "fire", "void"] as const;
type Elem = (typeof ZONE_ELEM)[number];

/* Для каждого моба игры — номер спрайта по элементу. Пропущенные элементы
   повторяют ближайший вариант (fallback). */
const MOB_ELEM: Record<string, Partial<Record<Elem, number>>> = {
  slime: { nature: 1, bone: 6, fire: 4, void: 3, abyss: 5, echo: 2 },
  shroom: { nature: 91, bone: 89, fire: 88, void: 90, abyss: 88, echo: 89 },
  wolf: { nature: 20, bone: 22, fire: 23, void: 21, abyss: 23, echo: 21 },
  skel: { nature: 9, bone: 9, fire: 67, void: 70, abyss: 68, echo: 66 },
  rat: { nature: 85, bone: 85, fire: 87, void: 86, abyss: 87, echo: 85 },
  bat: { nature: 15, bone: 15, fire: 16, void: 14, abyss: 17, echo: 15 },
  bandit: { nature: 8, bone: 8, fire: 8, void: 8, abyss: 8, echo: 8 },
  thrower: { nature: 7, bone: 7, fire: 7, void: 7, abyss: 7, echo: 7 },
  ogre: { nature: 24, bone: 24, fire: 27, void: 25, abyss: 27, echo: 26 },
  wisp: { nature: 42, bone: 46, fire: 44, void: 43, abyss: 47, echo: 41 },
  golem: { nature: 51, bone: 50, fire: 52, void: 54, abyss: 55, echo: 53 },
  acolyte: { nature: 36, bone: 37, fire: 40, void: 39, abyss: 38, echo: 37 },
  voidling: { nature: 29, bone: 30, fire: 99, void: 28, abyss: 99, echo: 30 },
};

/* Боссы зон — отдельный (крупный) спрайт. */
const BOSS_ELEM: Record<string, number> = {
  treant: 102,
  boneTyrant: 10,
  ataman: 104,
  devourer: 105,
  voidmaw: 106,
};

/** Возвращает путь к спрайту моба (или null, если для него нет спрайта). */
export function mobSprite(key: string, boss: boolean, zone: number): string | null {
  if (boss && BOSS_ELEM[key]) return mobPath(BOSS_ELEM[key]);
  const m = MOB_ELEM[key];
  if (!m) return null;
  const elem = ZONE_ELEM[zone] ?? "nature";
  const n = m[elem] ?? Object.values(m)[0];
  return n ? mobPath(n) : null;
}

/* ================= ШМОТКИ ================= */

/** Спрайты по слотам (все подходящие иконки; выбор детерминирован по uid). */
const SLOT_ITEMS: Record<BaseSlot, number[]> = {
  weapon: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
  helm: [32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 101, 102, 103, 104],
  amulet: [83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 109, 110, 111, 112],
  armor: [47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 67, 68, 69, 70, 75, 76, 77, 78, 105, 106, 107, 108],
  gloves: [63, 64, 65, 66],
  boots: [71, 72, 73, 74],
  ring: [79, 80, 81, 82],
};

/** Для оружия — иконка по типу из имени (Клинок→меч, Посох→посох, Лук→лук…). */
const WEAPON_KIND: Record<string, number[]> = {
  клинок: [1, 2, 3, 4],
  меч: [1, 2, 3, 4],
  посох: [19, 20, 21, 22],
  жезл: [19, 20, 21, 22],
  лук: [11, 12, 13, 14],
  кинжал: [28],
  молот: [7, 8, 9, 10],
};

/** Возвращает путь к иконке предмета. */
export function itemSprite(it: Item): string {
  const pick = (list: number[]) => list[(it.uid + it.rarity) % list.length];
  if (it.base === "weapon") {
    const lower = it.name.toLowerCase();
    for (const [kind, list] of Object.entries(WEAPON_KIND)) {
      if (lower.includes(kind)) return itemPath(pick(list));
    }
    return itemPath(pick(SLOT_ITEMS.weapon));
  }
  return itemPath(pick(SLOT_ITEMS[it.base] ?? SLOT_ITEMS.weapon));
}

/** Путь к иконке слота (для пустых слотов экипировки). */
export function slotItemSprite(slot: BaseSlot, uid: number): string {
  return itemPath((SLOT_ITEMS[slot] ?? SLOT_ITEMS.weapon)[uid % (SLOT_ITEMS[slot] ?? SLOT_ITEMS.weapon).length]);
}
