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
  /** Shown after the checks pass — their numbers, their result. */
  report?: string;
}

export const allPassed = (result: ValidationResult): boolean =>
  result.checks.length > 0 && result.checks.every((check) => check.ok);

/**
 * Something the task can show, but only when asked for.
 *
 * The runner never does the work — it explains what to do and checks the result.
 * The exact commands live behind a reveal so people attempt the thing first;
 * handing someone a command to paste teaches them nothing about why it's that
 * command.
 */
export interface Reveal {
  id: string;
  /** Menu label, e.g. "Give me a hint". */
  label: string;
  hint?: string;
  /** Box title once revealed. */
  title: string;
  body: string;
  /**
   * Computes the body when asked, for reveals that read back the participant's
   * own numbers. Still only ever *reads* — a reveal never does the work.
   */
  resolve?: () => Promise<string>;
  /**
   * Render bare, with no box or gutter, so the body can be selected and pasted.
   * Use it for shell snippets: clack's `│  ` prefix ends up in the paste
   * otherwise, which makes the one reveal people need to copy the one they can't.
   */
  copyable?: boolean;
}

export interface WorkshopTask {
  id: number;
  slug: string;
  /** Which part of the talk's arc this belongs to, e.g. "Step zero". */
  stage: string;
  title: string;
  /** One line, shown in the task list. */
  summary: string;
  /** The task brief: the goal and why it matters. Never the how. */
  brief: string;
  /** Hints and commands, in increasing order of giving it away. */
  reveals?: Reveal[];
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
