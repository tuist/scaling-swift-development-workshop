import { task01 } from "./01-measure-the-baseline.js";
import { task02 } from "./02-your-cores-are-idle.js";
import { task03 } from "./03-generate-it.js";
import { task04 } from "./04-split-the-god-module.js";
import { task05 } from "./05-reuse-dont-recompute.js";
import { task06 } from "./06-cache-whole-modules.js";
import { task07 } from "./07-test-what-changed.js";
import { task08 } from "./08-the-build-that-lies.js";
import { task09 } from "./09-make-ci-pay.js";
import { task10 } from "./10-nobody-else-can-see-it.js";
import { task11 } from "./11-a-cache-of-one.js";
import { task12 } from "./12-ask-it-what-changed.js";
import type { WorkshopTask } from "./types.js";

/**
 * The workshop, in order.
 *
 * The arc follows the talk, and each step is justified by the number the step
 * before it produced:
 *
 *   1. Measure the baseline     you can't improve what you can't see
 *   2. Your cores are idle      2.96x of 11 — and why no arrangement of modules fixes it
 *   3. Generate it with Tuist   move the graph out of a pbxproj and into Swift
 *   4. Split the god module     a trade: faster inner loop, a clean-build tax too small to see here
 *   5. Reuse, don't recompute   the compilation cache: fine-grained, per compile job
 *   6. Cache whole modules      the module cache: coarse — and where task 4 gets paid
 *   7. Test only what changed   the same contract, in the test suite
 *   8. The build that lies      a phase that breaks 'same inputs, same output'
 *   9. Make CI pay for it       none of the above is true on an empty runner
 *  10. Nobody else can see it   every number so far lives on one laptop
 *  11. A cache of one           3.3s that only you have; share it, and prove it
 *  12. Ask it what changed      make noticing automatic, because nobody clicks
 *
 * Caching comes *after* modularisation on purpose, and the measurements are why.
 * Splitting the monolith is a trade, measured: the incremental build gets ~30%
 * faster (touch one file, relink a 3-file app instead of a 90-file one), reliably.
 * The clean build carries a per-module tax (link/sign/embed × a dozen frameworks,
 * no extra parallelism) — real, but on a sample RockyFeed's size it's about the
 * size of the measurement noise, so it hides; on a large app it wouldn't. What the
 * split buys on the clean build is not speed but granularity, i.e. cacheability,
 * which task 6 spends: 8.1s for the cached monolith against 3.3s for the cached
 * split.
 *
 * Tasks 10 to 12 are where the day stops being about one laptop. Every measurement
 * up to here was taken by hand, once, by one person — which is exactly the habit
 * that let the build get slow in the first place. The server half makes the
 * numbers keep arriving without anyone remembering to take them, and it is where
 * task 4's split finally pays for the whole team rather than just
 * for you: a monolith is one hash and one cache entry, so a shared cache of it is
 * a shared cache of nothing.
 *
 * Tasks 7 and 8 are the same sentence again in two other places. Skipping a test
 * assumes its result follows from its inputs; a flaky test breaks that. Caching a
 * build assumes the same; a phase that stamps a clock breaks that. Task 9 is where
 * all of it either pays off or quietly doesn't.
 */
export const tasks: WorkshopTask[] = [
  task01, task02, task03, task04, task05, task06,
  task07, task08, task09, task10, task11, task12,
];

export const findTask = (id: number): WorkshopTask | undefined =>
  tasks.find((task) => task.id === id);

export const nextTask = (completed: number[]): WorkshopTask | undefined =>
  tasks.find((task) => !completed.includes(task.id));
