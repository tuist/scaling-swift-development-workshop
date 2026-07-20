import { readRaw } from "../source.js";
import { brand } from "../theme.js";
import { shell } from "../ui.js";
import type { CheckResult, ValidationResult, WorkshopTask } from "./types.js";

const WORKFLOW = ".github/workflows/ci.yml";

const brief = `${brand.bold("Everything you fixed today, you fixed on your own laptop.")}

Your caches are warm because you warmed them. Your packages are resolved because
you resolved them. Your tests are skipped because you ran them once already.

A CI runner has none of that. It arrives empty, every time.

${brand.bold("Which means every number you have taken today is the optimistic one.")} Task 5
already showed you the pessimistic one: a cold cache is ${brand.bold("slower")} than no cache at
all. On a fresh runner that is not a curiosity — it is the default.

${brand.bold("Your job")}
Write ${brand.accent(WORKFLOW)} that builds and tests RockyFeed, and give the
runner what your laptop has:

  ${brand.dim("·")} the tooling, without installing it from scratch every run
  ${brand.dim("·")} the resolved packages
  ${brand.dim("·")} the module cache from task 6
  ${brand.dim("·")} only the tests that need running, from task 7

${brand.bold("And then the part people skip:")} make the run ${brand.bold("tell you")} whether the cache hit.
A pipeline that silently misses is a pipeline that has been made slower by every
optimisation in this workshop, and nobody will notice for a quarter.

${brand.dim("There is no CI runner in this room, so nothing here is timed. This one you")}
${brand.dim("reason about and we check the shape of. It is the honest limit of a workshop.")}`;

const hint = `${brand.bold("The order matters")}
Restore caches ${brand.bold("before")} you need them and save them after, keyed by something that
changes when the contents should:

  ${brand.dim("mise")}          key on mise.toml — tooling changes rarely, so this hits nearly always
  ${brand.dim("packages")}      key on Tuist/Package.resolved
  ${brand.dim("module cache")}  Tuist handles the hashing; you cache its store

${brand.bold("The keys are the whole game")}
Key on something too broad — ${brand.dim("hashFiles('**/*')")}, the commit SHA — and you miss on
every run, so you have built a cache that only ever pays the write cost. That is
the p99 from task 5, on a schedule.

Key on something too narrow and you serve a stale answer, which is worse: now
your CI is wrong rather than slow.

${brand.bold("Say the quiet part out loud")}
GitHub gives you ${brand.dim("steps.<id>.outputs.cache-hit")}. Print it. Better, fail loudly or
annotate when a run that should have hit did not. Cache hit rate is a number your
team should be able to see without asking you.

${brand.bold("What good looks like")}

  ${brand.dim("p50")}  warm cache, small change     → most of the day
  ${brand.dim("p90")}  warm cache, wider change     → still cheaper than cold
  ${brand.dim("p99")}  Xcode update, cache cold     → slower than no cache. Plan for it.

${brand.dim("That third row is not a failure. It is the deal you signed in task 5, and the")}
${brand.dim("reason you measure hit rate instead of assuming it.")}`;

const commands = shell(`# There is nothing to run here, so nothing to paste. This is the shape.
# Write it yourself: a workflow you have not thought about is a workflow that
# misses.

# .github/workflows/ci.yml
#
# jobs:
#   build:
#     runs-on: macos-15
#     steps:
#       - uses: actions/checkout@v4
#
#       # 1. Tooling. Keyed on mise.toml, so it hits until you change a version.
#       - uses: actions/cache@v4
#         id: mise-cache
#         with:
#           path: ~/.local/share/mise
#           key: mise-\${{ hashFiles('mise.toml') }}
#       - uses: jdx/mise-action@v2
#
#       # 2. Resolved packages. Keyed on the resolution, not the manifest.
#       - uses: actions/cache@v4
#         with:
#           path: app/Tuist/.build
#           key: spm-\${{ hashFiles('app/Tuist/Package.resolved') }}
#
#       # 3. The module cache from task 6.
#       - uses: actions/cache@v4
#         id: tuist-cache
#         with:
#           path: ~/.cache/tuist
#           key: tuist-\${{ hashFiles('app/Project.swift', 'app/Core/**', 'app/RockyFeed/**') }}
#           restore-keys: tuist-
#
#       # 4. Say whether it hit. Out loud, every run.
#       - run: echo "module cache hit: \${{ steps.tuist-cache.outputs.cache-hit }}"
#
#       - run: cd app && tuist install && tuist cache
#       - run: cd app && tuist test    # only what changed, from task 7

# Then: Validate my work.`);

