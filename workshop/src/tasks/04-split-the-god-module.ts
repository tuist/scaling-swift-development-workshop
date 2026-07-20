import { buildEnvGenerated, cleanBuild, incrementalBuild, labels } from "../commands.js";
import { generatedSchemes, readMeasurement } from "../measure.js";
import { renderComparison } from "../report.js";
import { brand, formatDuration } from "../theme.js";
import { shell } from "../ui.js";
import type { CheckResult, ValidationResult, WorkshopTask } from "./types.js";

const brief = `${brand.bold("Now change what the project says.")}

Two tasks ago you found the problem: ${brand.bold("2")} of Core's ${brand.bold("82")} files import Alamofire or
Kingfisher, and the other ${brand.bold("80")} wait for them anyway. Sixty of those are design-system
components that import nothing but SwiftUI.

Last task you moved the answer to "what modules exist" out of a pbxproj and into
Swift. So now it's a manifest edit.

${brand.bold("Your job")}
Split ${brand.accent("Core")} into modules so that ${brand.bold("nothing waits for something it does not use.")}

Then measure both again — the clean build and the incremental one (edit one file,
rebuild), the same two you took in Task 1:

  ${brand.accent(labels.splitClean)}${brand.dim(".json")}
  ${brand.accent(labels.splitIncremental)}${brand.dim(".json")}

${brand.bold("Fair warning: this is a trade, not a win — and you will see both sides.")}
Your ${brand.bold("clean build gets slower")}, about half again: there are a dozen modules to link,
sign and embed now where there were two, and no parallelism in return (Task 2
already showed the cores were never the ceiling).

But your ${brand.bold("incremental build gets faster")}: touch one file and you relink a three-file
app, not a ninety-file monolith. That is the loop you live in all day.

${brand.dim("So modularization is not free and it is not magic. It spends clean-build time to")}
${brand.dim("buy inner-loop time — and it buys one more thing you cannot see yet, granularity,")}
${brand.dim("which Task 6 spends to win the clean build back too. Measure it anyway: a task")}
${brand.dim("that only ever shows you wins is a sales pitch, not a workshop.")}

${brand.bold("Do this bit yourself before taking the hint.")} Open Core, look at what is actually
in it, and sketch the layers on paper. There is one file in there that will fight
you, and finding it is the most useful ten minutes of the day.

${brand.dim("The shape you want is the one from the talk: features on top, services under")}
${brand.dim("them, foundations at the bottom, and no arrows inside a layer.")}`;

const hint = `${brand.bold("The rule")}
A module may not depend on something it does not use. That's it. Every gain here
follows from applying it honestly.

${brand.bold("What's actually in Core")}

  ${brand.dim("Models, Formatting, Fixtures")}     Foundation only
  ${brand.dim("DesignSystem, Components")}         SwiftUI only — 61 files, the bulk of it
  ${brand.dim("Networking")}                       Alamofire
  ${brand.dim("Images")}                           Kingfisher
  ${brand.dim("Session, Storage, Feed, Ranking")}  the app's actual logic
  ${brand.dim("Services")}                         12 files, storage only

${brand.bold("The file that fights you")}
${brand.accent("RemoteImage.swift")} imports Kingfisher ${brand.bold("and")} calls ${brand.dim("Theme.color(...)")}. Put it in the
design system and the design system needs Kingfisher — so all 61 files go back to
waiting on an image library, and you have rebuilt the problem in miniature.

Give it its own module. This is not a trick question; it's the ordinary shape of
this problem. Somewhere in every codebase there's one file gluing two layers
together and quietly costing everyone a minute a build.

${brand.bold("A layering that works")}

  ${brand.accent("CoreModels")}         Models, Formatting, Fixtures    → nothing
  ${brand.accent("CoreDesignSystem")}   DesignSystem, Components        → nothing
  ${brand.accent("CoreNetworking")}     Networking                      → Alamofire
  ${brand.accent("CoreImages")}         Images                          → Kingfisher, CoreDesignSystem
  ${brand.accent("CoreDomain")}         Session, Storage, Feed, Ranking → CoreModels, CoreNetworking

${brand.accent("CoreModels")} and ${brand.accent("CoreDesignSystem")} depend on nothing, so they start ${brand.bold("immediately")} —
alongside Alamofire and Kingfisher instead of behind them. That's 61 files off the
critical path.

${brand.bold("⚠️ Do not call that last one CoreServices.")}
It is the obvious name, and it detonates. ${brand.accent("CoreServices")} is an Apple system
framework, and Kingfisher and Alamofire both import ${brand.dim("MobileCoreServices")}, whose
umbrella header includes ${brand.dim("<CoreServices/CoreServices.h>")}. Name a module CoreServices
and Clang resolves that include to ${brand.bold("yours")}, then fails to build a system module with
an error that mentions neither your module nor your code:

  ${brand.error("MobileCoreServices.h: fatal error: 'CoreServices/CoreServices.h' file not found")}

${brand.dim("Cost us twelve errors and a confused twenty minutes. A monolith cannot make")}
${brand.dim("this mistake, because it only has one name. The moment you start naming")}
${brand.dim("modules, you are in Apple's namespace with them.")}

${brand.bold("You don't have to move any files")}
Tuist's ${brand.dim("sources:")} takes globs, so a module boundary is a manifest decision. Point
each target at the directories it owns. (You'd tidy the folder layout eventually —
but not while you're trying to measure one thing at a time.)

${brand.bold("The imports change")}
${brand.dim("import Core")} stops existing. Every file that used it needs the modules it actually
uses. The commands reveal has a sed for the app; four files inside Core need a
line each.`;

