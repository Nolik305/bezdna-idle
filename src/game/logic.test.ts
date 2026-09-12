import { describe, expect, it } from "vitest";
import { LOGIN_REWARDS, CRAFT_RECIPES, ZONE_RESOURCES, activeSeasonalEvent, SEASONAL_EVENTS, sharpenChance } from "./data";
import { newGame, reducer, getStats, migrateState, itemPower, equipDelta, DEATH_WAVE_ROLLBACK } from "./logic";

describe("login activity", () => {
  it("grants the current day reward and advances the streak", () => {
    const state = newGame();
    const result = reducer({ ...state, modal: { t: "activity" } }, { type: "CLAIM_ACTIVITY" });

    expect(result.hero.gold).toBe(100 + LOGIN_REWARDS[0].gold);
    expect(result.hero.gems).toBe(10 + LOGIN_REWARDS[0].gems);
    expect(result.hero.potions).toBe(2 + LOGIN_REWARDS[0].potions);
    expect(result.activity.day).toBe(2);
    expect(result.activity.claimed).toEqual([1]);
    expect(result.modal).toBeNull();
  });

  it("does not grant the same day twice", () => {
    const state = newGame();
    const claimed = reducer(state, { type: "CLAIM_ACTIVITY" });
    const repeated = reducer(claimed, { type: "CLAIM_ACTIVITY" });

    expect(repeated).toBe(claimed);
  });

  it("starts a new cycle after day seven", () => {
    const state = newGame();
    const result = reducer({
      ...state,
      activity: { day: 7, claimed: [1, 2, 3, 4, 5, 6], lastClaimDate: "" },
    }, { type: "CLAIM_ACTIVITY" });

    expect(result.hero.gold).toBe(100 + LOGIN_REWARDS[6].gold);
    expect(result.activity.day).toBe(1);
    expect(result.activity.claimed).toEqual([]);
  });
});

