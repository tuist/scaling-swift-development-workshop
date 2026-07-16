import { task01 } from "./01-measure-the-baseline.js";
import { task02 } from "./02-your-cores-are-idle.js";
import { task05 } from "./05-reuse-dont-recompute.js";
import type { WorkshopTask } from "./types.js";

/**
 * The workshop, in order.
 *
 * The arc follows the talk, and each step is justified by the number the step
 * before it produced:
 *
 *   1. Measure the baseline          ✅ built
 *   2. Your cores are idle           ✅ built — 2.8x on 11 cores; the graph, not the CPU
 *   3. Generate it with Tuist        ⏳ not built — kill the pbxproj; nothing gets faster yet
 *   4. Split the god module          ⏳ not built — change the shape; the cores wake up
 *   5. Reuse, don't recompute        ✅ built — the compilation cache (fine-grained)
 *   6. Cache whole modules           ⏳ not built — the module cache (coarse), and why
 *                                       granularity is the whole game
 *
 * Caching deliberately comes *after* modularisation: caching first would have
 * been optimising around a graph problem instead of fixing it, and the module
 * cache in task 6 only pays off once the graph is worth caching.
 *
 * The numbering has a gap until 3 and 4 land. That's intentional — the ids are
 * stable so branch names and measurement labels don't churn later.
 */
export const tasks: WorkshopTask[] = [task01, task02, task05];

export const findTask = (id: number): WorkshopTask | undefined =>
  tasks.find((task) => task.id === id);

export const nextTask = (completed: number[]): WorkshopTask | undefined =>
  tasks.find((task) => !completed.includes(task.id));
