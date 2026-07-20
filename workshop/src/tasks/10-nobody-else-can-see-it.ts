import { tuistFullHandle, tuistProjects, tuistWhoami } from "../measure.js";
import { brand } from "../theme.js";
import { shell } from "../ui.js";
import type { CheckResult, ValidationResult, WorkshopTask } from "./types.js";

const brief = `${brand.bold("Every number you have taken today, only you have seen.")}

Nine tasks of measuring, and all of it lives in ${brand.accent(".workshop/measurements/")} on one
laptop. Your teammate's build is slow in a way you cannot see. Your CI is slow in
a way nobody looks at. When the build gets worse next March, nobody will notice
for a month — the same way nobody noticed this time.

${brand.bold("A number one person measured once is an anecdote.")} What you want is the same
number, from every machine, every build, without anyone remembering to run
hyperfine.

${brand.bold("Your job")}

  1. Make an account and a project on ${brand.accent("tuist.dev")}
  2. Point this checkout at it — that's ${brand.accent("fullHandle")} in ${brand.accent("app/Tuist.swift")}
  3. Build once, and get that build to show up on the dashboard

${brand.dim("It is free, and you can delete the project afterwards. The account is the point")}
${brand.dim("of the exercise: the rest of today needs a server, and so does anything you do")}
${brand.dim("with this on Monday.")}

${brand.bold("A warning before you start.")}
This is the first task that needs the network to work. If the wifi is bad, say so
now rather than in twenty minutes — the failure looks like a hang.`;

const hint = `${brand.bold("The three commands")}

  ${brand.accent("tuist auth login")}                      opens a browser
  ${brand.accent("tuist project create <you>/rockyfeed")}  needs ${brand.dim("--build-system xcode")} if you are
                                        not in an interactive terminal
  ${brand.accent("tuist project list")}                    check it exists

Your handle is your account name on tuist.dev — mine is ${brand.dim("marek")}, so mine would be
${brand.dim("marek/rockyfeed")}. Yours will not be.

${brand.bold("Wiring it up")}
${brand.accent("app/Tuist.swift")} is the file nobody has touched since task 3. It takes a
${brand.dim("fullHandle:")} — that string is the only thing connecting this folder to that
project. Without it, ${brand.dim("tuist cache")} is local-only and ${brand.dim("tuist inspect build")} has
nowhere to send anything. The tooling still works; it just talks to itself.

${brand.bold("Getting a build up there")}
${brand.accent("tuist xcodebuild")} wraps xcodebuild and uploads the result when it finishes — no
scheme post-action, no CI plumbing, nothing to remember. Use it exactly where you
would have typed ${brand.dim("xcodebuild")}.

${brand.dim("The docs also describe a scheme post-action. That is for builds you start")}
${brand.dim("inside Xcode, where there is no command for it to wrap. You are in a terminal,")}
${brand.dim("so you do not need it.")}`;

const commands = shell(`# Run these from the repo root, one at a time.

# 1. Sign in. This opens a browser.
tuist auth login

# 2. Create a project. Swap <you> for your account handle.
#    --build-system is only needed because a script is not interactive;
#    typing this yourself, it will just ask.
tuist project create <you>/rockyfeed --build-system xcode

# 3. Point this checkout at it: put the handle in app/Tuist.swift
#
#      import ProjectDescription
#
#      let tuist = Tuist(
#          fullHandle: "<you>/rockyfeed",
#          project: .tuist()
#      )

# 4. Build through tuist, which uploads the build when it finishes.
cd app
tuist xcodebuild build \\
  -workspace RockyFeed.xcworkspace \\
  -scheme RockyFeed \\
  -destination 'generic/platform=iOS Simulator' \\
  -derivedDataPath .workshop/DerivedData \\
  -quiet
cd ..

# If it says the upload timed out, that is bandwidth, not you. Retry with:
#   cd app && tuist inspect build --derived-data-path .workshop/DerivedData

# Then: Validate my work, and What can it see that you could not.`);

