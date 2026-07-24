import { remoteCacheReachable, tuistFullHandle } from "../measure.js";
import { brand } from "../theme.js";
import { shell } from "../ui.js";
import type { CheckResult, ValidationResult, WorkshopTask } from "./types.js";

const brief = `${brand.bold("Your cache has exactly one member, and it is you.")}

Task 6 was the best number of the day: ${brand.bold("3.3s")}, because ${brand.dim("tuist cache")} handed the
build eleven prebuilt modules instead of eleven modules to compile.

Every one of those binaries is in ${brand.accent("~/.cache/tuist")}. On your laptop. Nobody else has
them. Which means:

  ${brand.dim("·")} the new hire spends their first morning building what you already built
  ${brand.dim("·")} CI, which is a fresh machine every single time, ${brand.bold("never")} hits it
  ${brand.dim("·")} you lose it the day you clear caches to fix something unrelated

Task 5 ended with a rule you found by measuring: ${brand.bold("a cache your CI never restores")}
${brand.bold("makes every run worse.")} Right now that describes your cache exactly. It is a cache
of one.

${brand.bold("Your job")}
Make the cache shared, and prove it — by throwing away your local copy and
watching the binaries come back from somewhere else.

  ${brand.dim("·")} warm the remote cache from this machine
  ${brand.dim("·")} delete your local binaries entirely
  ${brand.dim("·")} generate, and watch the binaries come down from the server

${brand.dim("The last step is the only one that proves anything. Anyone can upload.")}`;

const hint = `${brand.bold("You already did the setup")}
The ${brand.dim("fullHandle")} from task 9 is the whole configuration. ${brand.dim("tuist cache")} has been
trying to talk to a server this entire time; until task 9 there was not one.

${brand.dim("tuist cache")} now does two things at once: it builds each module and ${brand.bold("uploads")}
the binary to the server. Its summary reports hits, misses, and what got stored — but
a cache summary on your own machine is not proof. That comes next.

${brand.bold("Proving it, rather than hoping")}
Warming again on the same machine reads your ${brand.bold("local")} copy and proves nothing — you
would be reading your own homework. The only honest test is to destroy the local
copy and watch the build fetch the modules from somewhere else.

The local binaries live in ${brand.accent("~/.cache/tuist/Binaries")}. Delete that directory — it
is exactly the state a new colleague or a fresh CI runner is in, every time — then
run ${brand.dim("tuist generate RockyFeed")} and read what it prints:

  ${brand.dim("Using cache binaries for the following targets: ...")}

${brand.dim("Those modules are coming down from the server. That line is the entire task.")}

${brand.bold("⚠️ Do not run tuist cache config on a projector")}
It prints your cache token — a live credential with read and write access to
every project your account can reach. It is useful for debugging and it is not
something to put on a screen in front of forty people.

${brand.bold("Both caches, not one")}
You now have two: Xcode's compilation cache from task 5 (per compile job, the CAS
under ${brand.dim(".workshop/")}) and Tuist's module cache from task 6 (per module,
${brand.dim("~/.cache/tuist")}). Task 9's handle makes the module cache shared. The compilation
cache is still yours alone — see the last reveal for why that is harder.`;

const commands = shell(`# Run from app/, one at a time.

# 1. Start as a fresh machine: throw away every binary you have locally. Nothing is
#    on the server yet either — you set the handle in task 9 but never warmed it.
rm -rf ~/.cache/tuist/Binaries

# 2. Generate the focused project, before warming anything. Local is empty and the
#    remote is empty, so there is nothing to pull: the modules come in as source you
#    would have to compile, with no "Using cache binaries" line. A cache of one, with
#    its one member gone.
tuist generate RockyFeed --no-open

# 3. Warm the cache. With the fullHandle set, this builds each module once and
#    UPLOADS the binaries to the server — where teammates and CI can reach them.
tuist cache

# 4. Become the fresh machine one more time. The difference now: the server has the
#    binaries; your laptop does not. (Delete again, or step 5 just reads the local
#    copy the warm repopulated and proves nothing.)
rm -rf ~/.cache/tuist/Binaries

# 5. Generate again. Local is empty, so tuist pulls the binaries straight from the
#    remote — watch "Using cache binaries for the following targets". This machine
#    compiled none of them. (On a weak network that download is slow and visible;
#    it is real, and why you run the server tasks on a solid connection.)
tuist generate RockyFeed --no-open

# Then: Validate my work, and So who is this actually for.`);