const validate = async (): Promise<ValidationResult> => {
  const checks: CheckResult[] = [];

  // Raw, not stripped: YAML comments are `#`, and the Swift stripper would eat
  // `https://` URLs here for no benefit.
  const workflow = await readRaw(WORKFLOW);

  checks.push({
    label: "A workflow exists",
    ok: workflow.length > 0,
    detail: workflow.length > 0 ? undefined : `Nothing at ${WORKFLOW} yet.`,
  });

  if (workflow.length === 0) {
    return { checks, hint: `Write ${WORKFLOW}. The hint has the shape.` };
  }

  const caches = /actions\/cache/.test(workflow);
  checks.push({
    label: "It restores caches",
    ok: caches,
    detail: caches
      ? undefined
      : "No actions/cache step. A runner starts empty — everything you did today has to be " +
        "carried to it, or it was laptop theatre.",
  });

  // Keying is where CI caching actually goes wrong, so check for it rather than
  // for the existence of a cache step.
  const keyedOnContent = /hashFiles\(/.test(workflow);
  checks.push({
    label: "Cache keys are derived from content",
    ok: keyedOnContent,
    detail: keyedOnContent
      ? undefined
      : "No hashFiles() anywhere. Keying on a commit SHA or a fixed string means you miss every " +
        "run and pay only the write cost — a cache that has made CI slower.",
  });

  const reportsHit = /cache-hit/.test(workflow);
  checks.push({
    label: "The run says whether the cache hit",
    ok: reportsHit,
    detail: reportsHit
      ? undefined
      : "Nothing reads steps.<id>.outputs.cache-hit. A silently-missing cache looks exactly " +
        "like a working one, for months.",
  });

  const selective = /tuist test/.test(workflow);
  checks.push({
    label: "Tests are selective",
    ok: selective,
    detail: selective
      ? undefined
      : "Still running the whole suite. Task 7 earned you the right to skip; spend it.",
  });

  return {
    checks,
    hint: "Write the workflow, key the caches on content, and print the hit.",
  };
};

export const task09: WorkshopTask = {
  id: 9,
  slug: "make-ci-pay",
  stage: "CI",
  title: "Make CI pay for it",
  summary: "Everything you fixed today, you fixed on your laptop. CI arrives empty.",
  brief,
  reveals: [
    {
      id: "hint",
      label: "Give me a hint",
      hint: "Keys, order, and saying the quiet part out loud",
      title: "Hint",
      body: hint,
    },
    {
      id: "commands",
      label: "Show me the shape",
      hint: "A workflow to write, not paste",
      title: "The shape",
      body: commands,
      copyable: true,
    },
  ],
  validate,
  solutionBranch: "solutions/09",
  stuckNote:
    `There's a workflow on ${brand.accent("solutions/09")} if you want to read one.\n\n` +
    `${brand.bold("But this task is the one worth not skipping to the answer.")} Every other task\n` +
    `today had a number to tell you when you were right. This one doesn't — there's\n` +
    `no runner in the room — so it's the only task where you have to reason about\n` +
    `whether your caching is sound rather than measure it.\n\n` +
    `${brand.dim("Which, when you get back to work on Monday, is the situation you'll actually")}\n` +
    `${brand.dim("be in.")}`,
};