const commands = shell(`# Run from the repo root, one at a time.

# 1. The split manifest. Take it verbatim — the layering is the lesson,
#    and typing five .target(...) blocks is not.
git show solutions/04:app/Project.swift > app/Project.swift

# 2. import Core no longer exists. The app files need the real modules.
#    Crude, and honest: you would tidy these per-file eventually.
grep -rl '^import Core$' app/RockyFeed | while read -r f; do
  perl -i -pe 's/^import Core$/import CoreDesignSystem\\nimport CoreImages\\nimport CoreModels\\nimport CoreDomain/' "$f"
done

# 3. Four files inside Core now cross a module boundary.
perl -i -pe 's/^import SwiftUI$/import CoreDesignSystem\\nimport SwiftUI/' \\
  app/Core/Sources/Core/Images/RemoteImage.swift
perl -i -pe 's/^import Foundation$/import CoreModels\\nimport Foundation/' \\
  app/Core/Sources/Core/Session/UserSession.swift \\
  app/Core/Sources/Core/Ranking/RelevanceScoring.swift
perl -i -pe 's/^import Foundation$/import CoreModels\\nimport CoreNetworking\\nimport Foundation/' \\
  app/Core/Sources/Core/Feed/FeedService.swift

# 4. Regenerate.
cd app && tuist generate --no-open && cd ..

# 5. Measure both, the same two shapes as Task 1, new export paths.
${buildEnvGenerated}

# Clean build — expect this to be SLOWER than Task 1.
${cleanBuild(labels.splitClean)}

# Incremental build — expect this to be FASTER than Task 1.
${incrementalBuild(labels.splitIncremental)}

# Then: Validate my work, and What did it cost.`);

const EXPECTED_MODULES = ["CoreDesignSystem", "CoreModels", "CoreNetworking", "CoreDomain", "CoreImages"];

const validate = async (): Promise<ValidationResult> => {
  const checks: CheckResult[] = [];

  // Ask the generated workspace what exists, rather than grepping the manifest —
  // this is true no matter how someone wrote their Swift.
  const schemes = await generatedSchemes();
  const found = EXPECTED_MODULES.filter((m) => schemes.includes(m));
  const splitUp = found.length >= 3;
  checks.push({
    label: "Core is no longer one module",
    ok: splitUp,
    detail: splitUp
      ? undefined
      : schemes.length === 0
        ? "Couldn't read the workspace. Have you run `tuist generate` from app/?"
        : `Found ${found.length} of the expected Core modules (${schemes.filter((s) => s.startsWith("Core")).join(", ") || "none"}). ` +
          `Names don't have to match ours, but if Core is still one target nothing has changed.`,
  });

  const monolithGone = !schemes.includes("Core");
  checks.push({
    label: "...and the old Core target is gone",
    ok: monolithGone,
    detail: monolithGone
      ? undefined
      : "A target called Core still exists. If you kept it as an umbrella that re-exports the " +
        "others, everything still depends on everything and you've kept the problem with extra steps.",
  });

  const clean = await readMeasurement(labels.splitClean);
  const incremental = await readMeasurement(labels.splitIncremental);
  checks.push({
    label: "Clean build re-measured",
    ok: clean !== null,
    detail: clean ? undefined : `Nothing readable at .workshop/measurements/${labels.splitClean}.json yet.`,
  });
  checks.push({
    label: "Incremental build re-measured",
    ok: incremental !== null,
    detail: incremental
      ? undefined
      : `Nothing readable at .workshop/measurements/${labels.splitIncremental}.json yet — ` +
        `without it you only see one side of the trade.`,
  });

  const beforeClean = await readMeasurement(labels.baselineClean);
  const beforeIncr = await readMeasurement(labels.baselineIncremental);
  const rows = [];
  if (beforeClean && clean) rows.push({ label: "Clean build", before: beforeClean, after: clean });
  if (beforeIncr && incremental) rows.push({ label: "Incremental", before: beforeIncr, after: incremental });
  const report = rows.length ? renderComparison(rows) : undefined;

  return {
    checks,
    ...(report ? { report } : {}),
    hint: "Split the manifest, fix the imports, regenerate, measure both.",
  };
};