const validate = async (): Promise<ValidationResult> => {
  const checks: CheckResult[] = [];

  const who = await tuistWhoami();
  checks.push({
    label: "Signed in to tuist.dev",
    ok: who !== null,
    detail: who ? undefined : "Run `tuist auth login`. It opens a browser.",
  });

  const handle = await tuistFullHandle();
  const hasHandle = handle !== null && handle.includes("/");
  checks.push({
    label: "app/Tuist.swift points at a project",
    ok: hasHandle,
    detail: hasHandle
      ? undefined
      : "No fullHandle in app/Tuist.swift. Without it, nothing you do reaches the server.",
  });

  if (handle && who) {
    // Catch the copy-paste: our handle is in the solution branch, and it is not
    // theirs. Their builds would upload nowhere, or somewhere they can't read.
    const ownsIt = handle.startsWith(`${who}/`) || handle.split("/")[0] !== "marek";
    checks.push({
      label: "...and it's your project, not ours",
      ok: ownsIt,
      detail: ownsIt
        ? undefined
        : `Tuist.swift says "${handle}", but you're signed in as "${who}". That's the ` +
          `workshop author's handle — create your own project and use that.`,
    });

    const projects = await tuistProjects();
    const exists = projects.includes(handle);
    checks.push({
      label: "The project exists on the server",
      ok: exists,
      detail: exists
        ? undefined
        : `"${handle}" isn't in your project list. Run \`tuist project create ${handle} ` +
          `--build-system xcode\`.`,
    });
  }

  return {
    checks,
    hint: "Sign in, create a project, put the handle in Tuist.swift, build with `tuist xcodebuild`.",
  };
};

const whatItSees = `${brand.bold("Go and look at it.")}

  ${brand.accent("https://tuist.dev/<you>/rockyfeed/builds/build-runs")}

That is a build you already ran, on a machine nobody else has, now visible to
anyone on the project.

${brand.bold("What is up there that was not in your terminal")}

  ${brand.dim("·")} how long it took, and which targets ate the time
  ${brand.dim("·")} the build settings it actually resolved
  ${brand.dim("·")} whether it was clean or incremental
  ${brand.dim("·")} who ran it, on what, and when

${brand.bold("Why this is the task and not a footnote")}
You spent all morning learning that "the build is slow" is not a claim you can act
on. A number, with a spread, that you can repeat — that is a claim. But you took
those numbers by hand, once, on one laptop, on a Tuesday.

Nobody does that twice. The build gets slower a second at a time, and a second at
a time is invisible unless something is watching. This is the thing that watches.

${brand.bold("The honest limitation")}
One build is one dot. A dashboard with a single dot on it tells you nothing that
your terminal did not already say. It becomes useful in about a fortnight, when it
has enough dots to have a shape — and that is exactly why you set it up before you
need it, rather than the week the complaints start.

${brand.dim("This is also what makes the next two tasks possible: the remote cache needs")}
${brand.dim("the same project, and the MCP has nothing to answer questions about until")}
${brand.dim("builds are flowing.")}`;

export const task10: WorkshopTask = {
  id: 10,
  slug: "nobody-else-can-see-it",
  stage: "The server",
  title: "Nobody else can see it",
  summary: "Your numbers live on one laptop. Put them somewhere the team can see.",
  brief,
  reveals: [
    { id: "hint", label: "Give me a hint", hint: "The commands, and where the handle goes", title: "Hint", body: hint },
    { id: "commands", label: "Show me the commands", hint: "The full answer, copy-pasteable", title: "The commands", body: commands, copyable: true },
    { id: "sees", label: "What can it see that you couldn't?", hint: "And what one dot is worth", title: "What the dashboard knows", body: whatItSees },
  ],
  validate,
  solutionBranch: "solutions/09",
  stuckNote:
    `There is no branch for this one, and there cannot be: the answer contains ${brand.bold("your")}\n` +
    `account handle, and ours would upload your builds into a project you cannot read.\n\n` +
    `${brand.bold("If it will not go:")}\n\n` +
    `  ${brand.dim("auth login hangs")}        → a browser window is waiting somewhere behind Xcode\n` +
    `  ${brand.dim("create is interactive")}   → add ${brand.accent("--build-system xcode")}\n` +
    `  ${brand.dim("upload times out")}        → bandwidth. It is a multipart upload with URLs that\n` +
    `                          expire after two minutes; on a slow link it dies partway\n` +
    `                          through. Retry on a better one — nothing is wrong with\n` +
    `                          your setup.\n\n` +
    `${brand.dim("We hit that last one for an entire afternoon on a 90 KB/s link. The same")}\n` +
    `${brand.dim("command worked first try at 2 MB/s. If the room's wifi is bad, this task and")}\n` +
    `${brand.dim("the next are the two that will suffer.")}`,
};
