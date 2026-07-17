import os from "node:os";
import { buildEnvGenerated, cleanBuild, labels, serialCleanBuild } from "../commands.js";
import { generatedSchemes, readMeasurement } from "../measure.js";
import { renderComparison } from "../report.js";
import { brand, formatDuration } from "../theme.js";
import { shell } from "../ui.js";
import type { CheckResult, ValidationResult, WorkshopTask } from "./types.js";

const cores = os.cpus().length;

const brief = `${brand.bold("Now change what the project says.")}

Two tasks ago you found the problem: ${brand.bold("2")} of Core's ${brand.bold("82")} files import Alamofire or
Kingfisher, and the other ${brand.bold("80")} wait for them anyway. Sixty of those are design-system
components that import nothing but SwiftUI.

Last task you moved the answer to "what modules exist" out of a pbxproj and into
Swift. So now it's a manifest edit.

${brand.bold("Your job")}
Split ${brand.accent("Core")} into modules so that ${brand.bold("nothing waits for something it does not use.")}

Then measure both numbers again — the clean build and the serial one:

  ${brand.accent(labels.splitClean)}${brand.dim(".json")}
  ${brand.accent(labels.splitSerial)}${brand.dim(".json")}

${brand.bold("Fair warning: this will make your build slower.")}
Not a little. About half again. Measure it anyway — the number is the lesson, and
a task that only ever shows you wins is a sales pitch, not a workshop.

${brand.dim("Task 2 said the cores were idle because of the graph. Task 2 was wrong, and this")}
${brand.dim("is the task that proves it: the speedup will not move, because Xcode was already")}
${brand.dim("compiling the files inside each target in parallel. There was never a queue.")}

${brand.bold("So why are we doing it?")}
Because you are not buying speed here. You are buying ${brand.bold("granularity")}, and you spend
it in Task 6. If you want the argument before the evidence, skip ahead — but it
lands better if you have felt the regression first.

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

# 5. Measure both. Same commands as before, new export paths.
${buildEnvGenerated}

${cleanBuild(labels.splitClean)}

${serialCleanBuild(labels.splitSerial)}

# Then: Validate my work, and Did it work.`);

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
  const serial = await readMeasurement(labels.splitSerial);
  checks.push({
    label: "Clean build re-measured",
    ok: clean !== null,
    detail: clean ? undefined : `Nothing readable at .workshop/measurements/${labels.splitClean}.json yet.`,
  });
  checks.push({
    label: "Serial build re-measured",
    ok: serial !== null,
    detail: serial
      ? undefined
      : `Nothing readable at .workshop/measurements/${labels.splitSerial}.json yet — ` +
        `without it you can't say whether the cores woke up.`,
  });

  const before = await readMeasurement(labels.baselineClean);
  const report =
    before && clean
      ? renderComparison([{ label: "Clean build", before, after: clean }])
      : undefined;

  return {
    checks,
    ...(report ? { report } : {}),
    hint: "Split the manifest, fix the imports, regenerate, measure both.",
  };
};

/** Their four numbers, read back together. */
const didItWork = async (): Promise<string> => {
  const oldParallel = await readMeasurement(labels.baselineClean);
  const oldSerial = await readMeasurement(labels.serialClean);
  const newParallel = await readMeasurement(labels.splitClean);
  const newSerial = await readMeasurement(labels.splitSerial);

  if (!oldParallel || !oldSerial || !newParallel || !newSerial) {
    return (
      `${brand.bold("Not enough numbers yet.")}\n\n` +
      `This needs Task 1's clean build, Task 2's serial build, and both of this\n` +
      `task's measurements. The comparison is the point.`
    );
  }

  const before = oldSerial.mean / oldParallel.mean;
  const after = newSerial.mean / newParallel.mean;
  const saved = oldParallel.mean - newParallel.mean;

  const lines = [
    `${"".padEnd(18)}${"before".padStart(9)}${"after".padStart(11)}`,
    `${"Clean build".padEnd(18)}${formatDuration(oldParallel.mean).padStart(9)}${formatDuration(newParallel.mean).padStart(11)}`,
    `${"Serial build".padEnd(18)}${formatDuration(oldSerial.mean).padStart(9)}${formatDuration(newSerial.mean).padStart(11)}`,
    `${"Parallel speedup".padEnd(18)}${`${before.toFixed(1)}×`.padStart(9)}${`${after.toFixed(1)}×`.padStart(11)}`,
  ];

  const verdict =
    after < before - 0.3
      ? `${brand.warn("The speedup went down, and the build got slower.")} That is the expected result,\n` +
        `and it is worth sitting with for a moment.\n\n` +
        `Nothing here compiles more slowly than it did. There is exactly as much code\n` +
        `as this morning. What you added is ${brand.bold("boundaries")}: twelve modules to link, sign\n` +
        `and embed where there were two — and no parallelism in return, because Xcode\n` +
        `already compiled the files inside each target at the same time.\n\n` +
        `${brand.bold("Task 2 told you the graph was the ceiling. Task 2 was wrong, and this is how")}\n` +
        `${brand.bold("you know.")} If the shape had been the problem, this would have fixed it.\n\n` +
        `${brand.dim("Keep the number. Task 6 is where you find out what you actually bought.")}`
      : `${brand.bold("Your numbers moved differently to ours.")} Ours got ~50% slower here, and the\n` +
        `speedup did not budge.\n\n` +
        `Worth a look either way: \`tuist graph\` draws the picture. But do not expect\n` +
        `this task to be the win — it is not, and Task 6 is where the argument lands.`;

  return `${lines.join("\n")}\n\n${verdict}\n\n${brand.dim(
    "This is the shape the talk asks for: no arrows inside a layer, and nothing\nwaiting on work it never needed.",
  )}`;
};

export const task04: WorkshopTask = {
  id: 4,
  slug: "split-the-god-module",
  stage: "Stage 03 · The build",
  title: "Split the god module",
  summary: "Make the build slower on purpose. Collect in Task 6.",
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
      label: "Did it work?",
      hint: "Your four numbers, side by side",
      title: "Did it work?",
      body: "",
      resolve: didItWork,
    },
  ],
  validate,
  solutionBranch: "solutions/04",
};