const pct = (before: number, after: number): string => {
  const delta = (after / before - 1) * 100;
  const text = `${delta > 0 ? "+" : ""}${delta.toFixed(0)}%`;
  return delta > 0 ? brand.error(text) : brand.success(text);
};

/** The two sides of the trade, read back together. */
const didItWork = async (): Promise<string> => {
  const oldClean = await readMeasurement(labels.baselineClean);
  const oldIncr = await readMeasurement(labels.baselineIncremental);
  const newClean = await readMeasurement(labels.splitClean);
  const newIncr = await readMeasurement(labels.splitIncremental);

  if (!oldClean || !oldIncr || !newClean || !newIncr) {
    return (
      `${brand.bold("Not enough numbers yet.")}\n\n` +
      `This needs Task 1's clean and incremental builds, and both of this task's\n` +
      `measurements. The comparison — two numbers moving opposite ways — is the point.`
    );
  }

  const lines = [
    `${"".padEnd(16)}${"before".padStart(9)}${"after".padStart(11)}${"".padStart(3)}`,
    `${"Clean build".padEnd(16)}${formatDuration(oldClean.mean).padStart(9)}${formatDuration(newClean.mean).padStart(11)}   ${pct(oldClean.mean, newClean.mean)}`,
    `${"Incremental".padEnd(16)}${formatDuration(oldIncr.mean).padStart(9)}${formatDuration(newIncr.mean).padStart(11)}   ${pct(oldIncr.mean, newIncr.mean)}`,
  ];

  const asExpected = newClean.mean > oldClean.mean && newIncr.mean < oldIncr.mean;

  const verdict = asExpected
    ? `${brand.bold("Two numbers, opposite directions. That is the trade.")}\n\n` +
      `The ${brand.bold("clean build got slower")} — a dozen modules to link, sign and embed where\n` +
      `there were two, and no parallelism in return, because Xcode already compiled the\n` +
      `files inside each target at the same time. (That is Task 2's point, paid in full:\n` +
      `the graph was never the ceiling.)\n\n` +
      `The ${brand.bold("incremental build got faster")} — touch one file and you relink a three-file\n` +
      `app instead of a ninety-file one. That is the loop you live in all day, and the\n` +
      `split just shortened it.\n\n` +
      `${brand.bold("Modularization is a trade, not a win:")} clean-build time for inner-loop time. And\n` +
      `it buys one thing you cannot see yet — ${brand.bold("granularity")} — which Task 6 spends to win\n` +
      `the clean build back too. You are not done. You are set up.`
    : `${brand.bold("Your numbers moved differently to ours.")} We saw the clean build get about half\n` +
      `again slower and the incremental build get faster — two numbers, opposite ways.\n` +
      `If yours both moved the same direction, re-measure on a settled machine: this\n` +
      `trade only shows cleanly when nothing else is fighting for the cores.`;

  return `${lines.join("\n")}\n\n${verdict}`;
};

export const task04: WorkshopTask = {
  id: 4,
  slug: "split-the-god-module",
  stage: "Stage 03 · The build",
  title: "Split the god module",
  summary: "A trade: slower clean build, faster inner loop. Collect in Task 6.",
  brief,
  reveals: [
    {
      id: "hint",
      label: "Give me a hint",
      hint: "The rule, the layering, and the file that fights you",
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
      label: "What did it cost?",
      hint: "Two numbers, opposite directions",
      title: "What did it cost?",
      body: "",
      resolve: didItWork,
    },
  ],
  validate,
  solutionBranch: "solutions/04",
};
