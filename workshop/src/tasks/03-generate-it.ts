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

const brief = `${brand.bold("You won't fix the graph while it lives in a pbxproj.")}

Last task you found the shape of your build is the problem: 2.8× out of ${brand.bold("11")} cores,
because 82 files sit behind two networking libraries they never use.

The fix is to split Core into modules. Which sounds like a five-minute job, until
you remember where the answer to "what modules exist" is currently written down:
${brand.accent("RockyFeed.xcodeproj/project.pbxproj")}. Eleven thousand lines of generated XML with
hex identifiers, checked into git, that two people can barely touch in the same
week without a merge conflict.

Could you split a monolith into six modules by hand in there? Technically, yes.
But it's slow, error-prone, and so unpleasant that nobody does — which is exactly
why the monolith is still a monolith.

${brand.bold("So this task changes nothing about the build. It changes where the project is defined.")}

You describe the project in ${brand.bold("Swift")}, and the ${brand.dim(".xcodeproj")} becomes a build artefact —
generated on demand, gitignored, like a ${brand.dim(".o")} file. Nobody merges those.

${brand.bold("Your job")}

  1. Describe RockyFeed in ${brand.accent("Project.swift")} — same three targets, same monolithic
     Core, with Alamofire and Kingfisher declared right there as SwiftPM packages
  2. Generate the project, delete the checked-in one, gitignore it
  3. Re-measure the clean build → ${brand.accent(labels.generatedClean)}${brand.dim(".json")}

${brand.bold("Do not expect step 3 to be exciting.")} You are changing where the project is
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

${brand.bold("Third-party dependencies go in Project.swift too")}
Declare them once at the project level and reference the products from Core — this
is Xcode's own SPM integration, written in Swift:

  ${brand.dim("packages: [.remote(url: \"…/Alamofire\", requirement: .upToNextMajor(from: \"5.9.0\"))]")}
  ${brand.dim("// on Core:  dependencies: [.package(product: \"Alamofire\"), .package(product: \"Kingfisher\")]")}

Xcode resolves them at build time, so there is ${brand.bold("no")} ${brand.dim("tuist install")} step here. (You
will move them to a Tuist-managed form in Task 6 — the module cache needs them to
be Tuist's targets, not Xcode's. Not yet: one new idea per task.)

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

# 1. Project.swift IS the task: it describes the whole project in Swift, with
#    Alamofire and Kingfisher declared as SwiftPM packages right in the manifest.
#    It is ~80 lines, so take it verbatim rather than typing it. Open it and read
#    it — the packages: block and the .package(product:) references are the point.
git show solutions/03:app/Project.swift > app/Project.swift

# 2. Mark the Tuist root. One line.
cat > app/Tuist.swift <<'SWIFT'
import ProjectDescription

let tuist = Tuist()
SWIFT

# 3. Core stops being its own SwiftPM package — it is a Tuist target now.
git rm --cached app/Core/Package.swift app/Core/Package.resolved
rm -f app/Core/Package.swift app/Core/Package.resolved

# 4. Generate. No tuist install: the packages are Xcode-native SPM, resolved at
#    build time. (tuist install arrives in Task 6, with the module cache.)
cd app && tuist generate --no-open && cd ..

# 5. The checked-in project becomes a build artefact. Merge conflicts stop here.
git rm -r --cached app/RockyFeed.xcodeproj
printf 'app/*.xcodeproj\\napp/*.xcworkspace\\napp/Derived/\\n' >> .gitignore

# 6. Re-measure. Note the -workspace (see the hint).
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
