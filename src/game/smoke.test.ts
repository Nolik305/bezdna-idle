import { describe, expect, it } from "vitest";
import { newGame, reducer, getStats, runStats, respawnTime, atlasPoints, atlasPointsForHeroLevel, atlasPointsSpent } from "./logic";
import { SKILLS, PASSIVES, ASCENDANCIES, SETS, RELICS, SHOP, META, ATLAS_NODES } from "./data";

const tick = (s: any, dt = 0.1) => reducer(s, { type: "TICK", dt } as any);
const hasNaN = (obj: any): boolean => {
  if (obj === null || obj === undefined) return false;
  if (typeof obj === "number") return Number.isNaN(obj) || !Number.isFinite(obj);
  if (Array.isArray(obj)) return obj.some(hasNaN);
  if (typeof obj === "object") return Object.values(obj).some(hasNaN);
  return false;
};

describe("smoke: core progression", () => {
  it("farms, levels, and equips without NaN/crash", () => {
    let s = newGame();
    s = reducer(s, { type: "CHOOSE_CLASS", classId: "mage", name: "Тест" });
    for (let i = 0; i < 20000; i++) {
      s = tick(s);
      if (hasNaN(s)) throw new Error("NaN in farm state: " + JSON.stringify(s.hero));
    }
    expect(s.hero.level).toBeGreaterThan(1);
    expect(s.totals.kills).toBeGreaterThan(0);
    // equip everything we find
    for (const it of [...s.inv]) {
      s = reducer(s, { type: "EQUIP", uid: it.uid });
    }
    expect(hasNaN(getStats(s))).toBe(false);
  });

  it("exercises all skills and passives", () => {
    let s = newGame();
    s = reducer(s, { type: "CHOOSE_CLASS", classId: "archer", name: "Тест" });
    s.hero.level = 20;
    s.hero.skillPoints = 100;
    s.hero.gold = 1000000;
    for (const p of PASSIVES) {
      for (let r = 0; r < p.max; r++) s = reducer(s, { type: "LEVEL_PASSIVE", id: p.id });
    }
    for (const sk of SKILLS.filter(k => k.classId === "archer")) {
      s = reducer(s, { type: "LEVEL_SKILL", id: sk.id });
      s = reducer(s, { type: "CAST", id: sk.id });
    }
    for (let i = 0; i < 2000; i++) s = tick(s);
    expect(hasNaN(getStats(s))).toBe(false);
  });
});

describe("smoke: roguelike run", () => {
  it("runs expedition to completion and abandons safely", () => {
    let s = newGame();
    s = reducer(s, { type: "CHOOSE_CLASS", classId: "mage", name: "Тест" });
    s.hero.level = 30;
    s = reducer(s, { type: "START_RUN", kind: "exp" });
    for (let i = 0; i < 100000; i++) {
      s = tick(s, 0.1);
      if (s.modal?.t === "runpick") {
        s = reducer(s, { type: "RUN_PICK", id: s.modal.options[0] });
      }
      if (s.modal?.t === "runover") {
        s = reducer(s, { type: "RUN_CLOSE" });
        break;
      }
      if (hasNaN(s)) throw new Error("NaN in run: " + JSON.stringify(s.run));
    }
    s = reducer(s, { type: "START_RUN", kind: "exp" });
    s = reducer(s, { type: "ABANDON_RUN" });
    expect(s.run.active).toBe(false);
    expect(hasNaN(s)).toBe(false);
  });

  it("runs portal with blood", () => {
    let s = newGame();
    s = reducer(s, { type: "CHOOSE_CLASS", classId: "archer", name: "Тест" });
    s.hero.level = 40;
    s.blood = 5;
    s.hero.gems = 500;
    s = reducer(s, { type: "START_RUN", kind: "portal", depth: 1 });
    for (let i = 0; i < 80000; i++) {
      s = tick(s, 0.1);
      if (s.modal?.t === "runpick") s = reducer(s, { type: "RUN_PICK", id: s.modal.options[0] });
      if (s.modal?.t === "runover") { s = reducer(s, { type: "RUN_CLOSE" }); break; }
      if (hasNaN(s)) throw new Error("NaN in portal: " + JSON.stringify(s.run));
    }
    expect(hasNaN(s)).toBe(false);
  });
});

describe("smoke: duel", () => {
  it("searches and fights a duel", () => {
    let s = newGame();
    s = reducer(s, { type: "CHOOSE_CLASS", classId: "mage", name: "Тест" });
    s.hero.level = 50;
    s = reducer(s, { type: "DUEL_SEARCH" });
    for (let i = 0; i < 3000; i++) {
      s = tick(s, 0.1);
      if (s.duel.state === "fight") {
        for (const sk of SKILLS.filter(k => k.classId === "mage")) {
          s = reducer(s, { type: "DUEL_CAST", id: sk.id });
        }
      }
      if (s.duel.state === "result") { s = reducer(s, { type: "DUEL_CLOSE" }); break; }
      if (hasNaN(s)) throw new Error("NaN in duel: " + JSON.stringify(s.duel));
    }
    expect(hasNaN(s)).toBe(false);
  });
});

