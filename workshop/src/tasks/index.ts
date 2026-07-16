import { task01 } from "./01-measure-the-baseline.js";
import { task02 } from "./02-your-cores-are-idle.js";
import { task03 } from "./03-generate-it.js";
import { task04 } from "./04-split-the-god-module.js";
import { task05 } from "./05-reuse-dont-recompute.js";
import type { WorkshopTask } from "./types.js";

/**
 * The workshop, in order.
 *
 * The arc follows the talk, and each step is justified by the number the step
 * before it produced:
 *
 *   1. Measure the baseline     you can't improve what you can't see
 *   2. Your cores are idle      2.8x out of 11 — the graph, not the CPU
 *   3. Generate it with Tuist   the graph lives in a pbxproj; move it into Swift
 *   4. Split the god module     now change what it says; the cores wake up
 *   5. Reuse, don't recompute   the compilation cache — fine-grained
 *   6. Cache whole modules      the module cache — coarse, and now worth it
 *
 * Caching comes *after* modularisation on purpose. Caching first would optimise
 * around a graph problem rather than fix it, and the module cache in task 6 only
 * pays off once the graph is worth caching — which is what task 4 makes true.
 */
export const tasks: WorkshopTask[] = [task01, task02, task03, task04, task05];

export const findTask = (id: number): WorkshopTask | undefined =>
  tasks.find((task) => task.id === id);

export const nextTask = (completed: number[]): WorkshopTask | undefined =>
  tasks.find((task) => !completed.includes(task.id));
