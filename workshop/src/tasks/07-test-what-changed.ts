import { labels, testEverything, testSelective } from "../commands.js";
import { readMeasurement } from "../measure.js";
import { readCode } from "../source.js";
import { brand, formatDuration } from "../theme.js";
import { shell } from "../ui.js";
import type { CheckResult, ValidationResult, WorkshopTask } from "./types.js";

const FLAKY = "app/RockyFeedTests/ImageCacheTests.swift";

const brief = `${brand.bold("Same inputs, same result. You have heard this before.")}

Twice now you have made something faster by refusing to redo work whose inputs
had not changed. Task 5 did it per compile job. Task 6 did it per module.

Your tests have had no such luck. Change one line in ${brand.accent("FeatureSettings")} and CI runs
every test you own, including the ones for code nobody has touched since March.

${brand.bold("Your job")}

  1. Time the suite as it stands → ${brand.accent(labels.testAll)}${brand.dim(".json")}
  2. Run it through ${brand.accent("tuist test")} instead. Run it ${brand.bold("twice")}, and read the second
     run's output carefully — it should refuse to do something
  3. Then find the test that makes all of this unsafe, and fix it

${brand.bold("Step 3 is the task.")} Steps 1 and 2 take a command each. Step 3 is a question:
${brand.bold("what has to be true about a test before you are allowed to skip it?")}

${brand.dim("Answer that honestly and one of the tests in this repo stops being acceptable.")}
${brand.dim("It has been sitting there since Task 1, passing, most of the time.")}`;

const hint = `${brand.bold("The mechanism")}
${brand.accent("tuist test")} hashes each test target exactly the way task 6 hashed each build
target: sources, settings, dependencies. If a target's hash is unchanged since a
run that passed, its tests are skipped.

Run it twice with nothing changed and the second run says:

  ${brand.dim("There are no tests to run, finishing early")}

That is not a bug. That is the point.

${brand.bold("Now the uncomfortable part")}
Skipping is a claim: ${brand.bold("this test passed for these inputs, so it would pass again.")}
That claim is only true if the test is a function of its inputs.

${brand.accent(FLAKY)} is not.

  ${brand.dim("try await Task.sleep(for: .milliseconds(Int.random(in: 40 ... 120)))")}
  ${brand.dim("#expect(elapsed < 0.1)")}

It sleeps for a random duration and asserts a wall-clock budget. It fails ${brand.bold("25%")} of
the time — not sometimes, not on a bad day: 25%, by arithmetic. Twenty of the
eighty milliseconds it might sleep are over budget.

${brand.bold("Why it poisons everything above it")}
The test's result does not depend on its inputs, so caching that result is not an
optimisation, it is a lie with good uptime. Worse is what it does to people: red
build, change you never made, hit retry, wait again. Do that often enough and
green stops carrying information — which means every cache, every skip, and every
number you have measured today is resting on a signal nobody trusts.

${brand.bold("The fix")}
Test what the code does, not how long it took. Assert the cache warms; do not
assert it warms in under 100ms on a machine you do not control. Delete the timing
assertion, or gate the work on an injected clock and assert against that.

${brand.dim("A test that measures the weather is not testing your code.")}`;

const commands = shell(`# Run these from the repo root, one at a time.

# 1. The whole suite, every test, every time. This is CI today.
${testEverything(labels.testAll)}

# 2. Now Tuist's runner. First run does the work...
${testSelective}

# ...and the second refuses to, because nothing changed.
${testSelective}

# 3. Prove it notices real changes: touch a test, run again.
touch ${FLAKY}
${testSelective}

# 4. Then open that file and decide whether you would let it be skipped.
#    Fix it so that skipping it is an honest thing to do.

# Then: Validate my work.`);

const validate = async (): Promise<ValidationResult> => {
  const checks: CheckResult[] = [];

  const all = await readMeasurement(labels.testAll);
  checks.push({
    label: "The suite was timed as it stands",
    ok: all !== null,
    detail: all
      ? undefined
      : `Nothing readable at .workshop/measurements/${labels.testAll}.json yet.`,
  });

  // Read the code back rather than trusting a checkbox: the fix has to be in the
  // file, and there is more than one honest way to write it.
  //
  // Comments stripped, because a good fix explains itself by quoting what it
  // replaced — our own does — and a validator that greps prose fails correct work.
  const source = await readCode(FLAKY);

  const gone = source.length > 0 && !/Int\.random\(in: 40 \.\.\. 120\)/.test(source);
  checks.push({
    label: "The random sleep is gone",
    ok: gone,
    detail: gone
      ? undefined
      : `${FLAKY} still sleeps for a random duration. A test whose result depends on ` +
        `the scheduler cannot be safely skipped, which makes every cache upstream of it a guess.`,
  });

  const noWallClock = source.length > 0 && !/elapsed < 0\.1/.test(source);
  checks.push({
    label: "The wall-clock budget assertion is gone",
    ok: noWallClock,
    detail: noWallClock
      ? undefined
      : "It still asserts a duration against a machine you don't control. Assert what the " +
        "code does, not how fast the CI runner felt today.",
  });

  const stillTests = /@Test/.test(source);
  checks.push({
    label: "...and it still tests something",
    ok: stillTests,
    detail: stillTests
      ? undefined
      : "Deleting the suite is not a fix. The cache warming is worth asserting; its timing isn't.",
  });

  const report = all
    ? `${"Whole suite, every run".padEnd(26)} ${formatDuration(all.mean)}\n` +
      `${"Nothing changed, tuist test".padEnd(26)} ${brand.success("skipped")}   ${brand.dim("← no tests to run")}`
    : undefined;

  return {
    checks,
    ...(report ? { report } : {}),
    hint: "Time the suite, run tuist test twice, then fix the test that lies.",
  };
};

export const task07: WorkshopTask = {
  id: 7,
  slug: "test-what-changed",
  stage: "Stage 04 · The tests",
  title: "Test only what changed",
  summary: "Skip the tests whose inputs didn't move — and earn the right to.",
  brief,
  reveals: [
    {
      id: "hint",
      label: "Give me a hint",
      hint: "How skipping works, and what it assumes",
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
  solutionBranch: "solutions/07",
  stuckNote:
    `${brand.accent("solutions/07")} has the fixed test, and the interesting half of it is not\n` +
    `the deleted assertion — it is the ${brand.dim("pending()")} function that had to exist before\n` +
    `there was anything honest to assert.\n\n` +
    `${brand.bold("One check will still fail after you check it out")}, and that is correct: timing\n` +
    `the suite is a measurement of ${brand.bold("your")} machine, and a branch cannot carry someone\n` +
    `else's stopwatch. Run step 1 yourself.\n\n` +
    `${brand.dim("Same reason Task 1 has no solution branch at all.")}`,
};
