import { buildEnv, cleanBuild, coldCacheBuild, labels } from "../commands.js";
import { buildSetting, compilationCacheBytes, readMeasurement } from "../measure.js";
import { renderComparison } from "../report.js";
import { brand, formatDuration } from "../theme.js";
import type { CheckResult, ValidationResult, WorkshopTask } from "./types.js";

const SETTING = "COMPILATION_CACHE_ENABLE_CACHING";

const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return "nothing yet";
  const mb = bytes / 1024 ** 2;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
};

const brief = `${brand.bold("Same inputs, same output. Fetch it instead of building it.")}

Your clean build compiles every file from scratch, every time — including
Alamofire and Kingfisher, which haven't changed since the day you added them.
None of that work is new. It's just unremembered.

Xcode 26 can remember it. It hashes the inputs of each compile job and stores the
result in a content-addressed store, so the same inputs fetch an object instead of
compiling one. It's off by default.

${brand.bold("Why this lever first")}
There's a coarser cache that works on whole modules — Bazel, Tuist. Powerful, but
it only pays off when your dependency graph is a good shape, and RockyFeed's isn't
yet. Xcode's cache works one compile job at a time, so it doesn't care how badly
modularised you are. Which, today, you are.

${brand.bold("Your job")}

  1. Find the setting in Xcode and turn it on
  2. Re-measure the clean build → ${brand.accent(labels.cachedClean)}${brand.dim(".json")}
  3. Then measure it with the cache thrown away → ${brand.accent(labels.coldCacheClean)}${brand.dim(".json")}

${brand.bold("Step 3 is not optional, and it is the point.")}
A warm cache is the build you have all day. A cold one is the first build, a fresh
CI runner, the morning after an Xcode update — and filling a cache is not the same
work as reading one.

So: what does a cold cache cost, compared to having no cache at all? Don't guess,
and don't take our word for it. It's your machine, and the answer is one command
away.

${brand.dim("Before you tell your team to turn this on, you want to be able to say what it")}
${brand.dim("costs as well as what it saves. There's exactly one way to know that.")}

${brand.dim("Go and look in Xcode's build settings first. Search is your friend and the")}
${brand.dim("setting isn't hiding. Hint below if you want it.")}`;

const hint = `${brand.bold("Finding it")}
Open ${brand.accent("app/RockyFeed.xcodeproj")}, select the ${brand.accent("RockyFeed")} project — the blue icon at
the top, ${brand.bold("not")} the target underneath — then ${brand.accent("Build Settings")} and search for
${brand.accent("compilation cache")}.

${brand.bold("Project, not target — this matters.")}
Most of your clean build is Alamofire and Kingfisher, and those are package
targets, not yours. Set it on the target and you've cached the small half of the
build. Set it on the project and it reaches everything underneath.

${brand.bold("Measuring it")}
Same ${brand.dim("$BUILD")} command as Task 1, same clean-build shape — only the export path
changes, so you're comparing like with like.

${brand.bold("For the cold number")}, you need a run where the cache is empty ${brand.bold("and")} the products
are gone. The workshop keeps its cache at ${brand.accent(".workshop/CompilationCache.noindex")}
instead of your global Xcode caches, precisely so you can throw it away without
consequences.

${brand.dim("Watch what the first cached build does. It won't be what you expect, and that")}
${brand.dim("surprise is the lesson.")}`;

const commands = `${brand.bold("If $BUILD isn't set in this shell any more:")}

${buildEnv}

${brand.bold("1. Clean build, cache warm")} ${brand.dim("— run this twice. The first fills the cache,")}
${brand.dim("the second reads it. Only the second is the number you want.")}

${cleanBuild(labels.cachedClean)}

${brand.bold("2. Clean build, cache cold")} ${brand.dim("— products and cache both gone")}

${coldCacheBuild(labels.coldCacheClean)}

${brand.dim("Then \"Validate my work\".")}`;