describe("resources & crafting", () => {

  describe("run progression and equipment", () => {
    it("starts a selected class at full calculated HP", () => {
      const state = reducer(newGame(), { type: "CHOOSE_CLASS", classId: "mage", name: "Тест" });
      expect(state.hero.hp).toBe(getStats(state).maxHp);
    });

    it("replaces the weaker ring and compares against that slot", () => {
      const weak = { uid: 1, base: "ring" as const, name: "Слабое", rarity: 1 as const, ilvl: 1, stats: { dmg: 1 }, sell: 1 };
      const strong = { uid: 2, base: "ring" as const, name: "Сильное", rarity: 2 as const, ilvl: 2, stats: { dmg: 20 }, sell: 1 };
      const candidate = { uid: 3, base: "ring" as const, name: "Кандидат", rarity: 2 as const, ilvl: 2, stats: { dmg: 10 }, sell: 1 };
      const state = { ...newGame(), equip: { ...newGame().equip, ring1: weak, ring2: strong }, inv: [candidate] };
      expect(equipDelta(state, candidate)).toBeGreaterThan(0);
      const result = reducer(state, { type: "EQUIP", uid: candidate.uid });
      expect(result.equip.ring1?.uid).toBe(candidate.uid);
      expect(result.equip.ring2?.uid).toBe(strong.uid);
    });

    it("does not allow starting an unlocked portal depth", () => {
      const state = { ...newGame(), blood: 1, portalDepth: 2 };
      const result = reducer(state, { type: "START_RUN", kind: "portal", depth: 99 });
      expect(result.run.depth).toBe(2);
    });

    it("applies the headstart meta upgrade at run start", () => {
      const state = { ...newGame(), meta: { headstart: 1 } };
      const result = reducer(state, { type: "START_RUN", kind: "exp" });
      expect(Object.values(result.run.relics).reduce((sum, rank) => sum + rank, 0)).toBe(1);
    });

    it("rolls farming back after death instead of retrying the same wall forever", () => {
      const state = reducer(newGame(), { type: "CHOOSE_CLASS", classId: "mage", name: "Тест" });
      const dying = {
        ...state,
        hero: { ...state.hero, hp: 1 },
        battle: { ...state.battle, wave: 18, enemy: { ...state.battle.enemy!, hp: 1e9, maxHp: 1e9, dmg: 1000 } },
      };
      const dead = reducer(dying, { type: "TICK", dt: 2 } as any);
      expect(dead.battle.paused).toBe(true);
      const revived = reducer(dead, { type: "TICK", dt: 4 } as any);
      expect(revived.battle.wave).toBe(18 - DEATH_WAVE_ROLLBACK);
      expect(revived.hero.hp).toBe(getStats(revived).maxHp);
      expect(revived.battle.paused).toBe(false);
    });
  });
  it("starts with empty resources", () => {
    const state = newGame();
    expect(state.resources).toEqual({});
  });

  it("hydrating an old cloud save initializes resources (craft tab no crash)", () => {
    // Old cloud saves predate the resources feature and lack the field.
    // HYDRATE_STATE must run migration so the craft screen can read s.resources.
    const oldSave = newGame() as any;
    delete oldSave.resources;
    delete oldSave.autoSellRarities;
    const hydrated = reducer(oldSave, { type: "HYDRATE_STATE", state: oldSave });
    expect(hydrated.resources).toEqual({});
    expect(hydrated.autoSellRarities).toEqual({});
    // crafting must now work on the hydrated save without crashing
    const rich = { ...hydrated, resources: { herb: 100 } };
    const crafted = reducer(rich, { type: "CRAFT", id: "c_potion" });
    expect(crafted.hero.potions).toBe(newGame().hero.potions + 1);
    expect(crafted.resources.herb).toBe(95);
  });

  it("hydrating an old save preserves a pre-existing resources object", () => {
    const save = newGame() as any;
    save.resources = { herb: 7, wood: 3 };
    const hydrated = reducer(save, { type: "HYDRATE_STATE", state: save });
    expect(hydrated.resources).toEqual({ herb: 7, wood: 3 });
  });

  it("crafts a potion when resources are enough", () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === "c_potion")!;
    const state = newGame();
    const potionsBefore = state.hero.potions;
    const rich = {
      ...state,
      resources: { herb: 100 },
    };
    const result = reducer(rich, { type: "CRAFT", id: "c_potion" });
    expect(result.hero.potions).toBe(potionsBefore + 1);
    expect(result.resources.herb).toBe(100 - 5);
  });

  it("refuses craft when resources are insufficient", () => {
    const state = { ...newGame(), resources: { herb: 2 } };
    const result = reducer(state, { type: "CRAFT", id: "c_potion" });
    expect(result.resources.herb).toBe(2);
    expect(result.hero.potions).toBe(state.hero.potions);
  });

  it("crafts a legendary item from the smithy", () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === "c_legend")!;
    const state = {
      ...newGame(),
      resources: { gem: 50, darkmatter: 50, essence: 50 },
    };
    const result = reducer(state, { type: "CRAFT", id: "c_legend" });
    expect(result.inv.length).toBeGreaterThan(0);
    expect(result.inv[result.inv.length - 1].rarity).toBeGreaterThanOrEqual(4);
    expect(result.resources.gem).toBe(50 - 20);
  });

  it("crafts a sharpen stone via CRAFT (not a direct slot sharpen)", () => {
    const state = {
      ...newGame(),
      resources: { ore: 50, bone: 50 },
    };
    // c_stone0 now produces a stone_common resource, not a direct slot level
    const result = reducer(state, { type: "CRAFT", id: "c_stone0" });
    expect(result.resources.stone_common).toBe(1);
    expect(result.slotLevel.helm).toBe(0); // слот не заточен напрямую
    expect(result.resources.ore).toBe(50 - 12);
  });

  it("forges an item into the chosen slot via CRAFT_SLOT", () => {
    const state = {
      ...newGame(),
      resources: { ore: 50, crystal: 50, essence: 50 },
    };
    const result = reducer(state, { type: "CRAFT_SLOT", id: "c_item", slot: "gloves" });
    expect(result.inv.length).toBeGreaterThan(0);
    const it = result.inv[result.inv.length - 1];
    expect(it.base).toBe("gloves"); // предмет именно перчатки
    expect(it.rarity).toBeGreaterThanOrEqual(2);
  });

  it("ring1/ring2 forge maps to a ring item", () => {
    const state = {
      ...newGame(),
      resources: { ore: 50, crystal: 50, essence: 50 },
    };
    const result = reducer(state, { type: "CRAFT_SLOT", id: "c_item", slot: "ring1" });
    const it = result.inv[result.inv.length - 1];
    expect(it.base).toBe("ring");
  });

  it("sharpening requires gold + stone + equipped item", () => {
    const state = {
      ...newGame(),
      hero: { ...newGame().hero, gold: 1000 },
      resources: { stone_common: 1 },
      equip: {
        ...newGame().equip,
        weapon: { uid: 1, base: "weapon", name: "Тест", rarity: 2, ilvl: 5, stats: { dmg: 10 }, sell: 10 },
      },
    } as any;
    // без камня — отказ
    const noStone = reducer({ ...state, resources: {} }, { type: "UPGRADE_SLOT", slot: "weapon", stone: 0 });
    expect(noStone.slotLevel.weapon).toBe(0);
    // без предмета в слоте — отказ
    const noItem = reducer({ ...state, equip: { ...state.equip, weapon: null } }, { type: "UPGRADE_SLOT", slot: "weapon", stone: 0 });
    expect(noItem.slotLevel.weapon).toBe(0);
    // с камнем и золотом — пытаемся (шанс может не повезти, но золото/камень списываются)
    const ok = reducer({ ...state, hero: { ...state.hero, gold: 1000 } }, { type: "UPGRADE_SLOT", slot: "weapon", stone: 0 });
    expect(ok.hero.gold).toBe(1000 - 500);
    expect(ok.resources.stone_common).toBe(0);
    expect(ok.slotLevel.weapon).toBeGreaterThanOrEqual(0);
  });

  it("stones are added by the craft recipe", () => {
    const state = { ...newGame(), resources: { ore: 50, bone: 50 } };
    const result = reducer(state, { type: "CRAFT", id: "c_stone0" });
    expect(result.resources.stone_common).toBe(1);
  });

  it("migrates legacy whetstone resource to stone_common", () => {
    const s = newGame() as any;
    s.resources = { whetstone: 4 };
    const migrated = migrateState(s);
    expect(migrated.resources.whetstone).toBeUndefined();
    expect(migrated.resources.stone_common).toBe(4);
  });

  it("sharpen chance drops with upgrade level but never below the floor", () => {
    expect(sharpenChance(0, 0)).toBe(30); // простой камень, 0-й уровень
    expect(sharpenChance(4, 0)).toBe(90); // легендарный камень
    expect(sharpenChance(0, 13)).toBeGreaterThanOrEqual(1); // простой на 13-й заточке ~1.4%
    expect(sharpenChance(0, 13)).toBeLessThan(30);
    expect(sharpenChance(4, 50)).toBe(1); // минимум
  });

  it("every zone has at least one resource to drop", () => {
    for (let z = 0; z < 9; z++) {
      expect((ZONE_RESOURCES[z] ?? []).length).toBeGreaterThan(0);
    }
  });

  it("farming kills accumulates resources from the current zone", () => {
    let s = reducer(newGame(), { type: "CHOOSE_CLASS", classId: "mage", name: "Тест" });
    for (let i = 0; i < 60000; i++) {
      s = reducer(s, { type: "TICK", dt: 0.1 } as any);
    }
    const total = Object.values(s.resources || {}).reduce((a, b) => a + (b as number), 0);
    expect(s.totals.kills).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(0);
    // daily/weekly counters track the same collection for resource quests
    expect(s.daily.resources).toBeGreaterThan(0);
    expect(s.weekly.resources).toBeGreaterThan(0);
    // dropped resources must belong to zone 0's pool
    const pool = ZONE_RESOURCES[0];
    for (const k of Object.keys(s.resources || {})) {
      expect(pool).toContain(k);
    }
  });
});

