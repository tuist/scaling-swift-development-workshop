import { task01 } from "./01-measure-the-baseline.js";
import { task02 } from "./02-your-cores-are-idle.js";
import { task03 } from "./03-generate-it.js";
import { task04 } from "./04-split-the-god-module.js";
import { task05 } from "./05-reuse-dont-recompute.js";
import { task06 } from "./06-cache-whole-modules.js";
import { task07 } from "./07-test-what-changed.js";
import { task08 } from "./08-the-build-that-lies.js";
import { task09 } from "./09-make-ci-pay.js";
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
 *   4. Split the god module     53% SLOWER, on purpose — modules aren't faster
 *   5. Reuse, don't recompute   the compilation cache: fine-grained, per compile job
 *   6. Cache whole modules      the module cache: coarse — and where task 4 gets paid
 *   7. Test only what changed   the same contract, in the test suite
 *   8. The build that lies      a phase that breaks 'same inputs, same output'
 *   9. Make CI pay for it       none of the above is true on an empty runner
 *
 * Caching comes *after* modularisation on purpose, and the measurements are why.
 * Splitting the monolith makes the clean build 53% slower and buys no parallelism
 * at all — Xcode already compiles files inside a target concurrently. Modules are
 * not a speed optimisation. They are what makes a build *cacheable*, which task 6
 * then proves: 8.1s for the cached monolith against 3.3s for the cached split.
 *
 * Tasks 7 and 8 are the same sentence again in two other places. Skipping a test
 * assumes its result follows from its inputs; a flaky test breaks that. Caching a
 * build assumes the same; a phase that stamps a clock breaks that. Task 9 is where
 * all of it either pays off or quietly doesn't.
 */
export const tasks: WorkshopTask[] = [task01, task02, task03, task04, task05, task06, task07, task08, task09];

export const findTask = (id: number): WorkshopTask | undefined =>
  tasks.find((task) => task.id === id);

export const nextTask = (completed: number[]): WorkshopTask | undefined =>
  tasks.find((task) => !completed.includes(task.id));
