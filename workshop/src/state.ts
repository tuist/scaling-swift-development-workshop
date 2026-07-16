import fs from "node:fs/promises";
import path from "node:path";
import { paths } from "./paths.js";

export interface WorkshopState {
  /** Task ids the participant has validated successfully. */
  completed: number[];
  /** Last task they looked at, so we can resume where they left off. */
  lastVisited: number | null;
}

const emptyState: WorkshopState = { completed: [], lastVisited: null };

export const loadState = async (): Promise<WorkshopState> => {
  try {
    const raw = await fs.readFile(paths.statePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<WorkshopState>;
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      lastVisited: typeof parsed.lastVisited === "number" ? parsed.lastVisited : null,
    };
  } catch {
    // No state yet (or it's corrupt) — start clean rather than crash on someone's
    // first run of the day.
    return { ...emptyState };
  }
};

export const saveState = async (state: WorkshopState): Promise<void> => {
  await fs.mkdir(path.dirname(paths.statePath), { recursive: true });
  await fs.writeFile(paths.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
};

export const markCompleted = async (taskId: number): Promise<void> => {
  const state = await loadState();
  if (!state.completed.includes(taskId)) state.completed.push(taskId);
  state.completed.sort((a, b) => a - b);
  state.lastVisited = taskId;
  await saveState(state);
};

export const markVisited = async (taskId: number): Promise<void> => {
  const state = await loadState();
  state.lastVisited = taskId;
  await saveState(state);
};
