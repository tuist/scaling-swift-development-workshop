import fs from "node:fs/promises";
import { buildEnvGenerated, cleanBuild, labels } from "../commands.js";
import { readMeasurement } from "../measure.js";
import { renderComparison } from "../report.js";
import { paths } from "../paths.js";
import { git, hasBinary, run } from "../shell.js";
import { brand } from "../theme.js";
import { shell } from "../ui.js";
import type { CheckResult, ValidationResult, WorkshopTask } from "./types.js";

const exists = async (p: string): Promise<boolean> =>
  fs.access(p).then(() => true).catch(() => false);

const brief = `${brand.bold("You cannot fix the graph while the graph lives in a pbxproj.")}

Last task you found the shape of your build is the problem: 2.8× out of ${brand.bold("11")} cores,
because 82 files sit behind two networking libraries they never use.

The fix is to split Core into modules. Which sounds like a five-minute job, until
you remember where the answer to "what modules exist" is currently written down:
${brand.accent("RockyFeed.xcodeproj/project.pbxproj")}. Eleven thousand lines of generated XML with
hex identifiers, checked into git, that two people cannot edit in the same week
without a merge conflict.

Nobody splits a monolith into six modules by hand in there. That is precisely why
the monolith is still a monolith.

${brand.bold("So this task changes nothing about the build. It changes where the project is defined.")}

You describe the project in ${brand.bold("Swift")}, and the ${brand.dim(".xcodeproj")} becomes a build artefact —
generated on demand, gitignored, like a ${brand.dim(".o")} file. Nobody merges those.

${brand.bold("Your job")}

  1. Describe RockyFeed in ${brand.accent("Project.swift")} — same three targets, same monolithic Core
  2. Move Alamofire and Kingfisher into ${brand.accent("Tuist/Package.swift")}
  3. Generate the project, delete the checked-in one, gitignore it
  4. Re-measure the clean build → ${brand.accent(labels.generatedClean)}${brand.dim(".json")}

${brand.bold("Do not expect step 4 to be exciting.")} You are changing where the project is
defined, not what it says, so the build has the same work in front of it. It may
come out slightly quicker — Tuist integrates Alamofire and Kingfisher as ordinary
Xcode targets rather than leaving Xcode to interpret a package graph at build time
— but a ${brand.bold("dramatic")} win here should worry you, not please you. It would mean the
two projects were never equivalent, and you had measured your own migration bug.

${brand.dim("A task where the number barely moves is not a wasted task. It is the one that")}
${brand.dim("makes the next task a manifest edit instead of a fortnight.")}

${brand.dim("tuist is pinned in mise.toml. `tuist init` will scaffold you something, but you")}
${brand.dim("will learn more writing the manifest than reading a generated one.")}`;

const hint = `${brand.bold("The two files")}

${brand.accent("app/Tuist.swift")} marks the root of a Tuist project:

  ${brand.dim("import ProjectDescription")}
  ${brand.dim("let tuist = Tuist()")}

${brand.accent("app/Project.swift")} describes it. A target is roughly what you'd expect:

  ${brand.dim(".target(name:destinations:product:bundleId:sources:dependencies:)")}

You need three: the ${brand.accent("RockyFeed")} app, ${brand.accent("Core")} as a ${brand.dim(".framework")}, and ${brand.accent("RockyFeedTests")}.
Keep Core exactly as it is — one target, all 82 files, owning both dependencies.
Resist the urge to fix it here. That's the next task, and doing both at once means
you won't know which one earned the number.

${brand.bold("Third-party dependencies")}
${brand.accent("app/Tuist/Package.swift")} is a normal SwiftPM manifest listing Alamofire and
Kingfisher. ${brand.accent("tuist install")} resolves them. In your targets they become
${brand.dim('.external(name: "Alamofire")')}.

${brand.bold("Don't forget the build phase")}
The "Stamp build info" script has to survive the migration — it's in ${brand.dim("scripts:")} on
the app target. It's still as non-hermetic as it ever was. We have not fixed it;
we've only moved where it's written down.

${brand.bold("⚠️ Your build command changes")}
Tuist puts Alamofire and Kingfisher beside your app as generated projects inside a
${brand.bold("workspace")}. The workspace knows the whole graph; the project alone does not. Keep
using ${brand.dim("-project")} after generating and you get:

  ${brand.error("error: unable to resolve module dependency: 'Kingfisher'")}

which is the build system telling you to point at the workspace instead.`;

