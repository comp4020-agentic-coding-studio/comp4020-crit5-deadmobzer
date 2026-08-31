// Pure game rules --- no DOM, no canvas, no side effects at import time --- so
// they can be exercised directly by a test and by the live page. main.js
// imports these instead of duplicating the logic inline.

/**
 * Axis-aligned box overlap: the rule behind every collision in the game.
 * A hit here is what ends a run --- "a wrong move is possible".
 * @param {{x:number,y:number,w:number,h:number}} a
 * @param {{x:number,y:number,w:number,h:number}} b
 */
export function boxesOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * From your second run on, finishing below your best score locks the page
 * instead of letting you restart --- the game's ending for a returning
 * player who hasn't improved.
 * @param {number} runs completed runs so far, including the one that just ended
 * @param {number} score the run that just ended
 * @param {number} hi best score across all runs
 */
export function locksOnRestart(runs, score, hi) {
  return runs >= 2 && score < hi;
}
