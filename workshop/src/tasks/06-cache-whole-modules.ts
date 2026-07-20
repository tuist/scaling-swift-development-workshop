import { buildEnvGeneratedCached, cleanBuild, labels, tuistCache, tuistGenerateFocused } from "../commands.js";
import { generatedSchemes, readMeasurement } from "../measure.js";
import { renderComparison } from "../report.js";
import { brand, formatDuration } from "../theme.js";
import { shell } from "../ui.js";
import type { CheckResult, ValidationResult, WorkshopTask } from "./types.js";

const brief = `${brand.bold("Two tasks ago you split the god module. Here is where it pays off.")}

The split sped up your inner loop and cost a little on the clean build — but the
part that matters now is the one you couldn't measure yet: it made your project
${brand.bold("cacheable")}. This is where you spend that.

${brand.bold("The other kind of cache")}
Task 5's cache works one ${brand.bold("compile job")} at a time. This one works on whole
${brand.bold("modules")}: build a module once, store the binary, and next time swap the target for
the binary and don't build it at all.

That only works if your project ${brand.bold("has")} modules. A monolith has one giant one, and
one giant one is the worst possible unit to cache — change any file in it and the
whole thing misses.

${brand.bold("First, a piece of unfinished business.")}
Your dependencies came in as Xcode-native SPM in Task 3, and ${brand.dim("tuist cache")} cannot
see those — Xcode builds them, Tuist never touches them. So before you cache
anything, you move Alamofire and Kingfisher into Tuist's hands. This is the task
${brand.accent("Tuist/Package.swift")} finally exists for.

${brand.bold("Your job")}

  1. Move the deps to ${brand.accent("Tuist/Package.swift")} + ${brand.dim(".external")} so they can be cached
  2. Warm the module cache
  3. Generate with the app ${brand.bold("focused")} — everything else arrives as a binary
  4. Measure the clean build → ${brand.accent(labels.moduleCacheClean)}${brand.dim(".json")}

${brand.bold("Then answer the question the day has been building to.")}
You have measured this project four ways now. Was splitting it worth it?

${brand.dim("tuist is already pinned. The cache is local; no account needed. If you want to")}
${brand.dim("know how it works before you trust it, take the reveal below first.")}`;

const underTheHood = `${brand.bold("Same idea as task 5, one size up.")}

Task 5 hashed a compile job. This hashes a ${brand.bold("target")}: its sources, its build
settings, its platform — and, crucially, ${brand.bold("the hashes of everything it depends on")}.
That last part is the whole story.

  ${brand.dim("hash(CoreModels)      = f(sources, settings)")}
  ${brand.dim("hash(CoreNetworking)  = f(sources, settings, hash(Alamofire))")}
  ${brand.dim("hash(CoreDomain)      = f(sources, settings, hash(CoreModels), hash(CoreNetworking))")}
  ${brand.dim("hash(FeatureFeed)     = f(sources, settings, hash(CoreDomain), ...)")}

Match the hash, fetch an ${brand.dim("xcframework")} and skip the target entirely. Miss, and you
build it and store it.

${brand.bold("Why the dependency hashes matter")}
Because a binary compiled against a different version of its dependency is
worthless — it might not even link. So a module's identity has to include what it
was built against. Which means ${brand.bold("a change flows upwards")}: touch a module and every
module above it gets a new hash, and every one of them misses.

${brand.bold("And that is why the god module was expensive")}
Not because it compiled slowly. Because it was ${brand.bold("one hash")}. Every file in it fed
the same key, so changing any of the 82 invalidated all of them — and everything
downstream. One module, one cache entry, no granularity. The talk's line, exactly:
change Core, and every module is a cache miss.

${brand.bold("Coarse vs fine")}
This cache moves a few large artefacts, so it is ${brand.bold("bandwidth-bound")}: time ≈ bytes ÷
link speed. Task 5's moves thousands of tiny ones, so it is ${brand.bold("latency-bound")}: time ≈
requests × round-trips. Same idea, opposite failure mode — and the reason the talk
says granularity is the whole game.

${brand.dim("The local cache lives in ~/.cache/tuist. Point it at a server and the same")}
${brand.dim("hashes work for your whole team and your CI, which is where it earns its keep.")}`;

const hint = `${brand.bold("First move the dependencies")}
${brand.dim("tuist cache")} caches Tuist targets. Xcode-native SPM packages aren't Tuist targets,
so they'd be left out and rebuilt every time. Two edits fix that:

  ${brand.dim("·")} create ${brand.accent("app/Tuist/Package.swift")} — a plain SwiftPM manifest listing the two packages
  ${brand.dim("·")} in ${brand.accent("Project.swift")}, swap ${brand.dim(".package(product: \"Alamofire\")")} for ${brand.dim(".external(name: \"Alamofire\")")}

then ${brand.accent("tuist install")} to resolve them. Now they are Tuist's, and cacheable.

${brand.bold("Then two commands")}

${brand.accent("tuist cache")} builds every cacheable target and stores it as an xcframework. First
run is slow — it is filling the cache, same lesson as task 5.

${brand.accent("tuist generate RockyFeed")} is the interesting one. Naming a target means ${brand.bold("focus")}
it: keep it as source, and bring everything else in as a prebuilt binary. That is
the point of the whole exercise — you work on the thing you are working on, and
you don't compile the rest of the app to do it.

${brand.bold("Then measure the same clean build as always.")} Same $BUILD, new export path, so
you are comparing like with like.

${brand.dim("Watch what tuist prints when it generates. It lists the targets it is taking")}
${brand.dim("from the cache. Count them.")}`;

