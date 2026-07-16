import * as p from "@clack/prompts";
import {
  benchmark,
  buildSetting,
  compilationCacheBytes,
  loadMeasurement,
  metricBlurbs,
  metricRoughSeconds,
  metricTitles,
  saveMeasurement,
  type MetricKey,
  type Stat,
} from "../measure.js";
import { renderComparison, renderMeasurement } from "../report.js";
import { brand, formatDuration } from "../theme.js";
import type { CheckResult, ValidationResult, WorkshopTask } from "./types.js";

const SETTING = "COMPILATION_CACHE_ENABLE_CACHING";
const MEASURED_METRICS: MetricKey[] = ["resolve", "cleanBuild", "incremental", "touchCore"];

const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return "nothing yet";
  const mb = bytes / 1024 ** 2;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
};

const brief = `${brand.bold("Same inputs, same output. Fetch it instead of building it.")}

Your clean build compiles every file in RockyFeed from scratch, every time —
including Alamofire and Kingfisher, which have not changed since the day you added
them. Nothing about that work is new. It's just unremembered.

Xcode 26 can remember it. Compilation caching hashes the inputs to each compile
job and stores the result in a content-addressed store (a ${brand.dim("CAS")}). Same inputs →
fetch the object instead of compiling it.

${brand.bold("Why this lever, first")}
There's a coarser kind of cache that works on whole modules — Bazel, Tuist. It's
powerful, but it only pays off when your dependency graph is a good shape, and
RockyFeed's very much isn't yet. Xcode's cache works one compile job at a time, so
it doesn't care how badly modularised you are. Which today, you are.

${brand.bold("Do this")}

  1. Open ${brand.accent("app/RockyFeed.xcodeproj")} in Xcode
  2. Select the ${brand.accent("RockyFeed")} ${brand.dim("project")} (the blue icon, not the target)
  3. ${brand.accent("Build Settings")} → search for ${brand.accent("compilation cache")}
  4. Set ${brand.accent("Enable Compilation Caching")} to ${brand.accent("Yes")}

Setting it on the ${brand.bold("project")} matters: that's what makes it reach the package
targets too, and the packages are most of your build.

${brand.bold("Then measure — and don't skip this")}
This cache is not free money, and the measurement is the only way you'd know:

  ${brand.success("Warm cache")}   the build you'll have all day. It gets much faster.
  ${brand.error("Cold cache")}   the first build, or a fresh CI runner, or the morning after
               an Xcode update. It gets ${brand.bold("slower")} — you're paying to fill a cache
               you don't get to read yet.
  ${brand.warn("Disk")}         hundreds of megabytes, and it grows.

That trade is the whole reason we measured first. Take the numbers, then decide
whether you'd ship this — which is a different question from whether it's faster.

${brand.dim("Xcode writes the cache next to DerivedData by default. The workshop keeps its own")}
${brand.dim("under .workshop/ so none of this touches the caches your day job depends on.")}`;

const measureAndCompare = async (): Promise<void> => {
  const enabled = await buildSetting(SETTING);
  if (enabled !== "YES") {
    p.log.warn(
      `${SETTING} is currently ${brand.bold(enabled ?? "unset")}. Measuring now would just ` +
        `reproduce your baseline.\nTurn it on in Xcode first — the brief has the four steps.`,
    );
    return;
  }

  const baseline = await loadMeasurement("baseline");
  if (!baseline) {
    p.log.error("No baseline to compare against. Go back and finish Task 1 first.");
    return;
  }

  const total = MEASURED_METRICS.reduce((sum, key) => sum + metricRoughSeconds[key] * 2, 0);
  p.log.info(
    `Re-running the same benchmarks, 2 runs each (~${formatDuration(total)}).\n` +
      `${brand.dim("The first clean build will be slow — that's the cache filling up. That cost is")}\n` +
      `${brand.dim("real, and we measure it separately in a moment.")}`,
  );

  const metrics: Partial<Record<MetricKey, Stat>> = {};
  for (const key of MEASURED_METRICS) {
    const spinner = p.spinner();
    spinner.start(`${metricTitles[key]} — ${brand.dim(metricBlurbs[key])}`);
    try {
      const stat = await benchmark(key, 2);
      metrics[key] = stat;
      spinner.stop(`${metricTitles[key]}  ${brand.bold(formatDuration(stat.mean))}`);
    } catch (error) {
      spinner.stop(`${metricTitles[key]} — failed`, 1);
      p.log.error(error instanceof Error ? error.message : String(error));
      return;
    }
  }

  const current = await saveMeasurement("task-02", metrics);
  p.note(renderComparison(baseline, current), "Baseline → with the cache on");

  const before = baseline.metrics.cleanBuild;
  const after = metrics.cleanBuild;
  if (before && after) {
    const saved = before.mean - after.mean;
    if (saved > 0) {
      p.log.success(
        `Clean build is ${brand.bold(formatDuration(saved))} faster — ` +
          `${brand.bold(`${(before.mean / after.mean).toFixed(1)}×`)}. ` +
          `Every CI run, every clean, from one build setting.`,
      );
    } else {
      p.log.warn(
        `The clean build didn't get faster. If this was your first run after enabling\n` +
          `the cache, it was still filling up — measure once more.`,
      );
    }
  }

  const size = await compilationCacheBytes();
  p.log.info(`The cache is costing you ${brand.bold(formatBytes(size))} on disk.`);
};

