# Process overview

## What I built

A dark-parody Chrome dino game: it looks like the browser's offline error
page, plays like the real thing, and its copy escalates the longer you keep
tapping the dino instead of doing whatever you opened the tab for. The game
started as a standalone draft (`assets/dino-existential.html`) and got merged
into the actual template — real sprites, one rule under a focused test, no
on-screen instructions.

## The moments that mattered

### Isolating the collision rule under test

1. **What happened:** The crit requires one rule of the game to have a
   focused automated test. The obvious candidate is collision — the check
   that ends a run — but it lived inline in the canvas animation loop,
   coupled to a live `<canvas>` and `Image` objects that don't exist in a
   headless test environment.
2. **What I did instead of the obvious thing:** Rather than reaching for a
   real browser in the test runner (or mocking a 2D canvas context) just to
   exercise one piece of arithmetic, I pulled the box-overlap check out into
   its own dependency-free module, `game-rules.js`, that both the live game
   and the test import.
3. **How I knew it was right:** `pnpm check` runs the extracted function
   under Vitest/jsdom with four cases — a hit, an obstacle not yet reached, a
   jump that clears an obstacle, boxes that only touch at an edge — with no
   canvas mocking needed. I then drove the actual game in a headless Chromium
   session to confirm collisions still ended a run identically after the
   extraction.
4. **Citation:**
   [`59007c9`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-deadmobzer/commit/59007c9)

### Mashing the key open the restart-refusal's timing bug

1. **What happened:** After losing, then losing again without beating my
   first score, the page locked me out and refused to restart. My instinct
   was to just mash the restart key, the way anyone frustrated with a "No."
   would — and doing that burned through all five escalating refusal lines
   and relented in under a frame. Reading `refuse()` in isolation, the logic
   looks correct: it does exactly what each call asks. The bug only shows up
   as a *feel* problem, and only by actually playing it that way.
2. **What I did instead of the obvious thing:** Rather than special-casing
   key-repeat detection (fragile, and doesn't cover deliberate rapid tapping
   on touch), I added a 500ms cooldown inside `refuse()` itself, so the
   standoff is paced regardless of how the input arrives.
3. **How I knew it was right:** I scripted the exact failure — six presses
   back-to-back — before and after the fix: before, it relented in 31ms with
   only "Fine. Go on then." showing; after, the same mashing only ever
   registers "No." I then replayed it with realistic spacing between taps to
   confirm all five lines still appear in order and it still relents on the
   fifth, so paced play is unaffected.
4. **Citation:**
   [`5bdc036`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-deadmobzer/commit/5bdc036)

## Before you ship

`pnpm check:evidence` verifies your citations resolve to real commits, that a
reflection entry the marker reads is in `reflections/`, and that your
`CLAUDE.md` is there --- before a marker ever opens the file. It checks that
your map is traceable, not that it is good: the marker judges whether your
small, deliberately chosen set of moments shows real judgement and reflection. A
green check is not a substitute for that curation.

Images aren't checked: unlike a citation whose SHA doesn't resolve, a broken
image is visible the moment this file is rendered on GitHub.
