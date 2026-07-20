import os from "node:os";
import { buildEnv, labels, serialCleanBuild } from "../commands.js";
import { readMeasurement } from "../measure.js";
import { brand, formatDuration } from "../theme.js";
import { shell } from "../ui.js";
import type { CheckResult, ValidationResult, WorkshopTask } from "./types.js";

const cores = os.cpus().length;

const brief = `${brand.bold("You have a machine full of cores. Are you using them?")}

Your clean build took a number you now trust. But a number on its own doesn't tell
you whether it's ${brand.bold("good")} — only whether it's repeatable. ${formatDuration(20)} could be
excellent or embarrassing depending on what the machine was capable of.

This one is quick, and it's the last measurement before we start changing things.

${brand.bold("Your job")}
Find out how much your ${brand.accent(`${cores} cores`)} are actually buying you.

Measure the same clean build again, but let it use only ${brand.bold("one job at a time")}, and
save it as ${brand.accent(labels.serialClean)}${brand.dim(".json")}.

Then divide. If ${cores} cores made the build ${cores}× faster, the machine is the limit and
you should go buy a bigger one. If they didn't, something else is.

${brand.bold("Before you run it, guess.")} Write the number down. Genuinely — a prediction you
got wrong is worth more than a number you nodded at.

${brand.dim("xcodebuild has a flag for this, and the hint knows which one.")}`;

const hint = `${brand.bold("The flag")}
${brand.accent("-jobs 1")} tells xcodebuild to run one task at a time. Append it to the same
${brand.dim("$BUILD")} command — everything else stays identical, or you're not comparing like
with like.

${brand.bold("One run is enough here")}
No σ, no three-run ritual. We're looking for a factor of three, not three
percent, and a second serial build costs another minute to sharpen a conclusion
that doesn't need sharpening. Rigour should be proportionate to the effect.

${brand.bold("While it runs, think about the shape of the work.")}

RockyFeed has to build Alamofire, Kingfisher, ${brand.accent("Core")}, and the app itself. Ask
yourself, in order:

  ${brand.dim("·")} What can start immediately?
  ${brand.dim("·")} What has to wait, and on what?
  ${brand.dim("·")} How many of those things can happen at the same time?

${brand.dim("Then take the last reveal, which does the arithmetic with you.")}`;

const commands = shell(`# Run from the repo root.

# If BUILD is no longer set in this shell:
${buildEnv}

# The same clean build, one job at a time. Takes a couple of minutes:
# that slowness is the measurement, not a problem with it.
${serialCleanBuild(labels.serialClean)}

# Then: Validate my work, and Where did the cores go.`);

const validate = async (): Promise<ValidationResult> => {
  const checks: CheckResult[] = [];

  const parallel = await readMeasurement(labels.baselineClean);
  checks.push({
    label: "Task 1's clean build is still on record",
    ok: parallel !== null,
    detail: parallel ? undefined : "Go back and finish Task 1 — this compares against it.",
  });

  const serial = await readMeasurement(labels.serialClean);
  checks.push({
    label: "Serial clean build measured",
    ok: serial !== null,
    detail: serial
      ? undefined
      : `Nothing readable at .workshop/measurements/${labels.serialClean}.json yet.`,
  });

  if (parallel && serial) {
    // If -jobs 1 isn't slower, the flag didn't take and the ratio is a lie.
    const slower = serial.mean > parallel.mean;
    checks.push({
      label: "The serial build is slower than the parallel one",
      ok: slower,
      detail: slower
        ? undefined
        : "One job should be slower than many. Check that -jobs 1 actually made it into the " +
          "command, otherwise you've measured the same build twice.",
    });
  }

  const report =
    parallel && serial
      ? [
          `${"All cores".padEnd(22)} ${formatDuration(parallel.mean)}`,
          `${"One job at a time".padEnd(22)} ${formatDuration(serial.mean)}`,
          ``,
          `${"Speedup".padEnd(22)} ${brand.bold(`${(serial.mean / parallel.mean).toFixed(1)}×`)} ` +
            `${brand.dim(`on ${cores} cores`)}`,
        ].join("\n")
      : undefined;

  return {
    checks,
    ...(report ? { report } : {}),
    hint: "Measure the serial build, then read \"Where did the cores go?\".",
  };
};

