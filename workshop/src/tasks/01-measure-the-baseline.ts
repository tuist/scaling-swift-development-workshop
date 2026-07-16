import { buildEnv, cleanBuild, incrementalBuild, labels, resolvePackages } from "../commands.js";
import { readMeasurement } from "../measure.js";
import { renderTable } from "../report.js";
import { brand, formatDuration } from "../theme.js";
import { hasBinary } from "../shell.js";
import type { CheckResult, ValidationResult, WorkshopTask } from "./types.js";

const brief = `${brand.bold("You can't improve what you can't see.")}

Nobody here can yet say what RockyFeed costs. Not "it feels slow" — a number,
with a spread, that you can repeat tomorrow and compare against.

Every change we make today is judged against the numbers you take now.

${brand.bold("Your job")}
Measure two things, and save each one into ${brand.accent(".workshop/measurements/")} so the
runner can read it back:

  ${brand.accent("Clean build")}   ${labels.baselineClean}${brand.dim(".json")}
                ${brand.bold("The number we chase.")} What CI pays on every run.

  ${brand.accent("No-op build")}   ${labels.baselineIncremental}${brand.dim(".json")}
                Built again, changed nothing. Should be free. Find out.

${brand.bold("The tool")}
${brand.accent("hyperfine")} is already installed. Timing a build once tells you almost nothing
— machines are noisy — so it runs a command repeatedly and reports ${brand.dim("mean ± σ")}. It
can also reset state between runs, and export JSON.

${brand.bold("Have a go first.")} ${brand.dim("`hyperfine --help` is a good start. Those two")}
${brand.dim("measurements are not the same shape as each other, and working out why is most")}
${brand.dim("of the lesson. There's a hint below when you want one.")}`;

const hint = `${brand.bold("Three flags do the work.")}

  ${brand.accent("--export-json <path>")}   writes the result where the runner can read it
  ${brand.accent("--prepare '<cmd>'")}      runs before ${brand.bold("each")} timed run, untimed
  ${brand.accent("--warmup <n>")}           untimed runs first, to settle things down

${brand.bold("Now the thinking part.")}

A ${brand.bold("clean build")} must start from nothing every time, so something has to throw the
build products away before each run — but ${brand.bold("only")} the products. Wipe all of
DerivedData and you'd re-resolve the packages too, and measure that instead.

A ${brand.bold("no-op build")} is the opposite. It needs no resetting; it needs the build to be
${brand.bold("already done")} before the clock starts. If the tree is stale when you begin, run 1
measures a real rebuild and the mean is a work of fiction.

${brand.bold("And the rule that catches everyone: the first run of anything is a lie.")}

Not because machines are noisy — because the first run does work the others never
repeat. It resolves the packages. It builds the module cache. It warms the OS file
cache. That cost doesn't average out across runs; it lands entirely in run 1 and
drags the mean somewhere meaningless.

${brand.dim("Measured on this very project: [44.5s, 26.1s, 24.7s]. The honest number is 25s,")}
${brand.dim("the mean says 32s, and σ says none of it is comparable to anything.")}

So: resolve once up front, untimed — resolving and building are separate stages of
the pipeline and deserve separate numbers — and let both benchmarks throw their
first run away.

${brand.dim("The talk's hyperfine slide has the shape of it. Or take the next reveal and")}
${brand.dim("get on with your day.")}`;

const commands = `${brand.dim("Run these from the repo root, in your own terminal.")}

${brand.bold("Set the build command once")} ${brand.dim("— every benchmark today reuses it, which is")}
${brand.dim("what keeps the comparisons honest.")}

${buildEnv}

${brand.bold("1. Resolve the packages first")} ${brand.dim("— once, untimed. Otherwise your first")}
${brand.dim("clean build also clones Alamofire and Kingfisher, and you've measured resolution.")}

${resolvePackages}

${brand.bold("2. Clean build")} ${brand.dim("— wipe the products, keep the resolved packages")}

${cleanBuild(labels.baselineClean)}

${brand.bold("3. No-op build")} ${brand.dim("— warm up first, so every timed run is a real no-op")}

${incrementalBuild(labels.baselineIncremental)}

${brand.dim("Together, a couple of minutes. That wait is not lost time — it's the wait your")}
${brand.dim("team pays all day, and it's why any of this is worth doing.")}

${brand.dim("Then pick \"Validate my work\".")}`;

