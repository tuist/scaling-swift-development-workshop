import fs from "node:fs/promises";
import * as p from "@clack/prompts";
import { findTask, nextTask, tasks } from "./tasks/index.js";
import { allPassed, type WorkshopTask } from "./tasks/types.js";
import { loadState, markCompleted, markVisited } from "./state.js";
import { paths } from "./paths.js";
import { brand, symbols } from "./theme.js";
import { codeBlock, note } from "./ui.js";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A one-time confetti burst for finishing the whole workshop. Purely cosmetic —
 * runValidation fires it only on the transition to all-tasks-complete.
 */
const celebrate = async (): Promise<void> => {
  const sparks = ["✦", "✧", "❋", "✺", "✹", "•", "◦"];
  const paints = [brand.accent, brand.success, brand.warn, brand.info, brand.accentDim];
  const width = Math.min((process.stdout.columns ?? 60) - 2, 54);

  process.stdout.write("\n");
  for (let frame = 0; frame < 14; frame++) {
    let line = "";
    for (let i = 0; i < width; i++) {
      if (Math.random() < 0.28) {
        const spark = sparks[Math.floor(Math.random() * sparks.length)]!;
        const paint = paints[Math.floor(Math.random() * paints.length)]!;
        line += paint(spark);
      } else {
        line += " ";
      }
    }
    process.stdout.write("\r" + line);
    await sleep(70);
  }
  process.stdout.write("\r" + " ".repeat(width) + "\r");

  console.log(brand.bold(brand.success("🎉  You made RockyFeed fast — and proved it, every number your own.")));
  console.log(brand.dim("    Twelve tasks done. That was the whole point."));
  console.log();
};

const statusMarker = (task: WorkshopTask, completed: number[]): string =>
  completed.includes(task.id) ? symbols.pass : symbols.pending;

const briefTitle = (task: WorkshopTask): string =>
  `${task.stage} · Task ${task.id} — ${task.title}`;

const chooseTask = async (): Promise<WorkshopTask | null> => {
  const state = await loadState();
  const suggested = nextTask(state.completed) ?? tasks[0];

  const choice = await p.select({
    message: "Which task?",
    initialValue: suggested?.id ?? 1,
    options: tasks.map((task) => ({
      value: task.id,
      label: `${statusMarker(task, state.completed)} ${task.id}. ${task.title}`,
      hint: `${task.stage} — ${task.summary}`,
    })),
  });

  if (p.isCancel(choice)) return null;
  return findTask(choice) ?? null;
};

const runValidation = async (task: WorkshopTask): Promise<void> => {
  const spinner = p.spinner();
  spinner.start("Checking your work");

  let result;
  try {
    result = await task.validate();
  } catch (error) {
    spinner.stop("Validation errored", 1);
    p.log.error(error instanceof Error ? error.message : String(error));
    return;
  }

  const passed = allPassed(result);
  spinner.stop(passed ? "Checks complete" : "Checks complete — not there yet");

  const lines = result.checks.map((check) => {
    const head = `${check.ok ? symbols.pass : symbols.fail} ${check.label}`;
    return check.ok || !check.detail ? head : `${head}\n  ${brand.dim(check.detail)}`;
  });
  note(lines.join("\n"), passed ? "Passed" : "Not yet");

  // Their numbers, whether or not everything passed — a partial result is still
  // worth seeing.
  if (result.report) note(result.report, "Your numbers");

  if (passed) {
    const before = (await loadState()).completed.length;
    await markCompleted(task.id);
    p.log.success(`Task ${task.id} complete.`);
    const upcoming = followingTask(task);
    const nowComplete = (await loadState()).completed.length === tasks.length;
    if (nowComplete && before < tasks.length) {
      // The whole workshop just came together. Fire the confetti once, on the
      // transition — not every time someone re-validates the last task.
      await celebrate();
    } else if (upcoming) {
      p.log.info(
        `Next up: ${brand.accent(`${upcoming.id}. ${upcoming.title}`)} — ` +
          `pick ${brand.success("Continue")} below.`,
      );
    } else {
      p.log.info("That's every task written so far. More coming.");
    }
  } else if (result.hint) {
    p.log.info(result.hint);
  }
};

/** The task immediately after this one in the arc, or null if this is the last. */
const followingTask = (task: WorkshopTask): WorkshopTask | null =>
  tasks[tasks.findIndex((candidate) => candidate.id === task.id) + 1] ?? null;

