import { task01 } from "./01-measure-the-baseline.js";
import { task02 } from "./02-reuse-dont-recompute.js";
import type { WorkshopTask } from "./types.js";

/**
 * The workshop, in order.
 *
 * The arc mirrors the talk: measure first, then fix one stage at a time. We go
 * after the build before package resolution, because the build is where the time
 * is — and because the best resolution tricks want a generated project, which we
 * don't have yet.
 *
 * Tasks are added here as they're written.
 */
export const tasks: WorkshopTask[] = [task01, task02];

export const findTask = (id: number): WorkshopTask | undefined =>
  tasks.find((task) => task.id === id);

export const nextTask = (completed: number[]): WorkshopTask | undefined =>
  tasks.find((task) => !completed.includes(task.id));
