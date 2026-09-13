import { newGame, reducer } from './src/game/logic.ts';
let s = reducer(newGame(), { type: "CHOOSE_CLASS", classId: "mage", name: "Тест" });
s = reducer(s, { type: "SET_ZONE", zone: 0 });
console.log("enemy?", !!s.battle.enemy, "skillT", s.battle.skillT, "enemyHp", s.battle.enemy?.hp);
for (let i = 0; i < 300; i++) {
  s = reducer(s, { type: "TICK", dt: 0.1 });
  if (s.totals.casts > 0) break;
}
console.log("casts", s.totals.casts, "cds", JSON.stringify(s.battle.cds), "skillT", s.battle.skillT);
console.log("log0:", s.battle.log[0]);
console.log("log1:", s.battle.log[1]);
