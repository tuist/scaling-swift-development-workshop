import * as p from "@clack/prompts";
import {
  benchmark,
  loadMeasurement,
  metricBlurbs,
  metricRoughSeconds,
  metricTitles,
  saveMeasurement,
  type MetricKey,
  type Stat,
} from "../measure.js";
import { renderMachine, renderMeasurement } from "../report.js";
import { brand, formatDuration } from "../theme.js";
import { note } from "../ui.js";
import { hasBinary } from "../shell.js";
import type { CheckResult, ValidationResult, WorkshopTask } from "./types.js";

const REQUIRED_METRICS: MetricKey[] = ["resolve", "cleanBuild", "incremental", "touchCore"];

const brief = `${brand.bold("You can't improve what you can't see.")}

Right now nobody in this room can say what RockyFeed actually costs. Not "it feels
slow" — a number, with a spread, that you can repeat tomorrow and compare against.

That's the whole job of this first task, and it's the one step you can't skip:
every later change we make is judged against the numbers you take right now.

${brand.bold("We measure four things")}, because "the build is slow" is never one problem:

  ${brand.accent("Clean build")}        ${brand.bold("The one we chase.")} What CI pays on every run, and what
                      you pay after every clean. Most of today aims here.
  ${brand.accent("Resolve packages")}   SwiftPM git-clones every dependency, with full history.
  ${brand.accent("Incremental build")}  Changed nothing, built again. Should be free. Watch.
  ${brand.accent("One line in Core")}   A spacing constant in the design system. A diagnostic, not
                      a target — see below.

${brand.bold("Why hyperfine?")}
Because timing a build once tells you almost nothing. Machines are noisy: thermal
state, Spotlight, the browser you left open. hyperfine runs the command repeatedly
and reports ${brand.dim("mean ± σ")}, so later you can tell a real win from luck.

${brand.bold("Do this now")}
Pick ${brand.accent("Measure the baseline")} below. It will take a few minutes — that wait is
not wasted time, it ${brand.bold("is")} the point. It's the wait your team pays all day.

${brand.dim("Nothing about the project changes in this task. We only look at it.")}`;

type Depth = "quick" | "standard";

const runsFor = (depth: Depth): number => (depth === "quick" ? 1 : 3);

const measureBaseline = async (): Promise<void> => {
  if (!(await hasBinary("hyperfine"))) {
    p.log.error(
      `hyperfine isn't installed. Run ${brand.accent("mise install")} in the repo root and try again.`,
    );
    return;
  }

  const existing = await loadMeasurement("baseline");
  if (existing) {
    const again = await p.confirm({
      message: "A baseline already exists. Measure again and overwrite it?",
      initialValue: false,
    });
    if (p.isCancel(again) || !again) {
      p.log.info("Kept the existing baseline.");
      return;
    }
  }

  const estimate = (runs: number): string => {
    const total = REQUIRED_METRICS.reduce((sum, key) => sum + metricRoughSeconds[key] * runs, 0);
    return formatDuration(total);
  };

  const depthOptions: Array<{ value: Depth; label: string; hint: string }> = [
    {
      value: "quick",
      label: "Quick — 1 run each",
      hint: `~${estimate(1)}, no error bars. Fine for a first look.`,
    },
    {
      value: "standard",
      label: "Standard — 3 runs each (recommended)",
      hint: `~${estimate(3)}. Gives you mean ± σ, which is what you actually want.`,
    },
  ];

  const depth = await p.select({
    message: "How thorough should the baseline be?",
    options: depthOptions,
    initialValue: "standard" as Depth,
  });
  if (p.isCancel(depth)) return;

  const runs = runsFor(depth);
  if (runs === 1) {
    p.log.warn(
      "One run per benchmark means no standard deviation. You won't be able to tell small wins from noise.",
    );
  }

  p.log.info(
    `Benchmarking with hyperfine. Grab a coffee — and notice how long this takes.`,
  );

  const metrics: Partial<Record<MetricKey, Stat>> = {};

  for (const key of REQUIRED_METRICS) {
    const spinner = p.spinner();
    spinner.start(`${metricTitles[key]} — ${brand.dim(metricBlurbs[key])}`);
    const startedAt = Date.now();
    try {
      const stat = await benchmark(key, runs);
      metrics[key] = stat;
      spinner.stop(
        `${metricTitles[key]}  ${brand.bold(formatDuration(stat.mean))}` +
          (stat.runs > 1 ? ` ${brand.dim(`± ${formatDuration(stat.stddev)}`)}` : ""),
      );
    } catch (error) {
      const elapsed = formatDuration((Date.now() - startedAt) / 1000);
      spinner.stop(`${metricTitles[key]} — failed after ${elapsed}`, 1);
      p.log.error(error instanceof Error ? error.message : String(error));
      p.log.info(
        "Fix the error above and run the measurement again. A partial baseline isn't much use.",
      );
      return;
    }
  }

  const measurement = await saveMeasurement("baseline", metrics);

  note(
    `${renderMeasurement(measurement)}\n\n${renderMachine(measurement)}`,
    "Your baseline",
  );

  const touchCore = metrics.touchCore;
  const incremental = metrics.incremental;
  if (touchCore && incremental) {
    const ratio = touchCore.mean / Math.max(incremental.mean, 0.001);
    p.log.info(
      `Changing one line in ${brand.accent("Core")}'s design system costs ` +
        `${brand.bold(`${ratio.toFixed(0)}×`)} a no-op build.\n` +
        `${brand.dim("Read that as a fact about your graph, not a bug to fix: ~110 files genuinely")}\n` +
        `${brand.dim("depend on Theme, so they genuinely rebuild. Splitting Core would not save you")}\n` +
        `${brand.dim("a second here. It's the price of a shared design system — worth paying, worth")}\n` +
        `${brand.dim("knowing.")}`,
    );
  }

  const cleanBuild = metrics.cleanBuild;
  if (cleanBuild) {
    p.log.info(
      `${brand.bold("The number to watch is the clean build: ")}` +
        `${brand.bold(formatDuration(cleanBuild.mean))}.\n` +
        `${brand.dim("Your team pays it on every CI run. Next task, we make it smaller.")}`,
    );
  }

  p.log.success(
    `Saved to ${brand.dim(".workshop/measurements/baseline.json")} — every later task is compared against it.`,
  );
};