describe("smoke: party", () => {
  it("starts a party dungeon", () => {
    let s = newGame();
    s = reducer(s, { type: "CHOOSE_CLASS", classId: "mage", name: "Тест" });
    s.hero.level = 50;
    s.totals.partyWins = 20;
    s = reducer(s, { type: "PARTY_START", tier: 5, bots: [] });
    for (let i = 0; i < 20000; i++) {
      s = tick(s, 0.1);
      if (s.party && s.party.state !== "fight") { s = reducer(s, { type: "PARTY_CLOSE" }); break; }
      if (hasNaN(s)) throw new Error("NaN in party: " + JSON.stringify(s.party));
    }
    expect(hasNaN(s)).toBe(false);
  });
});

describe("smoke: shop/meta/godstone/slot", () => {
  it("buys everything without crashing", () => {
    let s = newGame();
    s = reducer(s, { type: "CHOOSE_CLASS", classId: "mage", name: "Тест" });
    s.hero.gold = 10_000_000;
    s.hero.gems = 10_000;
    s.shards = 10_000;
    for (const it of SHOP) s = reducer(s, { type: "BUY_SHOP", id: it.id });
    for (const m of META) for (let r = 0; r < 3; r++) s = reducer(s, { type: "BUY_META", id: m.id });
    s = reducer(s, { type: "BUY_GODSTONE" });
    for (let i = 0; i < 20; i++) s = reducer(s, { type: "UP_GODSTONE" });
    s = reducer(s, { type: "BUY_VIP" });
    expect(hasNaN(getStats(s))).toBe(false);
  });
});

describe("smoke: atlas (ascendancy + branches)", () => {
  it("chooses ascendancy, spends points up to path level, no over-spend", () => {
    let s = newGame();
    s = reducer(s, { type: "CHOOSE_CLASS", classId: "mage", name: "Тест" });
    s.pathXp = 0;
    // все узлы маг может качать
    const asc = ASCENDANCIES.find(x => x.classId === "mage")!;
    s = reducer(s, { type: "CHOOSE_PATH", id: asc.id });
    expect(s.path).toBe(asc.id);
    // нет очков — не качается
    const before = atlasPointsSpent(s.atlas || {});
    s = reducer(s, { type: "ATLAS_UP", id: ATLAS_NODES[0].id });
    expect(atlasPointsSpent(s.atlas || {})).toBe(before);
    // очки Атласа зависят от уровня героя, а не от pathXp/пати
    s.hero.level = 5;
    expect(atlasPointsForHeroLevel(s.hero.level)).toBe(4);
    for (let i = 0; i < 20; i++) s = reducer(s, { type: "ATLAS_UP", id: ATLAS_NODES[i % ATLAS_NODES.length].id });
    expect(atlasPointsSpent(s.atlas || {})).toBeLessThanOrEqual(atlasPointsForHeroLevel(s.hero.level));
    expect(hasNaN(getStats(s))).toBe(false);
  });

  it("gives each ascendancy a distinct combat identity", () => {
    const mage = (path: "pyro" | "cryo") => ({ ...newGame(), hero: { ...newGame().hero, level: 10 }, path });
    const archer = (path: "steel" | "venom") => ({ ...newGame(), hero: { ...newGame().hero, classId: "archer" as const, level: 10 }, path });
    const pyro = getStats(mage("pyro"));
    const cryo = getStats(mage("cryo"));
    const steel = getStats(archer("steel"));
    const venom = getStats(archer("venom"));
    expect(pyro.dotPct).toBe(0.35);
    expect(cryo.cooldownPct).toBe(20);
    expect(steel.extraSkillDamagePct).toBe(30);
    expect(venom.lifesteal).toBe(4);
    expect(venom.dodge).toBe(10);
    expect(venom.dotPct).toBe(0.5);
    expect(pyro.dmg).not.toBe(cryo.dmg);
    expect(steel.as).not.toBe(venom.as);
  });

  it("allows switching ascendancy without spending gems", () => {
    let state = reducer(newGame(), { type: "CHOOSE_CLASS", classId: "mage", name: "Тест" });
    state.hero.gems = 0;
    state = reducer(state, { type: "CHOOSE_PATH", id: "pyro" });
    state = reducer(state, { type: "CHOOSE_PATH", id: "cryo" });
    expect(state.path).toBe("cryo");
    expect(state.hero.gems).toBe(0);
  });

  it("total spendable ranks far exceed points (can't take everything)", () => {
    const total = ATLAS_NODES.reduce((a, n) => a + n.max, 0);
    const avail = 40; // max path level
    expect(avail / total).toBeLessThan(0.5); // ~33%
  });
});
