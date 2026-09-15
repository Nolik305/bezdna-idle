import { INV_CAP } from "../data";
import type { GameState, Action, Slot } from "../types";
import { getStats } from "./logic";

export function handleEquip(s: GameState, a: Action): GameState {
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

export function handleUnequip(s: GameState, a: Action): GameState {
  const it = s.equip[a.slot];
  if (!it) return s;
  if (s.inv.length >= INV_CAP) { const st = { ...s }; toast(st, "Рюкзак полон!", "warn"); return st; }
  const st = { ...s, equip: { ...s.equip, [a.slot]: null }, inv: [...s.inv, it], hero: { ...s.hero } };
  st.hero.hp = Math.min(st.hero.hp, getStats(st).maxHp);
  return st;
}

export function handleSell(s: GameState, a: Action): GameState {
  const it = s.inv.find(i => i.uid === a.uid);
  if (!it) return s;
  const st = { ...s, inv: s.inv.filter(i => i.uid !== a.uid), hero: { ...s.hero, gold: s.hero.gold + it.sell }, totals: { ...s.totals, goldEarned: s.totals.goldEarned + it.sell } };
  toast(st, `Продано за ${it.sell} зол.`, "gold");
  return st;
}

export function handleSellJunk(s: GameState): GameState {
  const junk = s.inv.filter(i => i.rarity === 0);
  if (!junk.length) { const st = { ...s }; toast(st, "Серого хлама нет", "info"); return st; }
  const sum = junk.reduce((acc, i) => acc + i.sell, 0);
  const st = { ...s, inv: s.inv.filter(i => i.rarity !== 0), hero: { ...s.hero, gold: s.hero.gold + sum }, totals: { ...s.totals, goldEarned: s.totals.goldEarned + sum } };
  toast(st, `Продано ${junk.length} предметов за ${sum} зол.`, "gold");
  return st;
}

// Вспомогательные функции (нужно будет перенести из logic.ts)
function toast(s: GameState, text: string, icon?: string) {
  s.toast = { text, icon, t: Date.now() };
}