/** Does the arithmetic with them, using their own two numbers. */
const whereDidTheCoresGo = async (): Promise<string> => {
  const parallel = await readMeasurement(labels.baselineClean);
  const serial = await readMeasurement(labels.serialClean);

  if (!parallel || !serial) {
    return (
      `${brand.bold("Measure both first.")}\n\n` +
      `This needs Task 1's clean build and the serial one side by side.`
    );
  }

  const speedup = serial.mean / parallel.mean;
  const efficiency = (speedup / cores) * 100;

  return `${brand.bold("Your numbers")}

  ${"One job".padEnd(14)} ${formatDuration(serial.mean)}
  ${"All cores".padEnd(14)} ${formatDuration(parallel.mean)}
  ${"Speedup".padEnd(14)} ${brand.bold(`${speedup.toFixed(1)}×`)} ${brand.dim(`— on ${cores} cores`)}

Perfect scaling would be about ${brand.bold(`${cores}×`)}. You got ${brand.bold(`${speedup.toFixed(1)}×`)}, which is
roughly ${brand.bold(`${efficiency.toFixed(0)}%`)} of the machine you paid for.

${brand.bold("So a faster laptop will not save you.")} The cores are already there and already
idle. Something is stopping the build from using them, and it is not the CPU.

${brand.bold("Here is what is stopping it.")}

RockyFeed builds in a chain, because that's what its dependency graph says to do:

  ${brand.dim("Alamofire  Kingfisher")}
       ${brand.dim("└────┬────┘")}
            ${brand.dim("▼")}
          ${brand.accent("Core")}          ${brand.dim("(82 files, one module)")}
            ${brand.dim("▼")}
        ${brand.dim("RockyFeed")}       ${brand.dim("(the app)")}

Nothing in ${brand.accent("Core")} can start until ${brand.bold("both")} networking libraries have finished. Nothing
in the app can start until ${brand.bold("all")} of Core has finished. While the front of that chain
compiles, most of your cores have nothing to do.

${brand.bold("And now the part that should annoy you.")}

  ${brand.error("2")} of Core's ${brand.bold("82")} files import Alamofire or Kingfisher.
  ${brand.dim("NetworkClient.swift and RemoteImage.swift. That's it.")}

  ${brand.success("60")} of them are design-system components that import ${brand.bold("nothing but SwiftUI")}.
  ${brand.dim("They do not know the network exists. They wait for it anyway.")}

They wait because Core is ${brand.bold("one module")}, and a module is the unit the build system
schedules.

${brand.bold("But hold on. Does that actually explain your number?")}

It is the obvious story, and it is ${brand.bold("wrong")}, and finding out why is worth more than
being told the right answer.

Xcode already compiles the files ${brand.bold("inside")} a target in parallel. Core's 82 files were
never a queue. Neither were the app's 90. So the chain above costs you the
${brand.bold("handoffs")} — three of them — not the compiling, and three handoffs do not explain a
gap this size.

${brand.dim("We know it is wrong because we tried it. Splitting Core into twelve modules")}
${brand.dim("later in this workshop moves the speedup from 2.96x to 2.93x — that is, not at")}
${brand.dim("all. If the graph were the ceiling, splitting it would have raised the ceiling.")}
${brand.dim("It did not.")}

${brand.bold("So what is the ceiling?")}
Swift compilation itself. Type-checking, module emission, linking — work that does
not divide neatly across ${cores} cores no matter how you arrange your project. You are
getting ${brand.bold("about a quarter")} of this machine and there is no arrangement of targets
that gets you the rest.

${brand.bold("Which leaves you with the useful conclusion:")}

  ${brand.dim("·")} A faster laptop buys you a little. Not a lot.
  ${brand.dim("·")} Rearranging your modules buys you ${brand.bold("nothing")} here. We will prove that.
  ${brand.dim("·")} The only way out is to ${brand.bold("not do the work")} — to reuse it instead.

${brand.dim("That is the whole rest of the day. Everything from here is about doing less,")}
${brand.dim("not about doing it faster.")}`;
};

export const task02: WorkshopTask = {
  id: 2,
  slug: "your-cores-are-idle",
  stage: "The build",
  title: "Your cores are idle",
  summary: "Find out how little of your machine you get, and why more cores will not help.",
  brief,
  reveals: [
    {
      id: "hint",
      label: "Give me a hint",
      hint: "The flag, and what to think about while it runs",
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
      id: "why",
      label: "Where did the cores go?",
      hint: "The arithmetic, and the culprit",
      title: "Where did the cores go?",
      body: "",
      resolve: whereDidTheCoresGo,
    },
  ],
  validate,
  solutionBranch: "solutions/02",
  stuckNote:
    `Nothing to check out here either — this task is a measurement of your own\n` +
    `machine, like Task 1.\n\n` +
    `${brand.bold("If the serial build seems to hang:")} it isn't. It's a clean build with one\n` +
    `core doing all of it. That is the entire point, and yes, it takes a couple of\n` +
    `minutes.\n\n` +
    `${brand.dim("If you want to skip the wait, borrow a neighbour's number — the ratio is what")}\n` +
    `${brand.dim("matters, and it won't be far off yours.")}`,
};
