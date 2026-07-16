import fs from "node:fs/promises";
import * as p from "@clack/prompts";
import { findTask, nextTask, tasks } from "./tasks/index.js";
import { allPassed, type WorkshopTask } from "./tasks/types.js";
import { loadState, markCompleted, markVisited } from "./state.js";
import { paths } from "./paths.js";
import { brand, symbols } from "./theme.js";
import { note } from "./ui.js";

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
    await markCompleted(task.id);
    p.log.success(`Task ${task.id} complete.`);
    const upcoming = nextTask((await loadState()).completed);
    if (upcoming) {
      p.log.info(`Next up: ${brand.accent(`${upcoming.id}. ${upcoming.title}`)}`);
    } else {
      p.log.info("That's every task written so far. More coming.");
    }
  } else if (result.hint) {
    p.log.info(result.hint);
  }
};

const showTask = async (task: WorkshopTask): Promise<void> => {
  await markVisited(task.id);
  note(task.brief, briefTitle(task));

  for (;;) {
    // Same shape for every option — clack infers the value type from the array,
    // and a mixed shape collapses it to `unknown`.
    const options = [
      { value: "validate", label: "Validate my work", hint: "Check whether you've done it" },
      ...(task.reveals ?? []).map((reveal) => ({
        value: `reveal:${reveal.id}`,
        label: reveal.label,
        hint: reveal.hint ?? "Show more",
      })),
      { value: "brief", label: "Show the brief again", hint: "Re-read the task" },
      { value: "stuck", label: "I'm stuck", hint: `Jump to ${task.solutionBranch}` },
      { value: "back", label: "Back to the task list", hint: "Pick another task" },
    ];

    // Default to validating. The reveals are there when they're wanted, not
    // before — you don't learn anything from a command handed to you.
    const choice = await p.select({
      message: `Task ${task.id}`,
      options,
      initialValue: "validate",
    });
    if (p.isCancel(choice) || choice === "back") return;

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
      note(body, reveal.title);
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
    await showTask(task);
  }

  p.outro(
    `${brand.dim("Run")} ${brand.accent("mise run workshop")} ${brand.dim("any time to pick up where you left off.")}`,
  );
};

main().catch((error: unknown) => {
  p.log.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