describe("shop boosts", () => {
  it("adds a gold boost buff on purchase", () => {
    const state = newGame();
    state.hero.gems = 500;
    const result = reducer(state, { type: "BUY_SHOP", id: "boost_gold" });
    const buff = result.buffs.find(b => b.id === "boost_gold");
    expect(buff).toBeDefined();
    expect(buff!.goldMult).toBe(2);
    expect(buff!.t).toBe(300);
  });

  it("buying the same boost replaces rather than stacks", () => {
    const state = newGame();
    state.hero.gems = 500;
    const once = reducer(state, { type: "BUY_SHOP", id: "boost_xp" });
    const twice = reducer(once, { type: "BUY_SHOP", id: "boost_xp" });
    expect(twice.buffs.filter(b => b.id === "boost_xp").length).toBe(1);
  });
});

describe("meta altar & resource quests", () => {
  it("savant meta upgrade raises xp% stats", () => {
    let s = newGame();
    s.hero.gems = 1000;
    s.shards = 1000;
    s = reducer(s, { type: "BUY_META", id: "savant" });
    expect(getStats(s).xpPct).toBe(8);
  });

  it("claims the daily resource quest when threshold met", () => {
    const state = { ...newGame(), daily: { ...newGame().daily, resources: 25 } };
    const result = reducer(state, { type: "CLAIM_DAILY", id: "d4" });
    expect(result.daily.claimed).toContain("d4");
  });

  it("refuses the daily resource quest below threshold", () => {
    const state = { ...newGame(), daily: { ...newGame().daily, resources: 10 } };
    const result = reducer(state, { type: "CLAIM_DAILY", id: "d4" });
    expect(result.daily.claimed).not.toContain("d4");
  });
});

