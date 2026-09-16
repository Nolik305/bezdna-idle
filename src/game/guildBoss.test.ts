import { describe, expect, it } from "vitest";
import { newGame, reducer, migrateState, getStats, spawnRunEnemy } from "./logic";
import { RUN_WAVES } from "./data";
import type { GameState, GuildBossS } from "./types";

const tick = (s: GameState, dt = 0.1) => reducer(s, { type: "TICK", dt });
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Игрок 60 уровня с активным рейдом гильдбосса. */
function raid(level = 60): GameState {
  let s = reducer(newGame(), { type: "CHOOSE_CLASS", classId: "mage", name: "Тест" });
  s = reducer(s, { type: "CLAIM_ACTIVITY" });
  s = { ...s, hero: { ...s.hero, level } };
  return reducer(s, { type: "GUILD_BOSS_START" });
}

function boss(s: GameState): GuildBossS {
  if (!s.guildBoss) throw new Error("рейд не начался");
  return s.guildBoss;
}

describe("guild boss: рейд и боевой цикл", () => {
  it("начинает рейд с живым боссом и полным HP героя", () => {
    const s = raid();
    expect(boss(s).active).toBe(true);
    expect(boss(s).hp).toBeGreaterThan(0);
    expect(boss(s).heroHp).toBe(getStats(s).maxHp);
  });

  it("тикает бой: герой бьёт босса, а босс — героя (регресс на мёртвый блок в tick)", () => {
    let s = raid();
    const startHp = boss(s).hp;
    const startHeroHp = boss(s).heroHp;

    // 30 секунд боя: босс бьёт каждые 5 сек, герой — по своей скорости атаки
    for (let i = 0; i < 300; i++) s = tick(s, 0.1);

    expect(boss(s).hp).toBeLessThan(startHp);
    expect(boss(s).personalDamage).toBeGreaterThan(0);
    expect(boss(s).guildDamage).toBe(boss(s).personalDamage);
    expect(boss(s).heroHp).toBeLessThan(startHeroHp);
    expect(boss(s).leaderboard).toHaveLength(1);
    expect(boss(s).timeElapsed).toBeGreaterThan(29);
  });

  it("редьюсер не мутирует предыдущее состояние", () => {
    const s = raid();
    const before = clone(boss(s));
    const attacked = reducer(s, { type: "GUILD_BOSS_ATTACK" });

    expect(clone(s.guildBoss)).toEqual(before); // прошлое состояние не тронуто
    expect(boss(attacked).personalDamage).toBeGreaterThan(before.personalDamage);
    expect(boss(attacked).leaderboard[0].damage).toBeGreaterThan(0);
  });

  it("тикает бой, не мутируя вход (чистый TICK)", () => {
    const s = raid();
    const before = clone(boss(s));
    tick(s, 0.1);
    expect(clone(s.guildBoss)).toEqual(before);
  });

  it("помечает награду доступной, когда босс убит", () => {
    const s = raid();
    const almost = { ...s, guildBoss: { ...boss(s), hp: 1, bossHp: 1 } };
    const killed = reducer(almost, { type: "GUILD_BOSS_ATTACK" });

    expect(boss(killed).hp).toBe(0);
    expect(boss(killed).rewardPending).toBe(true);
    expect(boss(killed).isFighting).toBe(false);
  });

  it("не выдаёт награду за смерть героя — рейд продолжается", () => {
    // Слабым героем босс «убивает» с одного удара, но рейд длится 24 часа:
    // награда не должна становиться доступной без убийства босса.
    let s = raid(10);
    for (let i = 0; i < 80; i++) s = tick(s, 0.1);

    expect(boss(s).isFighting).toBe(true);
    expect(boss(s).rewardPending).toBe(false);
    expect(boss(s).heroHp).toBeGreaterThan(0);
  });

  it("не уводит attacksLeft в минус (безлимитный рейд)", () => {
    let s = raid();
    for (let i = 0; i < 5; i++) s = reducer(s, { type: "GUILD_BOSS_ATTACK" });
    expect(boss(s).attacksLeft).toBe(-1);
  });

  it("продолжает тикать дуэли, пока идёт рейд (регресс на ранний return)", () => {
    const base = raid();
    const foe = { name: "Соперник", classId: "archer" as const, mmr: 1200, hp: 1e6, maxHp: 1e6, dmg: 10, as: 1, crit: 0, critDmg: 150, power: 100, isBot: true };
    let s: GameState = { ...base, duel: { ...base.duel, state: "fight", foe, heroHp: 1e6, heroT: 0, foeT: 0 } };

    const foeHpBefore = s.duel.foe!.hp;
    for (let i = 0; i < 50; i++) s = tick(s, 0.1);

    expect(s.duel.foe!.hp).toBeLessThan(foeHpBefore);
  });
});

describe("run: выбор дара бездны", () => {
  /** Доводим забег до убийства босса и открытия модалки выбора дара. */
  function pickReady(): GameState {
    let s = reducer(newGame(), { type: "CHOOSE_CLASS", classId: "mage", name: "Тест" });
    // Забираем ежедневную награду: иначе модалка «новый день» ставит бой на паузу.
    s = reducer(s, { type: "CLAIM_ACTIVITY" });
    s = { ...s, hero: { ...s.hero, level: 40 } };
    s = reducer(s, { type: "START_RUN", kind: "exp" });
    // Ставим боссовую волну и слабого босса: первый же удар его добивает.
    const bossWave = 5;
    const weakBoss = { ...spawnRunEnemy(bossWave, "exp", 1), hp: 1, maxHp: 1 };
    s = { ...s, run: { ...s.run, wave: bossWave, enemy: weakBoss } };
    for (let i = 0; i < 50 && s.modal?.t !== "runpick"; i++) s = tick(s, 0.1);
    return s;
  }

  it("предлагает выбрать дар с босса вместо автолотереи", () => {
    const s = pickReady();
    expect(s.modal?.t).toBe("runpick");
    const options = s.modal?.t === "runpick" ? s.modal.options : [];
    expect(options.length).toBeGreaterThan(0);
    expect(s.run.active).toBe(true);
    expect(s.run.wave).toBeLessThan(RUN_WAVES);
  });

  it("пока выбор не сделан, забег не наносит урон и не двигает волны", () => {
    let s = pickReady();
    const wave = s.run.wave;
    const hp = s.run.enemy?.hp ?? 0;
    for (let i = 0; i < 20; i++) s = tick(s, 0.1);
    expect(s.run.wave).toBe(wave);
    expect(s.run.enemy?.hp ?? 0).toBe(hp);
  });

  it("применяет выбранный дар и закрывает модалку", () => {
    const s = pickReady();
    const id = s.modal?.t === "runpick" ? s.modal.options[0] : "";
    const picked = reducer(s, { type: "RUN_PICK", id });
    expect(picked.run.relics[id]).toBe(1);
    expect(picked.modal).toBeNull();
    expect(picked.run.active).toBe(true);
  });

  it("сохраняет невыбранный дар при перезагрузке сейва и чистит его вне забега", () => {
    const s = pickReady();
    const kept = migrateState(clone(s));
    expect(kept.modal?.t).toBe("runpick");

    const outsideRun = migrateState(clone({ ...s, run: { ...s.run, active: false } }));
    expect(outsideRun.modal).toBeNull();
  });
});
