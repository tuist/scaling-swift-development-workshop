import { brand } from "../theme.js";
import { shell } from "../ui.js";
import type { CheckResult, ValidationResult, WorkshopTask } from "./types.js";

const SCRIPT = "app/Scripts/stamp-build-info.sh";

const brief = `${brand.bold("Build the same source twice. Do you get the same app?")}

Every cache you turned on today rests on one sentence: ${brand.bold("same inputs, same output.")}
Task 5 hashed compile jobs on it. Task 6 hashed modules on it. Task 7 skipped
tests on it.

There is a build phase in this project called ${brand.accent("Stamp build info")}. It has been there
since Task 1, running on every single build, including the no-op ones you have
been timing all day.

${brand.bold("Your job")}

  1. Build twice, changing nothing. Compare the two apps ${brand.bold("byte for byte")}
  2. Work out why they differ
  3. Fix it, and make the phase stop running when it has nothing to do

${brand.bold("Before you look:")} your no-op build is about ${brand.accent("2s")}. Nothing changed, nothing
compiled. Ask yourself what those two seconds are for.

${brand.dim("This is the last thing standing between you and a build you can trust. It is")}
${brand.dim("forty lines of bash, and it commits four separate sins.")}`;

const hint = `${brand.bold("Find the difference first")}
Build twice into different DerivedData paths, then diff the app bundles. One file
will not match. Open it.

${brand.bold("The four sins, in")} ${brand.accent(SCRIPT)}

  ${brand.error("1.")} ${brand.bold("No declared inputs or outputs.")} Xcode cannot reason about a phase that
     will not say what it reads or writes, so it runs it ${brand.bold("every build")}. That is
     most of your 2s no-op.

  ${brand.error("2.")} ${brand.bold("It shells out to git.")} The repository is an input the build system
     cannot see. Your build output depends on state Xcode was never told about.

  ${brand.error("3.")} ${brand.bold("It writes into BUILT_PRODUCTS_DIR")} without declaring it, so the output is
     invisible to dependency tracking. Nothing downstream knows it happened.

  ${brand.error("4.")} ${brand.bold("It embeds a timestamp.")} Two builds of identical source produce different
     bundles, forever, by design.

${brand.bold("Why sin 4 is the one that matters")}
A timestamp makes your build ${brand.bold("non-reproducible")}. Same inputs, different output —
the exact sentence every cache you turned on today depends on. A phase like this
one is why teams turn on a cache, measure no improvement, and conclude caching
does not work for iOS.

${brand.bold("The fix")}
Declare ${brand.dim("inputFileListPaths")} / ${brand.dim("outputFileListPaths")} (or ${brand.dim("inputPaths")} / ${brand.dim("outputPaths")}) so
Xcode can skip the phase when its inputs have not moved. In a Tuist manifest that
is ${brand.dim("inputPaths:")} and ${brand.dim("outputPaths:")} on the script, and dropping
${brand.dim("basedOnDependencyAnalysis: false")} — which is currently there, explicitly telling
Xcode not to bother thinking.

And take the timestamp out. If you want to know when a build happened, ask the
thing that scheduled it. The commit is already an honest input; ${brand.dim("date")} never was.

${brand.dim("You cannot make a phase hermetic and keep a clock in it. Pick one.")}`;

const commands = shell(`# Run from the repo root, one at a time.

# 1. Build the same source twice, into two places.
cd app
xcodebuild build -workspace RockyFeed.xcworkspace -scheme RockyFeed \\
  -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/build-a -quiet
xcodebuild build -workspace RockyFeed.xcworkspace -scheme RockyFeed \\
  -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/build-b -quiet
cd ..

# 2. Are they the same app?
diff -r /tmp/build-a/Build/Products/Debug-iphonesimulator/RockyFeed.app \\
        /tmp/build-b/Build/Products/Debug-iphonesimulator/RockyFeed.app

# 3. Look at what differs.
diff /tmp/build-a/Build/Products/Debug-iphonesimulator/RockyFeed.app/BuildInfo.plist \\
     /tmp/build-b/Build/Products/Debug-iphonesimulator/RockyFeed.app/BuildInfo.plist

# 4. Now open the culprit and fix it.
#    - take the timestamp out
#    - declare what it reads and writes, in app/Project.swift
#    - stop telling Xcode not to think (basedOnDependencyAnalysis: false)
#
#    ${SCRIPT}
#    app/Project.swift

# 5. Prove it: regenerate, build twice more, diff again. Silence is the pass.
cd app && tuist generate --no-open && cd ..

# Then: Validate my work.`);

const validate = async (): Promise<ValidationResult> => {
  const checks: CheckResult[] = [];
  const fs = await import("node:fs/promises");

  const read = async (path: string): Promise<string> => {
    try {
      return await fs.readFile(path, "utf8");
    } catch {
      return "";
    }
  };

  const script = await read(SCRIPT);
  const manifest = await read("app/Project.swift");

  // The timestamp is the sin that breaks reproducibility, so check the source
  // rather than the symptom — two builds a second apart could match by luck.
  const noClock =
    script.length > 0 && !/\bdate\b/.test(script) && !/BUILT_AT|builtAt/.test(script);
  checks.push({
    label: "The timestamp is gone from the script",
    ok: noClock,
    detail: noClock
      ? undefined
      : `${SCRIPT} still stamps a clock reading into the bundle. Same source, different ` +
        `output — which is the one thing every cache you turned on today cannot survive.`,
  });

  const declaresInputs = /inputPaths|inputFileListPaths/.test(manifest);
  checks.push({
    label: "The phase declares its inputs",
    ok: declaresInputs,
    detail: declaresInputs
      ? undefined
      : "app/Project.swift doesn't give the script inputPaths. Without them Xcode can't tell " +
        "whether the phase needs to run, so it runs it every time.",
  });

  const declaresOutputs = /outputPaths|outputFileListPaths/.test(manifest);
  checks.push({
    label: "...and its outputs",
    ok: declaresOutputs,
    detail: declaresOutputs
      ? undefined
      : "No outputPaths either. Xcode can't skip a phase when it doesn't know what the phase " +
        "was supposed to produce.",
  });

  const thinksAgain = manifest.length > 0 && !/basedOnDependencyAnalysis: false/.test(manifest);
  checks.push({
    label: "Dependency analysis is back on",
    ok: thinksAgain,
    detail: thinksAgain
      ? undefined
      : "basedOnDependencyAnalysis: false is still there, which explicitly tells Xcode not to " +
        "reason about the phase. Declaring inputs and outputs achieves nothing while it stays.",
  });

  return {
    checks,
    hint: "Build twice, diff the bundles, then make the phase honest.",
  };
};

export const task08: WorkshopTask = {
  id: 8,
  slug: "the-build-that-lies",
  stage: "Stage 05 · Trust",
  title: "The build that lies",
  summary: "Two builds of identical source produce different apps. Find out why.",
  brief,
  reveals: [
    {
      id: "hint",
      label: "Give me a hint",
      hint: "Four sins, and which one actually matters",
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
  ],
  validate,
  solutionBranch: "solutions/08",
};