describe("seasonal events", () => {
  it("has at least one active event at the current time", () => {
    const ev = activeSeasonalEvent();
    expect(ev).not.toBeNull();
    expect(SEASONAL_EVENTS.length).toBeGreaterThan(0);
  });

  it("gains event points from kills during the active event", () => {
    const ev = activeSeasonalEvent()!;
    // set the player's seasonal id to the active event, then farm kills
    const state = { ...newGame(), seasonal: { id: ev.id, points: 0, claimed: [] } };
    let s = reducer(state, { type: "CHOOSE_CLASS", classId: "mage", name: "Тест" });
    const before = s.totals.kills;
    for (let i = 0; i < 2000; i++) {
      s = reducer(s, { type: "TICK", dt: 0.1 } as any);
    }
    expect(s.totals.kills).toBeGreaterThan(before);
    if (ev.metric === "kills") {
      expect(s.seasonal.points).toBeGreaterThan(0);
    }
    // seasonal points must belong to the active event
    expect(s.seasonal.id).toBe(ev.id);
  });

  it("claims a tier reward when points are sufficient", () => {
    const ev = activeSeasonalEvent()!;
    const tier = ev.tiers[0];
    const state = { ...newGame(), seasonal: { id: ev.id, points: tier.pts + 1, claimed: [] } };
    const goldBefore = state.hero.gold;
    const result = reducer(state, { type: "CLAIM_SEASON_TIER", idx: 0 });
    expect(result.seasonal.claimed).toContain(0);
    expect(result.hero.gold).toBe(goldBefore + (tier.reward.gold ?? 0));
  });

  it("refuses a tier claim when points are insufficient", () => {
    const ev = activeSeasonalEvent()!;
    const tier = ev.tiers[0];
    const state = { ...newGame(), seasonal: { id: ev.id, points: tier.pts - 1, claimed: [] } };
    const result = reducer(state, { type: "CLAIM_SEASON_TIER", idx: 0 });
    expect(result.seasonal.claimed).not.toContain(0);
  });

  it("does not claim a tier when the event id does not match the active one", () => {
    const state = { ...newGame(), seasonal: { id: "some_old_event", points: 99999, claimed: [] } };
    const result = reducer(state, { type: "CLAIM_SEASON_TIER", idx: 0 });
    expect(result.seasonal.claimed).toEqual([]);
  });

  it("does not claim the same tier twice", () => {
    const ev = activeSeasonalEvent()!;
    const tier = ev.tiers[0];
    const state = { ...newGame(), seasonal: { id: ev.id, points: tier.pts + 5, claimed: [0] } };
    const goldBefore = state.hero.gold;
    const result = reducer(state, { type: "CLAIM_SEASON_TIER", idx: 0 });
    expect(result.seasonal.claimed).toEqual([0]);
    expect(result.hero.gold).toBe(goldBefore);
  });
});

