/** One assertion inside a task's validation. */
export interface CheckResult {
  label: string;
  ok: boolean;
  /** Shown under the check when it fails — say what to do, not just what broke. */
  detail?: string;
}

export interface ValidationResult {
  checks: CheckResult[];
  /** A nudge shown when checks fail. */
  hint?: string;
}

export const allPassed = (result: ValidationResult): boolean =>
  result.checks.length > 0 && result.checks.every((check) => check.ok);

/**
 * An extra thing a task can offer beyond "validate" — for example, actually
 * running the benchmark that the task is about.
 */
export interface TaskAction {
  id: string;
  label: string;
  hint?: string;
  run: () => Promise<void>;
}

export interface WorkshopTask {
  id: number;
  slug: string;
  /** Which part of the talk's arc this belongs to, e.g. "Step zero". */
  stage: string;
  title: string;
  /** One line, shown in the task list. */
  summary: string;
  /** The task brief. Rendered as-is inside a note box. */
  brief: string;
  actions?: TaskAction[];
  validate: () => Promise<ValidationResult>;
  /**
   * Checkpoint branch holding this task's solved state, and the starting point
   * for the next task.
   */
  solutionBranch: string;
  /**
   * Shown instead of the checkout instructions when a branch can't actually
   * solve the task — a measurement task, for instance, has to be run on your own
   * machine, and a checked-in number would be someone else's.
   */
  stuckNote?: string;
}
