import { tuistFullHandle, tuistWhoami } from "../measure.js";
import { brand } from "../theme.js";
import { shell } from "../ui.js";
import type { CheckResult, ValidationResult, WorkshopTask } from "./types.js";

const brief = `${brand.bold("The last task is the one you will actually still be doing in March.")}

Everything so far was a change you made once. This one is a habit.

You now have builds landing on a server. In a fortnight there will be hundreds,
from everyone, including CI. That is a pile of data nobody has time to open a
dashboard and stare at — which is how a build gets slower a second at a time
without anyone noticing, the same way it did before today.

${brand.bold("Your job")}
Connect an AI agent to that data, and ask it the questions you would never
bother to click through for.

  ${brand.accent("https://tuist.dev/mcp")}

Tuist hosts an MCP endpoint. Point Claude Code, Claude Desktop, or Cursor at it,
and your build history becomes something you can ask questions of in English.

${brand.dim("Whatever you use as an agent, the endpoint is the same. The hint has the")}
${brand.dim("one-liner for Claude Code.")}

${brand.bold("Then ask it something you actually want to know.")} Not a demo question — a real
one. The reveal has the ones worth asking, and the reason each is hard to answer
any other way.`;

const hint = `${brand.bold("Connecting it")}

  ${brand.accent("claude mcp add --transport http tuist https://tuist.dev/mcp")}

For Claude Desktop: Settings → Connectors → Add custom connector, name ${brand.dim("tuist")},
URL ${brand.dim("https://tuist.dev/mcp")}. Cursor: Settings → Tools & Integrations → MCP Tools,
same pair.

${brand.bold("It will say it needs authentication, and it means it.")}
The endpoint is scoped to your account — it will not answer anything until you
complete an OAuth round-trip in a browser. In Claude Code that is ${brand.accent("/mcp")}, then
pick ${brand.dim("tuist")}, then authenticate. Expect a browser window.

${brand.dim("That gate is the right behaviour. It is your build data, and the endpoint is a")}
${brand.dim("public URL. But it does mean this task cannot work offline, and it is the third")}
${brand.dim("in a row that needs the wifi to hold.")}

${brand.bold("What it can reach")}
Builds, tests, projects, bundles, and Tuist's own docs. Most of it is read-only
and scoped to what your account can already see — it is a lens on the server, not
a second copy of it.

${brand.bold("It has nothing to say yet")}
You have uploaded ${brand.bold("one")} build. Ask it about trends and it will tell you about one
build, honestly and uselessly. That is not a fault; it is what a fortnight of data
is for. Ask it about the build you have, and it will tell you things you did not
type.`;

const commands = shell(`# 1. Add the connector.
claude mcp add --transport http tuist https://tuist.dev/mcp

# 2. Authenticate. In Claude Code:
#      /mcp    then pick tuist, then authenticate
#    A browser window opens. It will not answer anything until you do this.

# 3. Check it is connected.
claude mcp list

# 4. Now ask it something. In your agent, not in this runner:
#
#      "What were the slowest targets in my last RockyFeed build?"
#      "Did my last build hit the module cache, and which targets missed?"
#      "Do I have any flaky tests?"
#
# Then: Validate my work, and What to actually ask it.`);

const validate = async (): Promise<ValidationResult> => {
  const checks: CheckResult[] = [];

  const who = await tuistWhoami();
  checks.push({
    label: "Still signed in to tuist.dev",
    ok: who !== null,
    detail: who ? undefined : "Run `tuist auth login`.",
  });

  const handle = await tuistFullHandle();
  checks.push({
    label: "There's a project for it to talk about",
    ok: handle !== null,
    detail: handle ? undefined : "No fullHandle in app/Tuist.swift — tasks 10 and 11 first.",
  });

  // We can't check this one, and pretending otherwise would be worse than
  // admitting it: the connector lives in your agent's config, not in this repo,
  // and its OAuth token is somewhere we have no business reading.
  checks.push({
    label: "The MCP connector — you'll have to be the judge",
    ok: true,
    detail: undefined,
  });

  return {
    checks,
    hint: "The runner can't see inside your agent. If it answers a question about your build, it works.",
  };
};

const whatToAsk = `${brand.bold("Questions worth asking it")}

${brand.bold("Now, with one build:")}

  ${brand.dim("\"What were the slowest targets in my last RockyFeed build?\"")}
  ${brand.dim("\"Which targets missed the module cache, and why?\"")}
  ${brand.dim("\"What build settings did that build actually resolve?\"")}

You could get all of that by clicking. The difference is that you will ask, and
you would not have clicked.

${brand.bold("In a fortnight, when it has a shape:")}

  ${brand.dim("\"Has our clean build time moved this month?\"")}
  ${brand.dim("\"What is our cache hit rate on CI versus locally?\"")}
  ${brand.dim("\"Which test is flakiest, and how many runs has it cost us?\"")}
  ${brand.dim("\"Did the PR that landed on Tuesday make the build slower?\"")}

That last one is the whole workshop in a sentence. This morning you learned that
"the build is slow" is not actionable and "22.5s ± 1.8s" is. That question is the
same standard applied to a codebase that keeps moving, without anyone having to
remember to run hyperfine on a Tuesday.

${brand.bold("What it cannot do")}
It reads. It will not fix your graph, and it does not know that ${brand.accent("CoreDomain")} is a
bottleneck because eight targets route through it — you know that, because you
measured it in task 6. An agent with your build history is a faster way to notice
something is wrong. Deciding what to do about it is still the job you spent today
learning.

${brand.bold("And it can be confidently wrong.")}
It is a language model reading a database. Ask it for a number and then check the
number. If today taught anything, it is that a plausible answer and a measured one
are different things — we spent an afternoon believing splitting the god module
would speed up the build, and the only reason we know it does not is that we ran
it.

${brand.dim("Same rule as every task today. Do not trust it. Measure it.")}`;

export const task12: WorkshopTask = {
  id: 12,
  slug: "ask-it-what-changed",
  stage: "The server",
  title: "Ask it what changed",
  summary: "Point an agent at your build history, and make noticing automatic.",
  brief,
  reveals: [
    { id: "hint", label: "Give me a hint", hint: "The endpoint, and the auth gate", title: "Hint", body: hint },
    { id: "commands", label: "Show me the commands", hint: "The full answer, copy-pasteable", title: "The commands", body: commands, copyable: true },
    { id: "ask", label: "What should I actually ask it?", hint: "Now, and in a fortnight", title: "What to ask", body: whatToAsk },
  ],
  validate,
  solutionBranch: "solutions/09",
  stuckNote:
    `Nothing to check out — this one lives in your agent's config, not in this repo.\n\n` +
    `${brand.bold("If it will not connect:")}\n\n` +
    `  ${brand.dim("\"Needs authentication\"")}   → expected. ${brand.accent("/mcp")} → tuist → authenticate. It is an\n` +
    `                          OAuth flow and it opens a browser.\n` +
    `  ${brand.dim("answers nothing useful")}  → you have uploaded one build. It is not wrong, it\n` +
    `                          is early. Come back in a fortnight.\n` +
    `  ${brand.dim("no agent to hand")}        → this is the one task you can watch someone else do\n` +
    `                          and lose nothing. The endpoint is a URL; it will still\n` +
    `                          be there on Monday.`,
};
