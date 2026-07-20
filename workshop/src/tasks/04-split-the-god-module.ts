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

${brand.bold("Fair warning: this is a trade, not a free win.")}
Your ${brand.bold("incremental build gets faster")} — touch one file and you relink a three-file
app, not a ninety-file monolith. That is the loop you live in all day, and it is
the reliable win here.

Your ${brand.bold("clean build")} carries a cost you should understand even though you may barely
see it: a dozen modules now have to be linked, signed and embedded where two did,
and you get no parallelism in return (Task 2 showed the cores were never the
ceiling). On a codebase RockyFeed's size that overhead is small enough to hide in
the measurement noise — your clean build may come out flat, up a little, or even
down. ${brand.bold("The cost is real; it just scales with the graph, and this graph is small.")}
On a real app, with real modules, you would feel it.

${brand.dim("So modularization is not free and it is not magic. You pay a per-module tax on")}
${brand.dim("the clean build — invisible at this scale, real at a larger one — and you buy a")}
${brand.dim("faster inner loop plus the thing you cannot see yet: granularity, which Task 6")}
${brand.dim("spends to make the clean build fall off a cliff. Measure it anyway: a task that")}
${brand.dim("only ever shows you wins is a sales pitch, not a workshop.")}

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

const commands = shell(`# Run from app/, one at a time.

# 1. The split manifest. Take it verbatim — the layering is the lesson,
#    and typing five .target(...) blocks is not.
git show solutions/04:app/Project.swift > Project.swift

# 2. import Core no longer exists. The app files need the real modules.
#    Crude, and honest: you would tidy these per-file eventually.
grep -rl '^import Core$' RockyFeed | while read -r f; do
  perl -i -pe 's/^import Core$/import CoreDesignSystem\\nimport CoreImages\\nimport CoreModels\\nimport CoreDomain/' "$f"
done

# 3. Four files inside Core now cross a module boundary.
perl -i -pe 's/^import SwiftUI$/import CoreDesignSystem\\nimport SwiftUI/' \\
  Core/Sources/Core/Images/RemoteImage.swift
perl -i -pe 's/^import Foundation$/import CoreModels\\nimport Foundation/' \\
  Core/Sources/Core/Session/UserSession.swift \\
  Core/Sources/Core/Ranking/RelevanceScoring.swift
perl -i -pe 's/^import Foundation$/import CoreModels\\nimport CoreNetworking\\nimport Foundation/' \\
  Core/Sources/Core/Feed/FeedService.swift

# 4. Regenerate.
tuist generate --no-open

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

  const incrFaster = newIncr.mean < oldIncr.mean;
  const cleanDelta = (newClean.mean / oldClean.mean - 1) * 100;

  const cleanReading =
    Math.abs(cleanDelta) < 15
      ? `Your ${brand.bold("clean build barely moved")} (${pct(oldClean.mean, newClean.mean)}), and that is the honest result at\n` +
        `this scale. Splitting adds a per-module tax — a dozen frameworks to link, sign\n` +
        `and embed — but on a codebase this small that cost is about the size of the\n` +
        `measurement noise, so it hides. It is real; it just scales with the graph, and\n` +
        `this graph is tiny. On a real app you would see it clearly.`
      : cleanDelta >= 15
        ? `Your ${brand.bold("clean build got slower")} (${pct(oldClean.mean, newClean.mean)}) — the per-module tax showing through:\n` +
          `a dozen frameworks to link, sign and embed where there were two, and no\n` +
          `parallelism in return. That is the cost side of the trade, and it scales with\n` +
          `the graph.`
        : `Your ${brand.bold("clean build came out faster")} (${pct(oldClean.mean, newClean.mean)}), which at this scale is noise, not a\n` +
          `real win — the per-module link/sign/embed cost is smaller than the spread here.\n` +
          `Do not bank it. The cost is real on a larger graph.`;

  const verdict = incrFaster
    ? `${brand.bold("The reliable win: your incremental build got faster")} (${pct(oldIncr.mean, newIncr.mean)}). Touch one\n` +
      `file and you relink a three-file app, not a ninety-file monolith. That is the\n` +
      `loop you live in all day, and the split just shortened it.\n\n` +
      `${cleanReading}\n\n` +
      `${brand.bold("So modularization is a trade, not a free win:")} a clean-build tax that scales with\n` +
      `the graph, for a faster inner loop now — and the thing you cannot see yet,\n` +
      `${brand.bold("granularity")}, which Task 6 spends to make the clean build fall off a cliff. You\n` +
      `are not done. You are set up.`
    : `${brand.bold("Your incremental build did not get faster, which is unusual.")} We see the split\n` +
      `relink a much smaller app and win there every time. If it went the other way,\n` +
      `re-measure on a settled machine — the inner-loop win is the one number here that\n` +
      `should reproduce.\n\n${cleanReading}`;

  return `${lines.join("\n")}\n\n${verdict}`;
};

export const task04: WorkshopTask = {
  id: 4,
  slug: "split-the-god-module",
  stage: "The build",
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
