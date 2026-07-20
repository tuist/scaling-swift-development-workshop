import { buildEnvGeneratedCached, cleanBuild, coldCacheBuild, labels } from "../commands.js";
import { shell } from "../ui.js";
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

${brand.bold("Caches come in sizes, and this is the small one")}
Xcode's cache works one ${brand.bold("compile job")} at a time: this file, these flags, this
compiler. The next task uses a coarser one that works on whole ${brand.bold("modules")}.

We take the fine one first because it's a single build setting, and because it
does not care what your graph looks like. The coarse one does care — which is why
it comes after the task where you fixed the shape, not before.

${brand.dim("If you want to know how it works before you turn it on, the reveal below")}
${brand.dim("explains it. Knowing why a cache can be wrong is the difference between using")}
${brand.dim("one and trusting one.")}

${brand.bold("Your job")}

  1. Find the setting and turn it on — in the manifest, not in Xcode
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

${brand.dim("Go and look for it first. It is a build setting, it is not hiding, and you")}
${brand.dim("already know where build settings live now. Hint below if you want it.")}`;

const hint = `${brand.bold("The setting")}
${brand.accent("COMPILATION_CACHE_ENABLE_CACHING")}. In Xcode's UI it is ${brand.dim("Enable Compilation Caching")},
and if you had gone looking there you would have found it.

${brand.bold("But you generate your project now.")}
Two tasks ago ${brand.accent("RockyFeed.xcodeproj")} became a build artefact. Type this into Xcode's
Build Settings and the next ${brand.dim("tuist generate")} erases it — silently, and you will
re-measure and wonder why nothing changed. It goes in ${brand.accent("app/Project.swift")}.

${brand.dim("This is the tax generation charges: the UI stops being the source of truth. It")}
${brand.dim("is also the point — a setting in a manifest is reviewable, and a setting somebody")}
${brand.dim("clicked eight months ago is archaeology.")}

${brand.bold("Project-level, not per-target — this matters.")}
Most of your clean build is still Alamofire and Kingfisher, and those arrive as
external package targets, not yours. Put it in the project's ${brand.dim("settings:")} base and
it reaches everything underneath; hang it on one target and you have cached the
small half of the build.

${brand.bold("Measuring it")}
Same clean-build shape as task 4, with ${brand.bold("one")} addition to the ${brand.dim("$BUILD")} command:
${brand.accent("COMPILATION_CACHE_CAS_PATH=.workshop/CompilationCache.noindex")}. That points the
cache at the workshop's own directory rather than Xcode's global one — so it
touches none of your real caches, and so you can throw it away on purpose in a
moment. It did nothing in the earlier tasks (the setting was off), which is why
it wasn't there. Now it matters.

${brand.bold("For the cold number")}, you need a run where the cache is empty ${brand.bold("and")} the products
are gone — which is exactly why the cache lives under ${brand.accent(".workshop/")}: you can
${brand.dim("rm -rf")} it without consequences. The commands do it for you.

${brand.dim("Watch what the first cached build does. It won't be what you expect, and that")}
${brand.dim("surprise is the lesson.")}`;

// See the note in Task 1: no apostrophes in these comments. A stock zsh has
// interactive_comments off, and an apostrophe turns a harmless comment into an
// unmatched quote that eats the commands below it.
const commands = shell(`# Run these from the repo root, one at a time, and watch each one.

# If BUILD is no longer set in this shell:
${buildEnvGeneratedCached}

# 1. Clean build with the cache warm.
#    The --warmup run does double duty here: it fills the cache, so every
#    timed run is reading one rather than writing one.
${cleanBuild(labels.cachedClean)}

# 2. Clean build with the cache cold. Products and cache both gone before
#    each run: a fresh CI runner, or the morning after an Xcode update.
#    One run, because it is the expensive one.
${coldCacheBuild(labels.coldCacheClean)}

# Then: Validate my work, and So what did it cost.`);