const validate = async (): Promise<ValidationResult> => {
  const checks: CheckResult[] = [];

  const handle = await tuistFullHandle();
  checks.push({
    label: "The project is still wired up from task 9",
    ok: handle !== null,
    detail: handle ? undefined : "No fullHandle in app/Tuist.swift — go back to task 9.",
  });

  // Asks whether the remote cache answers for this project. Deliberately does
  // not print what it gets back: that response contains a live token.
  const reachable = await remoteCacheReachable();
  checks.push({
    label: "The remote cache is reachable for this project",
    ok: reachable,
    detail: reachable
      ? undefined
      : "Tuist can't get remote cache config. Check `tuist auth whoami` and that the handle in " +
        "Tuist.swift is a project you own.",
  });

  return {
    checks,
    hint:
      "Set the handle in task 9 first. Then `tuist cache`, delete ~/.cache/tuist/Binaries, and " +
      "`tuist generate RockyFeed` — the \"Using cache binaries\" line is the proof.",
  };
};

const whoIsItFor = `${brand.bold("What you should have seen")}

  ${brand.dim("first generate")}  local and remote both empty — modules arrive as source, no cache line
  ${brand.dim("last generate")}   ${brand.success("Using cache binaries for the following targets: ...")}

Eleven modules that this machine never compiled, pulled straight from the server.
Building them from source is roughly ${brand.bold("20s")} on a warm laptop that has already
resolved its packages — and a real first morning, on a fresh machine, is worse. The
pull itself is bandwidth-bound: quick on a solid link, slow and very visible on a
weak one — which is exactly why the server tasks want a real connection.

${brand.bold("So who is this for?")}
Not you. You already had those binaries. It is for:

  ${brand.dim("·")} the person who joins in March and clones this repo
  ${brand.dim("·")} every CI run, which is a brand new machine with nothing on it
  ${brand.dim("·")} you, next week, after you cleared your caches chasing something else

${brand.bold("This is where task 4 finally gets paid.")}
Splitting the monolith bought you a faster inner loop and cost you a per-module tax
on the clean build — too small to see at this scale, but real. Here is what it was
really for: a monolith is one module, so it is one cache entry, so it is one hash.
Change anything and the whole thing misses — for everyone, on every machine,
forever. Fifteen modules means fifteen hashes, and a change to one leaves fourteen
valid.

Cached monolith: ${brand.bold("8.1s")}. Cached split: ${brand.bold("3.3s")}. The split was never the
optimisation. It was what made the optimisation possible.

${brand.bold("The other cache is still yours alone")}
Xcode's compilation cache (task 5) is per compile job, and there are thousands of
tiny objects in it. The talk calls that ${brand.bold("latency-bound")}: sharing it means
thousands of round-trips, and over a network that is a very different problem from
shipping fifteen ${brand.bold("bandwidth-bound")} module binaries. Same idea, opposite shape —
which is why the module cache is the one that goes remote first.

${brand.dim("Now the trade from task 5 has changed, and it is worth saying out loud. A cold")}
${brand.dim("cache was +47% because filling one is not the same work as reading one. On CI,")}
${brand.dim("a remote cache means the runner never fills anything — it only reads. That is")}
${brand.dim("the case the p99 bar in the talk was warning you about, and this is the fix.")}`;

export const task10: WorkshopTask = {
  id: 10,
  slug: "a-cache-of-one",
  stage: "The server",
  title: "A cache of one",
  summary: "Your 3.3s only exists on your laptop. Share it, and prove it.",
  brief,
  reveals: [
    { id: "hint", label: "Give me a hint", hint: "Where the binaries live, and how to prove it", title: "Hint", body: hint },
    { id: "commands", label: "Show me the commands", hint: "The full answer, copy-pasteable", title: "The commands", body: commands, copyable: true },
    { id: "who", label: "So who is this actually for?", hint: "And where task 4 gets paid", title: "Who it's for", body: whoIsItFor },
  ],
  validate,
  solutionBranch: "solutions/09",
  stuckNote:
    `Nothing to check out — this task is your account, your cache, your machine.\n\n` +
    `${brand.bold("If the last generate does not say \"Using cache binaries\":")}\n\n` +
    `  ${brand.dim("modules arrive as source")} → you deleted the wrong directory. It is\n` +
    `                           ${brand.accent("~/.cache/tuist/Binaries")}, not ~/.cache/tuist/BinaryCache.\n` +
    `  ${brand.dim("nothing is pulled")}        → nothing was ever uploaded. Check the handle,\n` +
    `                           and that the first ${brand.accent("tuist cache")} said "stored".\n` +
    `  ${brand.dim("the download hangs")}       → bandwidth, same as task 9.\n\n` +
    `${brand.dim("Alamofire and Kingfisher will not appear in that line — external packages")}\n` +
    `${brand.dim("are cached separately. Eleven of fifteen modules is the win.")}`,
};