const commands = shell(`# Run from the repo root, one at a time.

# 1. Move the dependencies into Tuist's hands so tuist cache can see them.
#    Project.swift swaps .package(product:) for .external(name:), and a new
#    Tuist/Package.swift lists the packages. Take both verbatim from the branch:
mkdir -p app/Tuist
git show solutions/06:app/Project.swift > app/Project.swift
git show solutions/06:app/Tuist/Package.swift > app/Tuist/Package.swift
printf 'app/Tuist/.build/\\n' >> .gitignore

# 2. Resolve them, now that they are Tuist-managed.
cd app && tuist install && cd ..

# 3. Warm the module cache. Slow the first time: it is building every module
#    once and storing it. You have seen this trade before.
${tuistCache}

# 4. Generate with the app focused. Everything else arrives as a binary.
#    Read what it prints: those are the targets it is not going to build.
${tuistGenerateFocused}

# 5. Same clean build as every other task.
${buildEnvGeneratedCached}

${cleanBuild(labels.moduleCacheClean)}

# Then: Validate my work, and Was it worth it.`);

const validate = async (): Promise<ValidationResult> => {
  const checks: CheckResult[] = [];

  const schemes = await generatedSchemes();
  const split = schemes.filter((s) => s.startsWith("Core") || s.startsWith("Feature")).length >= 3;
  checks.push({
    label: "The project still has modules to cache",
    ok: split,
    detail: split ? undefined : "Task 4's split needs to be in place — a monolith has nothing to cache at module granularity.",
  });

  const cached = await readMeasurement(labels.moduleCacheClean);
  checks.push({
    label: "Clean build measured with the module cache warm",
    ok: cached !== null,
    detail: cached
      ? undefined
      : `Nothing readable at .workshop/measurements/${labels.moduleCacheClean}.json yet.`,
  });

  const split_ = await readMeasurement(labels.splitClean);
  if (split_ && cached) {
    const faster = cached.mean < split_.mean;
    checks.push({
      label: "It beats the uncached split",
      ok: faster,
      detail: faster
        ? undefined
        : "Not yet. If that run filled the cache rather than read it, measure once more.",
    });
  }

  const report =
    split_ && cached
      ? renderComparison([{ label: "Clean build", before: split_, after: cached }])
      : undefined;

  return {
    checks,
    ...(report ? { report } : {}),
    hint: "Warm the cache, generate with RockyFeed focused, then measure.",
  };
};

/** The whole day, in four numbers of their own making. */
const wasItWorthIt = async (): Promise<string> => {
  const baseline = await readMeasurement(labels.baselineClean);
  const split = await readMeasurement(labels.splitClean);
  const cached = await readMeasurement(labels.moduleCacheClean);

  if (!baseline || !split || !cached) {
    return (
      `${brand.bold("Not enough numbers yet.")}\n\n` +
      `This needs the monolith from Task 1, the split from Task 4, and the cached\n` +
      `build from this task. The argument only works with all three.`
    );
  }

  const worse = ((split.mean - baseline.mean) / baseline.mean) * 100;
  const better = baseline.mean / cached.mean;

  return `${brand.bold("Your day, in three numbers")}

  ${"Monolith".padEnd(24)} ${formatDuration(baseline.mean)}
  ${"Split, no cache".padEnd(24)} ${formatDuration(split.mean)}   ${brand.dim(`← ${Math.abs(worse) < 15 ? "about the same" : `${worse > 0 ? "+" : ""}${worse.toFixed(0)}%`} on the clean build`)}
  ${"Split + module cache".padEnd(24)} ${brand.success(formatDuration(cached.mean))}   ${brand.dim(`← ${better.toFixed(1)}× the monolith`)}

${brand.bold("So: was splitting it worth it?")}

Task 4 showed the near side of the answer: the split made your ${brand.bold("incremental")} build
faster, and left your ${brand.bold("clean")} build about where it started — a per-module tax too
small to see at this scale. On CI, at task 4, you had not won anything yet.

This is where the other side arrives, and it is not small. What splitting really
bought was ${brand.bold("granularity")}. A monolith is one hash and one cache entry: change any
file and the whole thing misses. Modules are many hashes, so most of them stay
hits, and the app you are focused on is the only thing that compiles.

That is why the clean build just fell off a cliff — and why it could not have,
before you split.

${brand.bold("The split is not the optimisation. The split is what makes the optimisation possible.")}

${brand.dim("This is why the talk puts the god module under \"granularity is the whole game\"")}
${brand.dim("and says every module is a cache miss. It was never a story about cores.")}

${brand.bold("One more thing, and it is the sharp edge.")}
Change something deep — ${brand.accent("CoreNetworking")}, say — and watch what misses. It is not
one module. Every module above it has that hash in ${brand.bold("its")} hash, so the whole stack
above invalidates. On this project a networking change misses ${brand.bold("8")} of 15 targets,
because everything routes through ${brand.accent("CoreDomain")}.

${brand.dim("Which means you have built a smaller god module in the middle of your graph.")}
${brand.dim("Splitting is not the end of the work. The shape decides what a change costs,")}
${brand.dim("and that is the thing worth taking home to your own project.")}`;
};

export const task06: WorkshopTask = {
  id: 6,
  slug: "cache-whole-modules",
  stage: "The build",
  title: "Cache whole modules",
  summary: "Collect on the slowdown you accepted in Task 4.",
  brief,
  reveals: [
    {
      id: "hood",
      label: "How does it actually work?",
      hint: "Target hashing, and why a change flows upwards",
      title: "Under the hood",
      body: underTheHood,
    },
    {
      id: "hint",
      label: "Give me a hint",
      hint: "Two commands, and what focusing means",
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
      id: "worth",
      label: "Was it worth it?",
      hint: "The whole day, in three numbers",
      title: "Was it worth it?",
      body: "",
      resolve: wasItWorthIt,
    },
  ],
  validate,
  solutionBranch: "solutions/06",
};
