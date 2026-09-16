import { describe, expect, it } from "vitest";
import { LOGIN_REWARDS, CRAFT_RECIPES, ZONE_RESOURCES, activeSeasonalEvent, SEASONAL_EVENTS, sharpenChance, skillCost, EXPEDITION_MAX_TIER, EXPEDITION_RUNE_RECIPES, RUNES, expeditionDef, expeditionHpMult, expeditionDmgMult, expeditionGoldMult, expeditionXpMult, expeditionShardMult, RELICS, rollSockets, GEAR_SOCKET_SLOTS, PETS, petPowerMult, PET_LEVEL_CAP, PET_STAR_CAP, RARITY } from "./data";
import { newGame, reducer, getStats, migrateState, itemPower, equipDelta, DEATH_WAVE_ROLLBACK, spawnEnemy, spawnRunEnemy, runStats, genItem, genSetItem, genAbyssItem } from "./logic";

describe("progression balance and class passives", () => {
  it("keeps late skill upgrades affordable", () => {
    expect(skillCost(40)).toBeLessThan(10_000_000);
    expect(skillCost(40)).toBeGreaterThan(skillCost(20));
  });

  it("applies class passives only to their class", () => {
    const mage = newGame();
    mage.hero.level = 20;
    mage.hero.skillPoints = 20;
    const mageWithArcherPassive = reducer(mage, { type: "LEVEL_PASSIVE", id: "marksmanship" });
    expect(mageWithArcherPassive.passives.marksmanship).toBeUndefined();

    const archer = { ...newGame(), hero: { ...newGame().hero, classId: "archer" as const, level: 20 }, passives: { rapid_fire: 2 } };
    expect(getStats(archer).as).toBeGreaterThan(getStats({ ...archer, passives: {} }).as);
  });

  it("scales late enemy XP above early-zone rewards", () => {
    const early = spawnEnemy(0, 1).xp;
    const late = spawnEnemy(8, 10).xp;
    expect(late).toBeGreaterThan(early * 4);
  });
});

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

  it("repairs broken item sell prices before selling", () => {
    const save = newGame() as any;
    save.inv = [{ uid: 901, base: "armor", name: "Битый предмет", rarity: 0, ilvl: 1, stats: {}, sell: null }];
    const migrated = migrateState(save);
    expect(migrated.inv[0].sell).toBeGreaterThan(0);

    const sold = reducer(migrated, { type: "SELL", uid: 901 });
    expect(sold.inv).toHaveLength(0);
    expect(sold.hero.gold).toBeGreaterThan(newGame().hero.gold);
    expect(Number.isFinite(sold.hero.gold)).toBe(true);
  });

  it("sells gray loot and selected auto-sell rarities as junk", () => {
    const state = {
      ...newGame(),
      autoSellRarities: { "1": true },
      inv: [
        { uid: 902, base: "armor" as const, name: "Серый", rarity: 0 as const, ilvl: 1, stats: {}, sell: 10 },
        { uid: 903, base: "armor" as const, name: "Выбранный", rarity: 1 as const, ilvl: 1, stats: {}, sell: 20 },
        { uid: 904, base: "armor" as const, name: "Оставить", rarity: 2 as const, ilvl: 1, stats: {}, sell: 30 },
      ],
    };
    const sold = reducer(state, { type: "SELL_JUNK" });
    expect(sold.inv.map(item => item.uid)).toEqual([904]);
    expect(sold.hero.gold).toBe(newGame().hero.gold + 30);
    expect(Number.isFinite(sold.hero.gold)).toBe(true);
  });

  it("fills partially saved pet and social state", () => {
    const save = newGame() as any;
    save.pet = {};
    save.social = {};

    const migrated = migrateState(save);

    expect(migrated.pet.equipped).toBeNull();
    expect(migrated.pet.owned).toEqual([]);
    expect(migrated.social.friends).toEqual([]);
    expect(migrated.social.giftsReceived).toEqual([]);
  });

  it("fills partially saved bestiary state", () => {
    const save = newGame() as any;
    save.bestiary = {};

    const migrated = migrateState(save);

    expect(migrated.bestiary.entries).toEqual({});
    expect(migrated.bestiary.maxKills).toEqual({});
    expect(migrated.bestiary.milestones).toEqual([]);
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

  it("crafts an expedition rune from zone resources (rune tier = stage key)", () => {
    const recipe = EXPEDITION_RUNE_RECIPES.find(r => r.result.value === 3)!;
    const state = {
      ...newGame(),
      resources: { herb: 100, leather: 100, essence: 100 },
    };
    const result = reducer(state, { type: "CRAFT", id: recipe.id });
    expect(result.runes.inventory.length).toBe(1);
    expect(result.runes.inventory[0].tier).toBe(3);
    expect(result.runes.inventory[0].count).toBe(1);
    // ресурсы этапа списаны
    expect(result.resources.herb).toBe(100 - 40);
    expect(result.resources.essence).toBe(100 - 15);
  });

  it("refuses to craft a rune without reagents", () => {
    const recipe = EXPEDITION_RUNE_RECIPES[0];
    const state = { ...newGame(), resources: {} };
    const result = reducer(state, { type: "CRAFT", id: recipe.id });
    expect(result.runes.inventory.length).toBe(0);
    expect(result).toBe(state); // отказ без изменений — редьюсер чистый
  });

  it("opens expedition stage I free, but demands a rune for stage II+", () => {
    const open = reducer(newGame(), { type: "START_RUN", kind: "exp", depth: 1 });
    expect(open.run.active).toBe(true);
    expect(open.run.depth).toBe(1);
    // этап II без руны — отказ с подсказкой
    const locked = reducer({ ...newGame(), expeditionDepth: 2 }, { type: "START_RUN", kind: "exp", depth: 2 });
    expect(locked.run.active).toBe(false);
    // этап II с руной тира 2 — вход, руна сгорает как ключ
    const withKey = reducer({
      ...newGame(),
      expeditionDepth: 2,
      runes: { gear: {}, inventory: [{ runeId: RUNES[0].id, count: 1, tier: 2 }] },
    }, { type: "START_RUN", kind: "exp", depth: 2 });
    expect(withKey.run.active).toBe(true);
    expect(withKey.run.depth).toBe(2);
    expect(withKey.runes.inventory.length).toBe(0);
  });

  it("expedition stages scale monsters and rewards with tier", () => {
    const t1 = spawnRunEnemy(5, "exp", 1);
    const t8 = spawnRunEnemy(5, "exp", 8);
    expect(t8.hp).toBeGreaterThan(t1.hp);
    expect(t8.dmg).toBeGreaterThan(t1.dmg);
    expect(t8.gold).toBeGreaterThan(t1.gold);
    // тиры в допустимых границах
    expect(expeditionDef(1).roman).toBe("I");
    expect(expeditionDef(99).roman).toBe("VIII");
    expect(EXPEDITION_MAX_TIER).toBe(8);
        expect(EXPEDITION_RUNE_RECIPES.length).toBe(8);
  });

  it("expedition monster HP growth is capped at 1.6x per tier", () => {
    expect(expeditionHpMult(1)).toBeCloseTo(1);
    expect(expeditionHpMult(2)).toBeCloseTo(1.6);
    expect(expeditionHpMult(5)).toBeCloseTo(Math.pow(1.6, 4));
    expect(expeditionHpMult(8)).toBeCloseTo(Math.pow(1.6, 7));
  });

  it("expedition damage and reward multipliers are balanced", () => {
    expect(expeditionDmgMult(1)).toBeCloseTo(1);
    expect(expeditionDmgMult(4)).toBeCloseTo(Math.pow(1.4, 3));
    expect(expeditionGoldMult(3)).toBeCloseTo(1.8);
    expect(expeditionXpMult(3)).toBeCloseTo(1.5);
    expect(expeditionShardMult(8)).toBeCloseTo(1 + 0.35 * 7);
  });

  it("relics are nerfed (no +15%+ per rank)", () => {
    const fang = RELICS.find(r => r.id === "fang");
    expect(fang?.dmgPct).toBe(8);
    const cursed = RELICS.find(r => r.id === "cursed");
    expect(cursed?.dmgPct).toBe(20);
    expect(cursed?.hpPct).toBe(-10);
    const magnet = RELICS.find(r => r.id === "magnet");
    expect(magnet?.goldPct).toBe(10);
  });

  it("equipped rune stats grow with tier", () => {
    const base = { ...newGame(), hero: { ...newGame().hero, classId: "mage" as const } };
    const runeId = "rune_fire"; // +3% урона
    const item = { uid: 1, base: "armor" as const, name: "t", rarity: 2 as const, ilvl: 1, stats: {}, sell: 1, sockets: 1 };
    const withT1 = { ...base, inv: [item], runes: { gear: { 1: { uid: 1, sockets: 1, runes: [{ runeId, rank: 1 }] } }, inventory: [] } };
    const withT4 = { ...base, inv: [item], runes: { gear: { 1: { uid: 1, sockets: 1, runes: [{ runeId, rank: 4 }] } }, inventory: [] } };
    expect(runStats(withT4).dmg).toBeGreaterThan(runStats(withT1).dmg);
    expect(expeditionHpMult(8)).toBeGreaterThan(expeditionHpMult(1));
  });

  it("item sockets: gray/green never, blue 15%@1, epic 30%@2, legend 50%@2, abyss 70%@3", () => {
    expect(rollSockets(0)).toBe(0);
    expect(rollSockets(1)).toBe(0);
    expect(GEAR_SOCKET_SLOTS).toBe(3);
    for (let i = 0; i < 200; i++) {
      expect(rollSockets(2)).toBeLessThanOrEqual(1);
      expect(rollSockets(3)).toBeLessThanOrEqual(2);
      expect(rollSockets(4)).toBeLessThanOrEqual(2);
      expect(rollSockets(5)).toBeLessThanOrEqual(3);
    }
    let seenBlue = false, seenEpic2 = false, seenAbyss3 = false;
    for (let i = 0; i < 4000; i++) {
      if (rollSockets(2) === 1) seenBlue = true;
      if (rollSockets(3) === 2) seenEpic2 = true;
      if (rollSockets(5) === 3) seenAbyss3 = true;
    }
    expect(seenBlue).toBe(true);
    expect(seenEpic2).toBe(true);
    expect(seenAbyss3).toBe(true);
  });

  it("gear item power hierarchy: abyss > legend at equal ilvl (abyss is the cap)", () => {
    for (let i = 0; i < 50; i++) {
      const leg = genItem(50, 4, "mage", 0, 3000 + i);
      const abyss = genAbyssItem(50, 4000 + i, "mage", 30);
      // Бездна — кап: фиксированно выше сгенерированной легенды того же ilvl.
      expect(itemPower({ ...abyss, rarity: 5 } as any)).toBeGreaterThan(itemPower({ ...leg, rarity: 4 } as any));
    }
  });

  it("abyss items scale with wave (endgame cap without runaway inflation)", () => {
    const early = genAbyssItem(50, 1, "mage", 1);
    const late = genAbyssItem(50, 2, "mage", 60);
    expect(itemPower({ ...late, rarity: 5 } as any)).toBeGreaterThan(itemPower({ ...early, rarity: 5 } as any));
    // Рост ≤ ×20 за 59 волн — иначе инфляция убивает смысл тиров.
    const ratio = itemPower({ ...late, rarity: 5 } as any) / Math.max(1, itemPower({ ...early, rarity: 5 } as any));
    expect(ratio).toBeLessThan(20);
  });

  it("atlas set pieces have 4 stat lines and can roll sockets (top tier loot)", () => {
    let seenSocket = false;
    for (let i = 0; i < 100; i++) {
      const it = genSetItem("blood", 40, "mage", 9000 + i);
      expect(Object.keys(it.stats).length).toBe(4);
      expect(it.rarity).toBe(4);
      if ((it.sockets ?? 0) > 0) seenSocket = true;
    }
    expect(seenSocket).toBe(true);
  });

  it("drill adds a socket via SOCKET_DRILL and refuses at cap", () => {
    let s = newGame();
    s.resources = { ore: 999, crystal: 999, essence: 999 };
    s = reducer(s, { type: "CRAFT", id: "c_drill" });
    const drill = s.inv.find(i => i.name.startsWith("Сверло"));
    expect(drill).toBeDefined();
    const s2in = { ...s, inv: [...s.inv, { uid: 777, base: "armor" as const, name: "Тест", rarity: 2 as const, ilvl: 10, stats: {}, sell: 1 }] };
    const s2 = reducer(s2in, { type: "SOCKET_DRILL", itemUid: 777 });
    expect(s2.inv.find(i => i.uid === 777)?.sockets).toBe(1);
    expect(s2.inv.some(i => i.name.startsWith("Сверло"))).toBe(false);
    // Второй раз без сверла — отказ.
    const s3 = reducer(s2, { type: "SOCKET_DRILL", itemUid: 777 });
    expect(s3.inv.find(i => i.uid === 777)?.sockets).toBe(1);
  });

  it("RUNE_INSERT requires an existing socket, RUNE_REMOVE keeps tier", () => {
    const base = newGame();
    const noSockets = { ...base, inv: [{ uid: 555, base: "armor" as const, name: "Без гнёзд", rarity: 2 as const, ilvl: 5, stats: {}, sell: 1 }], runes: { gear: {}, inventory: [{ runeId: RUNES[0].id, count: 1, tier: 2 }] } };
    const denied = reducer(noSockets, { type: "RUNE_INSERT", gearUid: 555, slotIndex: 0, runeId: RUNES[0].id, tier: 2 });
    expect(denied.runes.gear[555]).toBeUndefined();
    // Со сверлёным гнездом — вставка проходит.
    const withSocket = { ...noSockets, inv: [{ uid: 555, base: "armor" as const, name: "С гнездом", rarity: 2 as const, ilvl: 5, stats: {}, sell: 1, sockets: 1 }] };
    const ok = reducer(withSocket, { type: "RUNE_INSERT", gearUid: 555, slotIndex: 0, runeId: RUNES[0].id, tier: 2 });
    expect(ok.runes.gear[555]?.runes[0]?.runeId).toBe(RUNES[0].id);
    expect(ok.runes.gear[555]?.runes[0]?.rank).toBe(2);
    const back = reducer(ok, { type: "RUNE_REMOVE", gearUid: 555, slotIndex: 0 });
    expect(back.runes.inventory.find(i => i.runeId === RUNES[0].id && i.tier === 2)?.count).toBe(1);
  });

  it("pets: dragon no longer outscales sets (power mult capped, pet % modest)", () => {
    const dragon = PETS.find(p => p.id === "dragon_whelp")!;
    expect((dragon.passiveBonus.dmgPct ?? 0) + (dragon.passiveBonus.hpPct ?? 0)).toBeLessThanOrEqual(8);
    expect(dragon.lifesteal ?? 0).toBeLessThanOrEqual(2);
    // Кап прокачки: даже 20/⭐5 не даёт больше ×3.4 суммарно (1.5 × 2.25).
    expect(petPowerMult(PET_LEVEL_CAP, PET_STAR_CAP)).toBeLessThanOrEqual(3.4);
    expect(petPowerMult(1, 0)).toBe(1);
    expect(RARITY[5].name).toBe("Бездна");
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
        expect(getStats(s).xpPct).toBe(2);
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
