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

// How many refusals before the lock relents. Infinity would make it a real
// brick --- the constant lives here, not buried in main.js, so a test can
// hold it to "finite" the way it holds collision to "axis-aligned overlap".
export var RELENT_AFTER = 5;

/**
 * One tap against a locked restart. Taps inside `cooldownMs` of the last
 * processed one are ignored --- so mashing can't race through the escalation
 * in a single frame --- but every tap outside the cooldown still counts
 * toward `relentAfter`. That's what keeps the lock from being permanent: no
 * matter how it's tapped, a paced player always reaches `relents: true`
 * within `relentAfter` real taps.
 * @param {number} now
 * @param {number} lastRefuseAt time of the last processed tap, or -Infinity
 * @param {number} tapsSoFar taps processed so far
 * @param {number} cooldownMs
 * @param {number} relentAfter
 */
export function refusalStep(now, lastRefuseAt, tapsSoFar, cooldownMs, relentAfter) {
  if (now - lastRefuseAt < cooldownMs) {
    return { processed: false, tapsSoFar: tapsSoFar, lastRefuseAt: lastRefuseAt, relents: false };
  }
  var tapsAfter = tapsSoFar + 1;
  return { processed: true, tapsSoFar: tapsAfter, lastRefuseAt: now, relents: tapsAfter >= relentAfter };
}
