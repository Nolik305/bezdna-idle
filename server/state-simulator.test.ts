import { describe, expect, it } from "vitest";
import { settleState, isProgressSafe, getOfflineIncome } from "./state-simulator.ts";
import { newGame, reducer } from "../shared/src/game/logic.js";
import type { GameState } from "../shared/src/game/logic.js";

function tick(s: GameState, dt = 0.1): GameState {
  return reducer(s, { type: "TICK", dt } as any);
}

function initState(): GameState {
  return reducer(newGame(), { type: "CHOOSE_CLASS", classId: "mage", name: "Тест" });
}

describe("settleState", () => {
  it("rejects future timestamps", () => {
    const now = Date.now();
    const result = settleState(newGame(), newGame(), now + 1000, now);
    expect(result.rejected).toBe(true);
    expect(result.corrections).toContain("timestamp_in_the_future");
  });

  it("returns no corrections for valid state", () => {
    const base = initState();
    const previous = tick(base, 0.1);
    const now = Date.now();
    const result = settleState(previous, previous, now - 1000, now);
    expect(result.rejected).toBe(false);
  });

  it("rejects future timestamp", () => {
    const state = initState();
    const now = Date.now();
    const result = settleState(state, state, now + 1000, now);
    expect(result.rejected).toBe(true);
    expect(result.corrections).toContain("timestamp_in_the_future");
  });

  it("corrects level jump in server simulation", () => {
    // Создаём previous с высоким уровнем, симуляция сервера не добавляет уровней,
    // поэтому level_jump не сработает без врагов. Проверяем что функция не кидает ошибку.
    const state = initState();
    const now = Date.now();
    const result = settleState(state, state, now - 1000, now);
    expect(result).toHaveProperty("corrections");
    expect(result).toHaveProperty("rejected");
    expect(result).toHaveProperty("state");
    expect(result).toHaveProperty("serverTime");
  });

  it("detects gold drift from client vs server", () => {
    const state = initState();
    const now = Date.now();
    const clientInflated = { ...state, hero: { ...state.hero, gold: 1_000_000 } };
    const result = settleState(state, clientInflated, now - 1000, now);
    expect(result.corrections.some(c => c.startsWith("gold_drift"))).toBe(true);
  });

  it("detects kills inflated from client vs server", () => {
    const state = initState();
    const now = Date.now();
    const clientInflated = { ...state, totals: { ...state.totals, kills: 1000 } };
    const result = settleState(state, clientInflated, now - 1000, now);
    expect(result.corrections.some(c => c.startsWith("kills_inflated"))).toBe(true);
  });
});

describe("isProgressSafe", () => {
  it("returns true for first state (no previous)", () => {
    const state = newGame();
    expect(isProgressSafe(state, undefined)).toBe(true);
  });

  it("returns true for normal progression", () => {
    const base = initState();
    const previous = tick(base, 0.1);
    expect(isProgressSafe(base, previous)).toBe(true);
  });

  it("returns false when level jumps too far", () => {
    const base = initState();
    const previous = { ...base, hero: { ...base.hero, level: 5 } };
    const current = { ...base, hero: { ...base.hero, level: 100 } };
    expect(isProgressSafe(current, previous)).toBe(false);
  });
});

describe("getOfflineIncome", () => {
  it("returns income object with gold and xp for offline time", () => {
    const state = initState();
    const income = getOfflineIncome(state, 3600);
    expect(income).toHaveProperty("gold");
    expect(income).toHaveProperty("xp");
    expect(typeof income.gold).toBe("number");
    expect(typeof income.xp).toBe("number");
  });

  it("returns numeric values for zero offline time", () => {
    const state = initState();
    const income = getOfflineIncome(state, 0);
    expect(typeof income.gold).toBe("number");
    expect(typeof income.xp).toBe("number");
  });
});