/**
 * Runs one task's menu.
 *
 * Returns the task to open next — the following task when the participant chooses
 * to continue — or null to go back to the list.
 */
const showTask = async (task: WorkshopTask): Promise<WorkshopTask | null> => {
  await markVisited(task.id);
  note(task.brief, briefTitle(task));

  const next = followingTask(task);

  for (;;) {
    const done = (await loadState()).completed.includes(task.id);

    // Once the task passes, offer to move straight on — the whole point of a
    // linear workshop is that "next" is a first-class step, not a detour through
    // the list. Shown only after completion so the menu stays focused on doing
    // the task until it's done.
    const continueOption =
      done && next
        ? [
            {
              value: "next",
              label: `${brand.success("Continue")} to Task ${next.id}: ${next.title}`,
              hint: "You're done here — keep going",
            },
          ]
        : [];

    // Same shape for every option — clack infers the value type from the array,
    // and a mixed shape collapses it to `unknown`.
    const options = [
      ...continueOption,
      { value: "validate", label: "Validate my work", hint: "Check whether you've done it" },
      ...(task.reveals ?? []).map((reveal) => ({
        value: `reveal:${reveal.id}`,
        label: reveal.label,
        hint: reveal.hint ?? "Show more",
      })),
      { value: "brief", label: "Show the brief again", hint: "Re-read the task" },
      // Tasks whose answer is a measurement or an account handle have no branch to
      // check out, and say so in stuckNote. Promising one in the menu would send
      // people looking for a ref that was never pushed.
      {
        value: "stuck",
        label: "I'm stuck",
        hint: task.stuckNote ? "Options when it won't go" : `Jump to ${task.solutionBranch}`,
      },
      { value: "back", label: "Back to the task list", hint: "Pick another task" },
    ];

    // Before the task passes, default to validating — the reveals are there when
    // they're wanted, not before. After it passes, default to moving on.
    const choice = await p.select({
      message: `Task ${task.id}`,
      options,
      initialValue: done && next ? "next" : "validate",
    });
    if (p.isCancel(choice) || choice === "back") return null;
    if (choice === "next") return next;

    if (choice === "brief") {
      note(task.brief, briefTitle(task));
      continue;
    }

    if (choice === "validate") {
      await runValidation(task);
      continue;
    }

    if (choice === "stuck") {
      note(
        task.stuckNote ??
          `This task's solved state lives on ${brand.accent(task.solutionBranch)}.\n\n` +
            `  ${brand.dim("git stash")}          ${brand.dim("# keep whatever you have")}\n` +
            `  ${brand.dim(`git checkout ${task.solutionBranch}`)}\n\n` +
            `Then come back and validate. There's no shame in it — the point is the\nnext task, not this one.`,
        "Stuck?",
      );
      continue;
    }

    const reveal = (task.reveals ?? []).find((candidate) => `reveal:${candidate.id}` === choice);
    if (reveal) {
      const body = reveal.resolve ? await reveal.resolve() : reveal.body;
      if (reveal.copyable) codeBlock(body, reveal.title);
      else note(body, reveal.title);
    }
  }
};

const main = async (): Promise<void> => {
  console.clear();
  p.intro(`${brand.accent("◆")} ${brand.bold("Scaling Swift Development")} ${brand.dim("· workshop")}`);

  // hyperfine's --export-json won't create a missing directory: it runs the whole
  // benchmark and *then* fails to write. Nobody should lose two minutes to that.
  await fs.mkdir(paths.measurementsDir, { recursive: true });

  const state = await loadState();
  if (state.completed.length === 0) {
    p.log.info(
      `We start from ${brand.accent("RockyFeed")}: a small app that's slow for all the usual reasons.\n` +
        `${brand.dim("You'll make it fast, and prove that you did. The runner explains each task")}\n` +
        `${brand.dim("and checks your work — you run the commands.")}`,
    );
  } else {
    p.log.info(`${brand.bold(`${state.completed.length}/${tasks.length}`)} tasks done so far.`);
  }

  for (;;) {
    const task = await chooseTask();
    if (!task) break;
    // Stay inside the tasks, following "Continue" straight from one to the next,
    // until the participant asks to go back to the list.
    for (let current: WorkshopTask | null = task; current; ) {
      current = await showTask(current);
    }
  }

  p.outro(
    `${brand.dim("Run")} ${brand.accent("mise run workshop")} ${brand.dim("any time to pick up where you left off.")}`,
  );
};

main().catch((error: unknown) => {
  p.log.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