const commands = shell(`# Run from the repo root, one at a time.

# 1. Mark the Tuist root.
cat > app/Tuist.swift <<'SWIFT'
import ProjectDescription

let tuist = Tuist()
SWIFT

# 2. Third-party dependencies, for tuist install to resolve.
mkdir -p app/Tuist
cat > app/Tuist/Package.swift <<'SWIFT'
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "RockyFeed",
    dependencies: [
        .package(url: "https://github.com/Alamofire/Alamofire", from: "5.9.0"),
        .package(url: "https://github.com/onevcat/Kingfisher", from: "7.11.0"),
    ]
)
SWIFT

# 3. Write app/Project.swift.
#    Not reproduced here, because copying 70 lines of manifest teaches nothing.
#    Take it from the solution branch if you want it verbatim:
#
#      git show solutions/03:app/Project.swift > app/Project.swift
#
#    Three targets: RockyFeed (.app), Core (.framework, sources
#    Core/Sources/Core/**, external Alamofire + Kingfisher), RockyFeedTests
#    (.unitTests). Plus the post script at Scripts/stamp-build-info.sh.

# 4. Core is a Tuist target now, not a SwiftPM package.
git rm --cached app/Core/Package.swift app/Core/Package.resolved
rm -f app/Core/Package.swift app/Core/Package.resolved

# 5. Resolve and generate.
cd app && tuist install && tuist generate --no-open && cd ..

# 6. The checked-in project becomes a build artefact. This is the moment the
#    merge conflicts stop.
git rm -r --cached app/RockyFeed.xcodeproj
printf 'app/*.xcodeproj\\napp/*.xcworkspace\\napp/Derived/\\napp/Tuist/.build/\\n' >> .gitignore

# 7. Re-measure. Note the -workspace: see the hint.
${buildEnvGenerated}

${cleanBuild(labels.generatedClean)}

# Then: Validate my work.`);

const validate = async (): Promise<ValidationResult> => {
  const checks: CheckResult[] = [];

  const tuistInstalled = await hasBinary("tuist");
  checks.push({
    label: "tuist is installed",
    ok: tuistInstalled,
    detail: tuistInstalled ? undefined : "Run `mise install` in the repo root.",
  });

  const hasManifest = await exists(paths.projectManifest);
  const hasTuistSwift = await exists(paths.tuistManifest);
  checks.push({
    label: "The project is described in Swift",
    ok: hasManifest && hasTuistSwift,
    detail:
      hasManifest && hasTuistSwift
        ? undefined
        : `Need both app/Project.swift and app/Tuist.swift.`,
  });

  // The generated project must exist to build, but must NOT be tracked — that's
  // the entire point of the task.
  const generated = await exists(paths.xcworkspace);
  checks.push({
    label: "A workspace has been generated",
    ok: generated,
    detail: generated ? undefined : "Run `tuist generate --no-open` from app/.",
  });

  const tracked = await git(["ls-files", "app/RockyFeed.xcodeproj"]);
  const stillTracked = tracked.ok && tracked.stdout.trim().length > 0;
  checks.push({
    label: "The Xcode project is no longer committed",
    ok: !stillTracked,
    detail: stillTracked
      ? "app/RockyFeed.xcodeproj is still tracked by git. Generating it and committing it too " +
        "gets you the merge conflicts AND the extra tool — the worst of both. " +
        "`git rm -r --cached app/RockyFeed.xcodeproj` and gitignore it."
      : undefined,
  });

  const ignored = await run("git", ["check-ignore", "app/RockyFeed.xcodeproj"]);
  checks.push({
    label: "...and it's gitignored",
    ok: ignored.ok,
    detail: ignored.ok ? undefined : "Add app/*.xcodeproj and app/*.xcworkspace to .gitignore.",
  });

  const baseline = await readMeasurement(labels.baselineClean);
  const generatedClean = await readMeasurement(labels.generatedClean);
  checks.push({
    label: "Clean build re-measured",
    ok: generatedClean !== null,
    detail: generatedClean
      ? undefined
      : `Nothing readable at .workshop/measurements/${labels.generatedClean}.json yet.`,
  });

  const report =
    baseline && generatedClean
      ? `${renderComparison([
          { label: "Clean build", before: baseline, after: generatedClean },
        ])}\n\n${brand.dim("Roughly flat is the expected result, and a small win is plausible. You changed")}\n${brand.dim("where the project is defined, not what it says — the graph is still a chain.")}\n${brand.dim("Task 4 is where the shape changes.")}`
      : undefined;

  return {
    checks,
    ...(report ? { report } : {}),
    hint: "Write the manifests, generate, stop committing the project, then re-measure.",
  };
};

export const task03: WorkshopTask = {
  id: 3,
  slug: "generate-it",
  stage: "The build",
  title: "Generate it with Tuist",
  summary: "Describe the project in Swift so the graph becomes editable.",
  brief,
  reveals: [
    {
      id: "hint",
      label: "Give me a hint",
      hint: "The manifests, and why your build command changes",
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
  solutionBranch: "solutions/03",
};
