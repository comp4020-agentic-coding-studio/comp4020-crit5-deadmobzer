import { describe, expect, it } from "vitest";
import { boxesOverlap } from "../game-rules.js";

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