const validate = async (): Promise<ValidationResult> => {
  const checks: CheckResult[] = [];

  const hyperfineInstalled = await hasBinary("hyperfine");
  checks.push({
    label: "hyperfine is installed",
    ok: hyperfineInstalled,
    detail: hyperfineInstalled ? undefined : "Run `mise install` in the repo root.",
  });

  const baseline = await loadMeasurement("baseline");
  checks.push({
    label: "A baseline measurement exists",
    ok: baseline !== null,
    detail: baseline ? undefined : 'Choose "Measure the baseline" in this task.',
  });

  if (baseline) {
    const missing = REQUIRED_METRICS.filter((key) => !baseline.metrics[key]);
    checks.push({
      label: "All four metrics were recorded",
      ok: missing.length === 0,
      detail:
        missing.length === 0
          ? undefined
          : `Missing: ${missing.map((key) => metricTitles[key]).join(", ")}. Re-run the measurement.`,
    });

    // A baseline someone else recorded on another machine is worse than none —
    // it would make every later comparison a lie.
    const sameMachine = baseline.machine.cores === (await import("node:os")).cpus().length;
    checks.push({
      label: "The baseline was measured on this machine",
      ok: sameMachine,
      detail: sameMachine
        ? undefined
        : "This baseline looks like it came from a different machine. Re-measure so comparisons mean something.",
    });
  }

  return {
    checks,
    hint: 'Run "Measure the baseline" from this task, then validate again.',
  };
};

export const task01: WorkshopTask = {
  id: 1,
  slug: "measure-the-baseline",
  stage: "Step zero",
  title: "Measure the baseline",
  summary: "Get reproducible numbers before you change anything.",
  brief,
  actions: [
    {
      id: "measure",
      label: "Measure the baseline",
      hint: "Runs hyperfine across the four metrics",
      run: measureBaseline,
    },
  ],
  validate,
  solutionBranch: "solutions/01",
  // This task is deliberately the one you can't skip by checking out a branch.
  stuckNote:
    `There's no branch to check out for this one, and that's on purpose.\n\n` +
    `A baseline is a measurement of ${brand.bold("your")} machine. A number committed to git\n` +
    `would be someone else's laptop, on some other day, and every comparison you\n` +
    `made against it for the rest of the day would be fiction.\n\n` +
    `${brand.bold("If the measurement won't run:")}\n\n` +
    `  ${brand.dim("hyperfine not found")}      → ${brand.accent("mise install")}\n` +
    `  ${brand.dim("xcodebuild fails")}         → open ${brand.accent("app/RockyFeed.xcodeproj")} and build once by hand;\n` +
    `                           Xcode will tell you what's wrong far better than we can\n` +
    `  ${brand.dim("no iOS simulator")}         → install an iOS runtime in Xcode › Settings › Components\n\n` +
    `${brand.dim("Ask. This is the one step everything else is measured against.")}`,
};