const underTheHood = `${brand.bold("It is a CAS: a content-addressed store.")}

Nothing in it is keyed by filename, and nothing by timestamp. Everything is keyed
by a hash of its own content. Ask for a hash, get the bytes — or a miss.

${brand.bold("The key")}
Before compiling a file, the compiler hashes everything that could change the
answer:

  ${brand.dim("·")} the contents of the source file
  ${brand.dim("·")} every flag it was invoked with
  ${brand.dim("·")} the compiler's own version
  ${brand.dim("·")} the interfaces of the modules it imports

That hash is the key. Look it up: a hit means this exact question has been
answered before, so copy the object out and skip the compile entirely. A miss
means compile once, then store the result under that key for next time.

${brand.bold("Why the key is so paranoid")}
Because a cache that returns the wrong answer is far worse than no cache. Change
one flag and it is a different question, so it has to be a different key. Every
input that could alter the output is in the hash — that's the whole contract.

${brand.bold("Why it does not care about your graph")}
It never asks "did Core change?". It only asks "have I compiled exactly this
file, exactly this way, before?". Per-job, not per-module. That's why it works on
a monolith — and also why it can't do the one thing the next task's cache can:
skip a module's compilation ${brand.bold("entirely")}.

${brand.bold("What it costs")}
Thousands of tiny objects, each one a lookup. On a local disk that's free. Across
a network it's thousands of round-trips — which is why the talk calls this cache
${brand.bold("latency-bound")}, while a module cache moving a few large binaries is
${brand.bold("bandwidth-bound")}. Same idea, opposite failure mode.

${brand.dim("Underneath, this is swift-frontend -cache-compile-job with an LLVM CAS at")}
${brand.dim("-cas-path. Xcode drives it for you; the flags are worth knowing about because")}
${brand.dim("they are what you reach for when it misbehaves.")}`;

const validate = async (): Promise<ValidationResult> => {
  const checks: CheckResult[] = [];

  const enabled = await buildSetting(SETTING);
  checks.push({
    label: `${SETTING} resolves to YES`,
    ok: enabled === "YES",
    detail:
      enabled === "YES"
        ? undefined
        : `It's currently ${enabled ?? "unset"}. Add COMPILATION_CACHE_ENABLE_CACHING to the ` +
          `project's settings base in app/Project.swift, then regenerate. Not in Xcode's UI — ` +
          `tuist generate would erase it.`,
  });

  // Task 4's number, not task 1's. By now the project is split, and comparing a
  // cached split against the hand-written monolith would credit this one build
  // setting with the whole day — or blame it, since the split is deliberately
  // slower than where we started. The honest question is what the cache did to
  // the project you have.
  const baseline = await readMeasurement(labels.splitClean);
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
  // splitClean: what this project cost before the cache, not what the day
  // started at. See the note in validate().
  const baseline = await readMeasurement(labels.splitClean);
  const cached = await readMeasurement(labels.cachedClean);
  const cold = await readMeasurement(labels.coldCacheClean);
  const size = await compilationCacheBytes();

  if (!baseline || !cached || !cold) {
    return (
      `${brand.bold("Measure all three first.")}\n\n` +
      `This only means something with task 4's clean build, the warm number and the\n` +
      `cold number side by side. Getting all three is the task.`
    );
  }

  const lines = [
    `${"No cache (task 4)".padEnd(24)} ${formatDuration(baseline.mean)}`,
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

export const task05: WorkshopTask = {
  id: 5,
  slug: "reuse-dont-recompute",
  stage: "The build",
  title: "Reuse, don't recompute",
  summary: "Turn on Xcode's compilation cache, then find out what it really cost.",
  brief,
  reveals: [
    {
      id: "hood",
      label: "How does it actually work?",
      hint: "Content-addressed storage, and why the key is paranoid",
      title: "Under the hood",
      body: underTheHood,
    },
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
      copyable: true,
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
  solutionBranch: "solutions/05",
};
