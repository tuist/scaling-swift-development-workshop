import { task01 } from "./01-measure-the-baseline.js";
import type { WorkshopTask } from "./types.js";

/**
 * The workshop, in order.
 *
 * The arc mirrors the talk: measure first, then split the pipeline and fix one
 * stage at a time. Tasks are added here as they're written.
 */
export const tasks: WorkshopTask[] = [task01];

export const findTask = (id: number): WorkshopTask | undefined =>
  tasks.find((task) => task.id === id);

export const nextTask = (completed: number[]): WorkshopTask | undefined =>
  tasks.find((task) => !completed.includes(task.id));