const validate = async (): Promise<ValidationResult> => {
  const checks: CheckResult[] = [];

  const hyperfineInstalled = await hasBinary("hyperfine");
  checks.push({
    label: "hyperfine is installed",
    ok: hyperfineInstalled,
    detail: hyperfineInstalled ? undefined : "Run `mise install` in the repo root.",
  });

  const clean = await readMeasurement(labels.baselineClean);
  checks.push({
    label: "Clean build measured",
    ok: clean !== null,
    detail: clean
      ? undefined
      : `Nothing readable at .workshop/measurements/${labels.baselineClean}.json yet.`,
  });

  const incremental = await readMeasurement(labels.baselineIncremental);
  checks.push({
    label: "No-op build measured",
    ok: incremental !== null,
    detail: incremental
      ? undefined
      : `Nothing readable at .workshop/measurements/${labels.baselineIncremental}.json yet.`,
  });

  // Catch the ways this comes out wrong. A wrong baseline is worse than no
  // baseline: everything else today is measured against it, so a number that
  // looks plausible and isn't will quietly poison the whole day.
  if (clean) {
    // Threshold picked from real runs, not taste. A first run that resolved the
    // packages gave σ = 54% of the mean; one that was merely cold gave 35%; a
    // properly warmed-up run sits in single digits. 25% sits clear of honest
    // noise on a busy laptop and still catches both mistakes — and a check that
    // fails good work would be worse than no check at all.
    const noisy = clean.runs > 1 && clean.stddev > clean.mean * 0.25;
    checks.push({
      label: "The clean build measurement is steady",
      ok: !noisy,
      detail: noisy
        ? `σ of ${formatDuration(clean.stddev)} on a ${formatDuration(clean.mean)} mean — the runs ` +
          `disagree too much to compare anything against.\n  Usually run 1 did work the others ` +
          `didn't: resolved the packages, or warmed a cold module cache. Resolve first, add ` +
          `--warmup 1, and measure again. (Or your machine is busy — close things.)`
        : undefined,
    });
  }

  if (clean && incremental) {
    const looksLikeACleanBuild = clean.mean > incremental.mean;
    checks.push({
      label: "The clean build costs more than the no-op",
      ok: looksLikeACleanBuild,
      detail: looksLikeACleanBuild
        ? undefined
        : "Suspicious — a clean build should cost more than doing nothing. Did --prepare " +
          "actually remove the build products?",
    });

    const steady = incremental.runs < 2 || incremental.stddev < incremental.mean;
    checks.push({
      label: "The no-op measurement is steady",
      ok: steady,
      detail: steady
        ? undefined
        : `σ of ${formatDuration(incremental.stddev)} on a ${formatDuration(incremental.mean)} mean ` +
          "means the runs disagree wildly. The usual cause is a missing --warmup: run 1 rebuilt " +
          "something, the rest didn't.",
    });
  }

  const report =
    clean || incremental
      ? renderTable([
          { label: "Clean build", stat: clean },
          { label: "No-op build", stat: incremental },
        ])
      : undefined;

  return {
    checks,
    ...(report ? { report } : {}),
    hint: "Take the hint below for a nudge, or the commands if you'd rather move on.",
  };
};

export const task01: WorkshopTask = {
  id: 1,
  slug: "measure-the-baseline",
  stage: "Step zero",
  title: "Measure the baseline",
  summary: "Get reproducible numbers before you change anything.",
  brief,
  reveals: [
    {
      id: "hint",
      label: "Give me a hint",
      hint: "Which flags, and why the two differ",
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
  ],
  validate,
  solutionBranch: "solutions/01",
  stuckNote:
    `There's no branch to check out for this one, and that's on purpose.\n\n` +
    `A baseline measures ${brand.bold("your")} machine. A number committed to git would be\n` +
    `someone else's laptop on some other day, and every comparison you made against\n` +
    `it for the rest of today would be fiction.\n\n` +
    `${brand.bold("If it won't run:")}\n\n` +
    `  ${brand.dim("hyperfine not found")}   → ${brand.accent("mise install")}\n` +
    `  ${brand.dim("xcodebuild fails")}      → open ${brand.accent("app/RockyFeed.xcodeproj")} and build once by hand;\n` +
    `                        Xcode explains itself better than we can\n` +
    `  ${brand.dim("no iOS simulator")}      → Xcode › Settings › Components\n\n` +
    `${brand.dim("Ask. Everything today is measured against this one step.")}`,
};