describe("auto-cast & quests", () => {
  it("auto-cast in battle increments the casts metric (casts quests stay completable)", () => {
    // Manual cast buttons were removed; skills now fire automatically in farmTick.
    // The `casts` metric (campaign q3/q8, weekly w3) must still advance via auto-cast.
    let s = reducer(newGame(), { type: "CHOOSE_CLASS", classId: "mage", name: "Тест" });
    const castsBefore = s.totals.casts;
    // run many ticks while an enemy is up so auto-cast fires repeatedly
    for (let i = 0; i < 20000; i++) {
      s = reducer(s, { type: "TICK", dt: 0.1 } as any);
      if (s.totals.casts > castsBefore + 5) break;
    }
    expect(s.totals.casts).toBeGreaterThan(castsBefore + 5);
  });

  it("auto-cast in run increments the casts metric", () => {
    let s = reducer(newGame(), { type: "CHOOSE_CLASS", classId: "mage", name: "Тест" });
    s = reducer(s, { type: "START_RUN", depth: 1 } as any);
    // dismiss the daily activity modal that otherwise pauses the run
    s = reducer(s, { type: "TICK", dt: 0.5 } as any);
    if (s.modal?.t === "activity") s = reducer(s, { type: "CLAIM_ACTIVITY" });
    // make the cast fire on the next tick and keep the enemy alive long enough
    s = { ...s, run: { ...s.run, skillT: 0, enemy: { ...s.run.enemy, hp: 999999, maxHp: 999999 } } } as any;
    const castsBefore = s.totals.casts;
    for (let i = 0; i < 40; i++) {
      s = reducer(s, { type: "TICK", dt: 0.5 } as any);
      if (s.totals.casts > castsBefore) break;
    }
    expect(s.totals.casts).toBeGreaterThan(castsBefore);
  });
});


describe("item power comparison", () => {
  const baseItem = (stats: Partial<Record<string, number>>, base: "weapon" | "ring" = "weapon") => ({
    uid: 1, base, name: "тест", rarity: 2 as any, ilvl: 10, stats: stats as any, sell: 10,
  });

  it("itemPower weights stats (dmgPct counts more than armor)", () => {
    const a = baseItem({ dmgPct: 10 });
    const b = baseItem({ armor: 10 });
    expect(itemPower(a)).toBeGreaterThan(itemPower(b));
  });

  it("empty stats give zero power", () => {
    expect(itemPower(baseItem({}))).toBe(0);
  });

  it("slot sharpen scales item power up", () => {
    const it = baseItem({ dmg: 10 });
    expect(itemPower(it, 0)).toBeLessThan(itemPower(it, 5));
  });

  it("equipDelta is positive when loot beats worn", () => {
    const s = newGame();
    s.equip.weapon = baseItem({ dmgPct: 10 }, "weapon") as any;
    const better = baseItem({ dmgPct: 25 }, "weapon") as any;
    const worse = baseItem({ dmgPct: 2 }, "weapon") as any;
    expect(equipDelta(s, better)).toBeGreaterThan(0);
    expect(equipDelta(s, worse)).toBeLessThan(0);
  });

  it("equipDelta is null when slot is empty", () => {
    const s = newGame();
    const it = baseItem({ dmgPct: 25 }, "weapon") as any;
    expect(equipDelta(s, it)).toBeNull();
  });

  it("rings compare against the weaker worn ring", () => {
    const s = newGame();
    s.equip.ring1 = baseItem({ dmgPct: 10 }, "ring") as any;
    s.equip.ring2 = baseItem({ dmgPct: 30 }, "ring") as any;
    const newRing = baseItem({ dmgPct: 20 }, "ring") as any;
    // Новое кольцо заменит слабое кольцо, поэтому 20 лучше, чем 10.
    expect(equipDelta(s, newRing)).toBeGreaterThan(0);
    const weakerRing = baseItem({ dmgPct: 5 }, "ring") as any;
    expect(equipDelta(s, weakerRing)).toBeLessThan(0);
    const topRing = baseItem({ dmgPct: 40 }, "ring") as any;
    expect(equipDelta(s, topRing)).toBeGreaterThan(0);
  });
});
