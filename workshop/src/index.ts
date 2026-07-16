import * as p from "@clack/prompts";
import { findTask, nextTask, tasks } from "./tasks/index.js";
import { allPassed, type WorkshopTask } from "./tasks/types.js";
import { loadState, markCompleted, markVisited } from "./state.js";
import { brand, symbols } from "./theme.js";

const statusMarker = (task: WorkshopTask, completed: number[]): string =>
  completed.includes(task.id) ? symbols.pass : symbols.pending;

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
  p.note(lines.join("\n"), passed ? "Passed" : "Not yet");

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
  p.note(task.brief, `${task.stage} · Task ${task.id} — ${task.title}`);

  for (;;) {
    // Keep every option the same shape — clack infers the value type from the
    // options array, and a mixed shape collapses it to `unknown`.
    const options = [
      ...(task.actions ?? []).map((action) => ({
        value: `action:${action.id}`,
        label: action.label,
        hint: action.hint ?? "Run this step",
      })),
      { value: "validate", label: "Validate my work", hint: "Check whether the task is done" },
      { value: "brief", label: "Show the brief again", hint: "Re-read the task" },
      { value: "stuck", label: "I'm stuck", hint: `Jump to ${task.solutionBranch}` },
      { value: "back", label: "Back to the task list", hint: "Pick another task" },
    ];

    // Preselect the task's primary action. This also gives clack the inference
    // site it needs for the option value type.
    const firstAction = (task.actions ?? [])[0];
    const initialValue = firstAction ? `action:${firstAction.id}` : "validate";

    const choice = await p.select({ message: `Task ${task.id}`, options, initialValue });
    if (p.isCancel(choice) || choice === "back") return;

    if (choice === "brief") {
      p.note(task.brief, `${task.stage} · Task ${task.id} — ${task.title}`);
      continue;
    }

    if (choice === "validate") {
      await runValidation(task);
      continue;
    }

    if (choice === "stuck") {
      p.note(
        task.stuckNote ??
          `This task's solved state lives on ${brand.accent(task.solutionBranch)}.\n\n` +
            `  ${brand.dim("git stash")}          ${brand.dim("# keep whatever you have")}\n` +
            `  ${brand.dim(`git checkout ${task.solutionBranch}`)}\n\n` +
            `Then come back and validate. There's no shame in it — the point is the\nnext task, not this one.`,
        "Stuck?",
      );
      continue;
    }

    const actionId = choice.replace("action:", "");
    const action = (task.actions ?? []).find((candidate) => candidate.id === actionId);
    if (action) await action.run();
  }
};

const main = async (): Promise<void> => {
  console.clear();
  p.intro(`${brand.accent("◆")} ${brand.bold("Scaling Swift Development")} ${brand.dim("· workshop")}`);

  const state = await loadState();
  if (state.completed.length === 0) {
    p.log.info(
      `We start from ${brand.accent("RockyFeed")}: a small app that is slow for all the usual reasons.\n` +
        `${brand.dim("Your job is to make it fast — and to prove that you did.")}`,
    );
  } else {
    p.log.info(
      `${brand.bold(`${state.completed.length}/${tasks.length}`)} tasks done so far.`,
    );
  }

  for (;;) {
    const task = await chooseTask();
    if (!task) break;
    await showTask(task);
  }

  p.outro(`${brand.dim("Run")} ${brand.accent("mise run workshop")} ${brand.dim("any time to pick up where you left off.")}`);
};

main().catch((error: unknown) => {
  p.log.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