const validate = async (): Promise<ValidationResult> => {
  const checks: CheckResult[] = [];

  const enabled = await buildSetting(SETTING);
  checks.push({
    label: `${SETTING} resolves to YES`,
    ok: enabled === "YES",
    detail:
      enabled === "YES"
        ? undefined
        : `It's currently ${enabled ?? "unset"}. Turn on "Enable Compilation Caching" on the ` +
          `RockyFeed project — the blue icon, not the target.`,
  });

  const baseline = await readMeasurement(labels.baselineClean);
  const cached = await readMeasurement(labels.cachedClean);
  const cold = await readMeasurement(labels.coldCacheClean);

  checks.push({
    label: "Clean build re-measured with the cache on",
    ok: cached !== null,
    detail: cached
      ? undefined
      : `Nothing readable at .workshop/measurements/${labels.cachedClean}.json yet.`,
  });

  checks.push({
    label: "Cold-cache clean build measured",
    ok: cold !== null,
    detail: cold
      ? undefined
      : `Nothing readable at .workshop/measurements/${labels.coldCacheClean}.json yet. ` +
        `That's the number telling you what the cache costs — don't skip it.`,
  });

  if (baseline && cached) {
    const faster = cached.mean < baseline.mean;
    checks.push({
      label: "The cached clean build beats the baseline",
      ok: faster,
      detail: faster
        ? undefined
        : "Not yet. If that was the run which filled the cache, it was writing rather than " +
          "reading — measure once more and it should drop.",
    });
  }

  const report =
    baseline && cached
      ? renderComparison([{ label: "Clean build", before: baseline, after: cached }])
      : undefined;

  return {
    checks,
    ...(report ? { report } : {}),
    hint: "Turn the setting on in Xcode, then measure both numbers.",
  };
};

/** Reads back their three numbers. Still only reading — never measuring. */
const verdict = async (): Promise<string> => {
  const baseline = await readMeasurement(labels.baselineClean);
  const cached = await readMeasurement(labels.cachedClean);
  const cold = await readMeasurement(labels.coldCacheClean);
  const size = await compilationCacheBytes();

  if (!baseline || !cached || !cold) {
    return (
      `${brand.bold("Measure all three first.")}\n\n` +
      `This only means something with the baseline from Task 1, the warm number and\n` +
      `the cold number side by side. Getting all three is the task.`
    );
  }

  const lines = [
    `${"No cache at all".padEnd(24)} ${formatDuration(baseline.mean)}`,
    `${"Cache cold".padEnd(24)} ${brand.error(formatDuration(cold.mean))}   ${brand.dim("← filling it")}`,
    `${"Cache warm".padEnd(24)} ${brand.success(formatDuration(cached.mean))}   ${brand.dim("← reading it")}`,
    ``,
    `${"On disk".padEnd(24)} ${formatBytes(size)}`,
  ];

  const speedup = (baseline.mean / cached.mean).toFixed(1);
  let reading = `Warm, you're ${brand.bold(`${speedup}×`)} faster, from one build setting.`;

  if (cold.mean > baseline.mean) {
    reading +=
      `\n\nCold, you're ${brand.bold(formatDuration(cold.mean - baseline.mean))} ${brand.bold("slower")} than having no cache at all.\n\n` +
      `${brand.bold("Both are true at once, and that's the finding.")}\n` +
      `"We added a cache" and "we got faster" are different claims. A CI job that\n` +
      `never restores the cache has been made worse by this change, on every run.\n` +
      `Watch the hit rate, not whether a cache exists.\n\n` +
      `${brand.dim("This is the p99 bar in the talk, and the slide about optimizations that")}\n` +
      `${brand.dim("backfire — except now it's your number, off your machine.")}`;
  }

  return `${lines.join("\n")}\n\n${reading}`;
};

export const task02: WorkshopTask = {
  id: 2,
  slug: "reuse-dont-recompute",
  stage: "Stage 03 · The build",
  title: "Reuse, don't recompute",
  summary: "Turn on Xcode's compilation cache, then find out what it really cost.",
  brief,
  reveals: [
    {
      id: "hint",
      label: "Give me a hint",
      hint: "Where it lives, and why it matters where you set it",
      title: "Hint",
      body: hint,
    },
    {
      id: "commands",
      label: "Show me the commands",
      hint: "The full answer, copy-pasteable",
      title: "The commands",
      body: commands,
    },
    {
      id: "verdict",
      label: "So what did it cost?",
      hint: "Read your three numbers together",
      title: "What the cache actually costs",
      body: "",
      resolve: verdict,
    },
  ],
  validate,
  solutionBranch: "solutions/02",
};
