import { describe, expect, it } from "vitest";
import { boxesOverlap, refusalStep, RELENT_AFTER } from "../game-rules.js";

// The one rule under a focused test: an obstacle only ends the run when its
// box actually overlaps the dino's. Everything else about "a wrong move is
// possible" (dino height, jump timing, whether it feels fair) is for playing
// the finished game, not for this test.
describe("boxesOverlap: the collision rule that ends a run", () => {
  it("is a hit when the boxes overlap", () => {
    const dino = { x: 50, y: 100, w: 20, h: 30 };
    const cactus = { x: 55, y: 105, w: 10, h: 20 };
    expect(boxesOverlap(dino, cactus)).toBe(true);
  });

  it("clears an obstacle that hasn't reached the dino yet", () => {
    const dino = { x: 50, y: 100, w: 20, h: 30 };
    const cactus = { x: 200, y: 100, w: 10, h: 20 };
    expect(boxesOverlap(dino, cactus)).toBe(false);
  });

  it("clears a jump that clears the obstacle's height", () => {
    const dino = { x: 50, y: 40, w: 20, h: 30 };
    const cactus = { x: 55, y: 100, w: 10, h: 20 };
    expect(boxesOverlap(dino, cactus)).toBe(false);
  });

  it("treats boxes that only touch at an edge as a miss", () => {
    const dino = { x: 50, y: 100, w: 20, h: 30 };
    const touching = { x: 70, y: 100, w: 10, h: 20 };
    expect(boxesOverlap(dino, touching)).toBe(false);
  });
});

// The restart-lock's exit condition. Mashing the key should not skip the
// standoff (that was the bug fixed in 5bdc036), and no matter how it's
// tapped, the lock must never be permanent --- there always exists a
// sequence of taps that relents.
describe("refusalStep: the restart-lock always has an exit", () => {
  const COOLDOWN = 500;

  it("is configured to relent, not to brick permanently", () => {
    expect(RELENT_AFTER).toBeGreaterThan(0);
    expect(Number.isFinite(RELENT_AFTER)).toBe(true);
  });

  it("ignores mashed taps that land inside the cooldown", () => {
    let state = { tapsSoFar: 0, lastRefuseAt: -Infinity };
    const now = 1000;
    for (let i = 0; i < RELENT_AFTER + 5; i++) {
      const step = refusalStep(now, state.lastRefuseAt, state.tapsSoFar, COOLDOWN, RELENT_AFTER);
      if (step.processed) state = step;
    }
    // Six presses back-to-back (the bug's reproduction) must not burn through
    // every refusal in one frame: only the first tap in the burst counts.
    expect(state.tapsSoFar).toBe(1);
  });

  it("relents on the RELENT_AFTER'th paced tap, never earlier", () => {
    let state = { tapsSoFar: 0, lastRefuseAt: -Infinity };
    let now = 0;
    let relentedAt = -1;
    for (let i = 1; i <= RELENT_AFTER; i++) {
      now += COOLDOWN;
      const step = refusalStep(now, state.lastRefuseAt, state.tapsSoFar, COOLDOWN, RELENT_AFTER);
      expect(step.processed).toBe(true);
      state = step;
      if (step.relents) relentedAt = i;
      else expect(step.relents).toBe(false);
    }
    expect(relentedAt).toBe(RELENT_AFTER);
  });

  it("still relents within RELENT_AFTER taps even when mashing wastes some of them", () => {
    let state = { tapsSoFar: 0, lastRefuseAt: -Infinity };
    let now = 0;
    let relented = false;
    // A burst of mashed taps (ignored past the first) followed by one paced
    // tap, repeated: the lock must still yield in bounded, finite time.
    for (let round = 0; round < RELENT_AFTER && !relented; round++) {
      for (let mash = 0; mash < 4; mash++) {
        const step = refusalStep(now, state.lastRefuseAt, state.tapsSoFar, COOLDOWN, RELENT_AFTER);
        if (step.processed) state = step;
      }
      now += COOLDOWN;
      const step = refusalStep(now, state.lastRefuseAt, state.tapsSoFar, COOLDOWN, RELENT_AFTER);
      state = step;
      relented = step.relents;
    }
    expect(relented).toBe(true);
  });
});