const measureColdCache = async (): Promise<void> => {
  const enabled = await buildSetting(SETTING);
  if (enabled !== "YES") {
    p.log.warn(`${SETTING} isn't on yet, so there's no cache to throw away.`);
    return;
  }

  const baseline = await loadMeasurement("baseline");
  const warm = await loadMeasurement("task-02");

  p.log.info(
    `Throwing the cache away and building clean — a fresh CI runner, or the first\n` +
      `build after an Xcode update. ${brand.dim(`One run, ~${formatDuration(metricRoughSeconds.coldCacheCleanBuild)}.`)}`,
  );

  const spinner = p.spinner();
  spinner.start(`${metricTitles.coldCacheCleanBuild} — ${brand.dim(metricBlurbs.coldCacheCleanBuild)}`);
  let cold: Stat;
  try {
    cold = await benchmark("coldCacheCleanBuild", 1);
    spinner.stop(`${metricTitles.coldCacheCleanBuild}  ${brand.bold(formatDuration(cold.mean))}`);
  } catch (error) {
    spinner.stop("Cold-cache build failed", 1);
    p.log.error(error instanceof Error ? error.message : String(error));
    return;
  }

  await saveMeasurement("task-02-cold", { coldCacheCleanBuild: cold });

  const rows = [
    `${"Clean build, no cache at all".padEnd(32)} ${formatDuration(baseline?.metrics.cleanBuild?.mean ?? NaN)}`,
    `${"Clean build, cache cold".padEnd(32)} ${brand.error(formatDuration(cold.mean))}   ${brand.dim("← filling it")}`,
    `${"Clean build, cache warm".padEnd(32)} ${brand.success(formatDuration(warm?.metrics.cleanBuild?.mean ?? NaN))}   ${brand.dim("← reading it")}`,
  ];
  p.note(rows.join("\n"), "What the cache actually costs");

  const noCache = baseline?.metrics.cleanBuild?.mean;
  if (noCache && cold.mean > noCache) {
    p.log.warn(
      `A cold cache is ${brand.bold(formatDuration(cold.mean - noCache))} ${brand.bold("slower")} than no cache at all.\n` +
        `${brand.dim("This is the p99 in the talk, and it's why 'we added a cache' is not the same")}\n` +
        `${brand.dim("claim as 'we got faster'. If your CI never restores the cache, you have made")}\n` +
        `${brand.dim("every run worse. Cache hit rate is the thing to watch, not cache existence.")}`,
    );
  }
};

const validate = async (): Promise<ValidationResult> => {
  const checks: CheckResult[] = [];

  const enabled = await buildSetting(SETTING);
  checks.push({
    label: `${SETTING} resolves to YES`,
    ok: enabled === "YES",
    detail:
      enabled === "YES"
        ? undefined
        : `It's currently ${enabled ?? "unset"}. Set "Enable Compilation Caching" to Yes on the ` +
          `RockyFeed project (not the target) in Xcode's Build Settings.`,
  });

  const measurement = await loadMeasurement("task-02");
  checks.push({
    label: "You measured the result",
    ok: measurement !== null,
    detail: measurement ? undefined : 'Run "Measure & compare" — turning it on without measuring is how you end up shipping a regression.',
  });

  const baseline = await loadMeasurement("baseline");
  if (baseline && measurement) {
    const before = baseline.metrics.cleanBuild?.mean;
    const after = measurement.metrics.cleanBuild?.mean;
    const faster = before !== undefined && after !== undefined && after < before;
    checks.push({
      label: "The clean build actually got faster",
      ok: faster,
      detail: faster
        ? undefined
        : "Measure again — the run that fills the cache is slower than no cache at all, so a first measurement can look like a regression.",
    });
  }

  return {
    checks,
    hint: "Enable the setting in Xcode, then run \"Measure & compare\".",
  };
};

export const task02: WorkshopTask = {
  id: 2,
  slug: "reuse-dont-recompute",
  stage: "Stage 03 · The build",
  title: "Reuse, don't recompute",
  summary: "Turn on Xcode's compilation cache, then find out what it really cost.",
  brief,
  actions: [
    {
      id: "compare",
      label: "Measure & compare",
      hint: "Re-runs the benchmarks against your baseline",
      run: measureAndCompare,
    },
    {
      id: "cold",
      label: "What does a cold cache cost?",
      hint: "The number that stops this looking like free money",
      run: measureColdCache,
    },
  ],
  validate,
  solutionBranch: "solutions/02",
};
