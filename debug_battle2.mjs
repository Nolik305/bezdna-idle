import { newGame, reducer } from './src/game/logic.ts';
let s = reducer(newGame(), { type: "CHOOSE_CLASS", classId: "mage", name: "Тест" });
s = reducer(s, { type: "SET_ZONE", zone: 0 });
// give hero more levels so all 3 mage skills are unlocked
s = { ...s, hero: { ...s.hero, level: 10 } };
// run 30 ticks of 0.1s = 3s; fireball (cd6) shouldn't have fired yet
const c0 = s.totals.casts;
for (let i = 0; i < 30; i++) s = reducer(s, { type: "TICK", dt: 0.1 });
console.log("after 3s casts:", s.totals.casts - c0);
// run to 6.5s total -> fireball cd6 should fire exactly when ready
for (let i = 0; i < 35; i++) s = reducer(s, { type: "TICK", dt: 0.1 });
console.log("after ~6.5s casts:", s.totals.casts - c0, "cds", JSON.stringify(s.battle.cds));
