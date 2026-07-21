# Running the workshop — facilitator notes

Run-of-show for whoever's running the workshop. Lives in `maintainer/`, which the
root README tells attendees to ignore. The **Type this live** blocks under each
task are generated from the task source by `mise run cheatsheet` — edit the tasks,
re-run it, and they refresh. Everything else here is hand-written; edit freely.

> **State: all twelve tasks built and verified.** A full day — roughly 7h of task
> time plus breaks. Every number below is measured on the current sample.
>
> Tasks 10–12 need the network. See the bandwidth warning below; it is the single
> most likely way to lose the afternoon.

---

## The spine of the day: a trade you make on purpose

This is the argument the whole day builds. Know it cold before you run this.
Measured together in one quiet pass (M3 Pro, 11 cores):

| | clean build | incremental |
| --- | --- | --- |
| Monolith | ~15–19s | **3.4s** |
| Split, no cache | **17.6s** ← ≈ flat | **2.6s** ← −24% |
| **Split + module cache** | **3.2s** ← ~5–6× the uncached build | ~2.9s |

**Task 4 is a trade, and the trade is the lesson — but be honest about which side
reproduces.** Two things hold every time you measure them:

- **The incremental build gets faster** (3.4s → 2.6s). Touch one file, relink a
  3-file app instead of a 90-file one. This is the reliable, felt-every-day win.
- **The module cache is the payoff** (3.2s — ~5–6× the uncached clean build, and
  the monolith even *with* a cache only reaches 8.1s because its app is one 90-file
  cache entry).

The clean-build **cost** of splitting is real in principle — a dozen frameworks to
link, sign, embed, and no extra parallelism — but on a codebase RockyFeed's size it
is about the size of the measurement noise, so it hides. Across sessions the
monolith clean has run 14.9–18.8s and the split 17.6–22.8s: **overlapping ranges.**
Do **not** promise the room a "+53% regression" — it won't reliably show. Say the
true thing: *the tax scales with the graph, and this graph is tiny; on a real app
you'd feel it.*

**The split is not the clean-build optimisation. The split is what makes the
optimisation possible.** That's your "granularity is the whole game" slide — and the
honest version is stronger than a manufactured regression: modularization costs you
something small now, buys a faster inner loop now, and unlocks a cache that later
makes the clean build fall off a cliff.

> Quote **directions and ratios**, never seconds — absolute numbers swing 20–30%
> with machine state. The split→cache incremental (2.6 → 2.9) is a wash: the cache
> does **not** speed the inner loop, the *split* did. The one rock-solid number is
> the cached split (~3.2s).

### Why Task 2 no longer blames the graph

I built Task 2 on "your cores are idle *because of the god module*", reshaped the
whole sample trying to make it true, and the numbers refused twice: splitting
moves the speedup from 2.96× to 2.93× — i.e. not at all. **Xcode already compiles
the files inside a target in parallel.** There was never a queue to unlock.

Task 2 now walks people to that obvious explanation and knocks it down. The real
ceiling is Swift compilation itself; the conclusion is *you can't arrange your way
out of this, you can only stop doing the work* — which is the rest of the day.

### The sharp edge worth landing

Change something deep (`Networking`) and **8 of 15 targets miss**, because
every module above carries its hash. Everything routes through `Domain` — the
split grew a *smaller god module in the middle*. Splitting isn't the end of the
work; the shape decides what a change costs. That's the bit to send them home with.

## Before the day

### What attendees need

- **Xcode 26+** with an iOS simulator runtime (Settings › Components)
- **mise** — everything else is pinned; hyperfine is native arm64, no Rosetta
- ~3 GB free disk: DerivedData plus a compilation cache

### ⚠️ Pre-flight the network, or lose 20 minutes

The first `xcodebuild -resolvePackageDependencies` **git-clones Alamofire and
Kingfisher from GitHub**. Thirty people doing that at once on conference wifi is
the single most likely way to lose the start of the day.

Send this the day before:

```bash
git clone <repo> && cd scaling-swift-development-workshop
mise install
mise run workshop          # launches once, creates .workshop/
xcodebuild -resolvePackageDependencies \
  -project app/RockyFeed.xcodeproj -scheme RockyFeed \
  -derivedDataPath .workshop/DerivedData
```

If they arrive cold, do it as a room-wide first step and talk over it — it's
on-topic. "You are all waiting on a git clone. Hold that thought" is a fair
opening for a day about resolution.

### Your own prep

- Know your own numbers (below) so you can spot when someone's are wrong.
- Have the solution branches to hand: `solutions/03` (generated), `solutions/04`
  (split), `solutions/05` (cache).
- A pair-buddy plan for whoever's Xcode is broken.

---

## The arc

| | | state |
| --- | --- | --- |
| 1 | Measure the baseline | ✅ solid |
| 2 | Your cores are idle | ✅ reframed: why more cores won't save you |
| 3 | Generate it with Tuist | ✅ solid |
| 4 | Split the god module | ✅ a trade: faster inner loop, clean-build tax too small to see here |
| 5 | Reuse, don't recompute (compilation cache) | ✅ solid, numbers need re-measuring |
| 6 | Cache whole modules (module cache) | ✅ the payoff |
| 7 | Test only what changed | ✅ selective testing + the flaky test |
| 8 | The build that lies | ✅ hermeticity |
| 9 | Make CI pay for it | ✅ the capstone — nothing to measure, on purpose |

Rough shape of the day: **1–2 before the first break** (measure, and find the
ceiling), **3–4 to lunch** (generate, then split — a trade, not a regression), **5–6 after**
(the payoff), **7–9 to close** (the same sentence, three more times).

Rhythm per task: **brief → let them struggle → hint → commands → discuss.** The
struggle isn't filler. Release the commands early and they leave having watched
you work.

## How to run the room

Most people will follow your lead, so **you drive and they mirror.** For each task:

1. **Read the brief aloud** (or let them read it in the runner) — the goal and why,
   never the how.
2. **Give a few minutes to attempt it.** Not every task, and not to completion —
   just long enough that the commands mean something when they arrive. The tasks
   worth real solo time are **1** (measuring), **4** (sketching the module split),
   and **8** (finding what makes the build non-deterministic). The rest you can
   move through faster.
3. **Reveal the hint** when the room stalls, then **type the commands** and have
   them mirror you. Each task's **Type this live** block sits under that task's
   heading below, with everything you need to paste inline — where the runner tells
   attendees to fetch a manifest from a solution branch, this doc shows the whole
   file, so you can follow it end to end without opening anything else.
4. **Show the payoff.** Where a task has a solved branch, jump to it and point at
   the one thing that matters (the graph, the setting, the number). The **Show the
   solved state** block under each task has the checkout recipe.
5. **Discuss** before moving on. The discussion beats are in each task's section.

**Have them commit after each task passes.** `git add -A && git commit -m "task N"`
gives every attendee a per-task checkpoint: if a later task — or the flaky test, or a
stray edit — breaks the build, they reset to the last green commit instead of unpicking
it by hand, with the solution branch always there as a longer fallback. Generated files
(the project, `.workshop/`, `.build/`, `RockyFeed.xcworkspace/`) are gitignored, so each
commit stays to the source that matters: `Project.swift`, the module imports, the stamp
script, `ci.yml`. Task 3's `git rm --cached` of the pbxproj just rides along in that
task's commit, which is correct.

Those two blocks are generated from the task source by **`mise run cheatsheet`**,
so they can't drift from what attendees actually see. Re-run it after any task
change. Don't hand-edit between the `<!-- COMMANDS -->` markers — it gets
overwritten.

---

## Reference numbers (M3 Pro, 11 cores — for comparison, not truth)

Measured **after** the sample reshape. Anything you remember from earlier drafts
is stale.

Clean-build numbers **swing 20–30% with machine state** — quote ratios, not
seconds. The incrementals and the cached split are the stable ones.

| | |
| --- | --- |
| **Incremental (monolith)** | **3.4–4.0s** — touch RootView.swift, rebuild |
| **Incremental (split)** | **2.6s ± 0.1s** — the split's inner-loop win (~−25 to −35%) |
| **Incremental (split + cache)** | **~2.9s** — a wash vs the split; cache is for clean builds |
| **Split + module cache (clean)** | **3.2s ± 0.06s** — the payoff, rock-solid |
| Clean build (monolith) | 14.9–18.8s across sessions — noisy |
| Clean build (split) | 17.6–22.8s across sessions — noisy; **overlaps the monolith** |
| Serial (`-jobs 1`, monolith) | 44.1s → **2.96×** on 11 cores |
| Generated (Tuist, monolith) | ~16.8s — not slower than hand-written |
| Monolith + module cache | 8.1s — the cache alone only gets you here (90-file app) |

> The split's clean-build "regression" is inside the session-to-session noise on
> this sample. Don't present it as a crisp number. The trade is: reliable inner-loop
> win + cacheability, for a clean-build tax that's real but too small to see here.

> Task 1 now measures a real **incremental build** (edit a file, rebuild), not a
> no-op. The incremental numbers above were taken together on one machine; treat
> the split→cache incremental as flat.

**Task 5, the compilation cache** — re-measured on the current sample, against the
split (which is what they'll be sitting on by then, *not* Task 1's monolith):

| | | |
| --- | --- | --- |
| Split, no cache | 19.9s ± 0.8s | Task 4's state |
| **Cache cold** | **29.2s ± 2.9s** | **+47% — slower than no cache** |
| **Cache warm** | **11.3s ± 1.4s** | **1.8× faster** |
| CAS on disk | 471 MB | |

> The old figures (7.4s / 41.9s / 722 MB) are dead — they predated the reshape and
> compared against the wrong baseline. The lesson is unchanged and the magnitudes
> are milder: warm ≈ **1.8×** faster, cold ≈ **47%** slower. Still the whole point
> of the task.

> **Absolute numbers drift between sessions; ratios don't.** The same split
> measured 22.8s one afternoon and 19.9s the next morning — thermal state and
> whatever else is running. Quote ratios from the front, not seconds, and expect
> the room's spread to be wide.

---

## Task 1 — Measure the baseline (~35 min)

> *Step zero: you can't improve what you can't see.*

1. **Brief (5 min).** States the goal — two numbers saved as JSON — and names
   hyperfine. It does not give the command.
2. **Let them try (10 min).** Resist helping for five. Walk the room and watch for
   who wipes all of DerivedData.
3. **Hint (5 min).** Teaches the reasoning, not the flags: the `--prepare` is what
   decides *which* build you measure — wipe the products → clean build; touch a
   file → incremental build — and both need `--warmup`, because **the first run of
   anything is a lie** (it does work the others never repeat).
4. **Commands + run (~5 min waiting).** Say out loud that the wait *is* the point.
5. **Validate, then discuss (10 min).**

<!-- COMMANDS:1:START — generated by `mise run cheatsheet`, do not edit by hand -->

**Type this live** (they mirror you):

```sh
# Run these from app/, one at a time, and watch each one.

# Set the build command once. Every benchmark today reuses it, which is
# what keeps the comparisons honest.
export BUILD="xcodebuild build \
  -project RockyFeed.xcodeproj \
  -scheme RockyFeed \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ../.workshop/DerivedData \
  -quiet"

# 1. Resolve the packages once, untimed. Otherwise your first clean build
#    also clones Alamofire and Kingfisher, and you have measured resolution
#    instead of compilation.
xcodebuild -resolvePackageDependencies \
  -project RockyFeed.xcodeproj \
  -scheme RockyFeed \
  -derivedDataPath ../.workshop/DerivedData

# 2. Clean build. --prepare wipes the products before each run.
#    --warmup throws the first, cold run away.
hyperfine --runs 3 --warmup 1 \
  --prepare 'rm -rf ../.workshop/DerivedData/Build' \
  --export-json ../.workshop/measurements/baseline-clean-build.json \
  "$BUILD"

# 3. Incremental build. --prepare touches one file so each run recompiles it:
#    the everyday edit-build loop. --warmup builds the tree first, so run 1
#    is not measuring a real build.
hyperfine --runs 3 --warmup 1 \
  --prepare 'touch RockyFeed/RootView.swift' \
  --export-json ../.workshop/measurements/baseline-incremental.json \
  "$BUILD"

# A couple of minutes altogether. That wait is not lost time. It is the wait
# your team pays all day, and the reason any of this is worth doing.
#
# Then: Validate my work.
```

**Show the solved state:**

```sh
# No branch — a baseline is measured, not checked out. Run the commands above, live.
```

<!-- COMMANDS:1:END -->

### The discussion beat

> "Who got a σ bigger than a fifth of their mean? What did your first run do that
> the others didn't?"

Both mistakes it catches are ones I made building this:

- **Packages not resolved** → run 1 cloned them: **47.6s ± 25.7s** when the honest
  number was ~22s.
- **No `--warmup`** → run 1 was cold in ways that never repeat:
  `[44.5s, 26.1s, 24.7s]`.

Validation catches both and explains them, so you aren't debugging 30 laptops.

### Common failures

| Symptom | Cause |
| --- | --- |
| `hyperfine: command not found` | not in a mise shell — `mise run workshop` handles PATH itself |
| Benchmark runs, then "cannot write" | `.workshop/measurements/` missing; the runner creates it on launch |
| Clean build ≈ incremental | clean build's `--prepare` isn't removing products |
| Everything 3× your numbers | slower machine — fine, their baseline is theirs |

### Don't skip

Task 1 has **no solution branch**, deliberately. A baseline measures *their*
machine; a committed number would be someone else's laptop. If someone's stuck,
pair them up — don't hand them a number.

---

## Task 2 — Your cores are idle (~25 min)

> *You have a machine full of cores. Are you using them?*

They measure `-jobs 1` against their baseline: **2.96× out of 11 cores**, about a
quarter of the machine.

**The task deliberately walks them into the wrong answer and then knocks it down.**
The chain — Alamofire/Kingfisher → Core → app — is real, and 2 of Core's 82 files
import the networking libraries while 60 import nothing but SwiftUI. It looks like
the culprit. It isn't: Xcode already compiles the files inside a target in
parallel, so the chain costs three handoffs, not 82 compiles.

Landing point: **the ceiling is Swift compilation itself.** A faster laptop buys a
little; rearranging modules buys nothing (Task 4 proves it); the only way out is to
**stop doing the work**. That sets up the entire rest of the day.

**Ask before the reveal:** *"Guess the number. Write it down."* A prediction they
got wrong is worth more than one they nodded at.

<!-- COMMANDS:2:START — generated by `mise run cheatsheet`, do not edit by hand -->

**Type this live** (they mirror you):

```sh
# Run from app/.

# If BUILD is no longer set in this shell:
export BUILD="xcodebuild build \
  -project RockyFeed.xcodeproj \
  -scheme RockyFeed \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ../.workshop/DerivedData \
  -quiet"

# The same clean build, one job at a time. Takes a couple of minutes:
# that slowness is the measurement, not a problem with it.
hyperfine --runs 1 --warmup 1 \
  --prepare 'rm -rf ../.workshop/DerivedData/Build' \
  --export-json ../.workshop/measurements/serial-clean-build.json \
  "$BUILD -jobs 1"

# Then: Validate my work, and Where did the cores go.
```

**Show the solved state:**

```sh
# No branch — a measurement. Run the -jobs 1 build live, then open the "why" reveal.
```

<!-- COMMANDS:2:END -->

---

## Task 3 — Generate it with Tuist (~40 min)

> *You won't fix the graph while it lives in a pbxproj.*

The point is that the `.xcodeproj` becomes a build artefact — generated,
gitignored, unmergeable-by-nobody. Nothing gets faster, and that's the result.

**Expect roughly flat, and say so up front.** Measured 21.7s → 16.8s: not slower,
slightly faster, much steadier. A *dramatic* win here means the two projects
weren't equivalent and someone measured their own migration bug.

**The load-bearing hint:** the build command changes. Tuist puts the dependencies
beside the app in a **workspace**, so `-project` alone fails with
`unable to resolve module dependency: 'Kingfisher'`.

**Dependencies stay simple here.** Alamofire and Kingfisher go into `Project.swift`
as Xcode-native SPM (`packages:` + `.package(product:)`) — no `Tuist/Package.swift`,
no `tuist install`. That file arrives in **Task 6**, when the module cache needs the
deps to be Tuist's, not Xcode's. One new idea per task; don't introduce it early.

<!-- COMMANDS:3:START — generated by `mise run cheatsheet`, do not edit by hand -->

**Type this live** (they mirror you):

```sh
# Run from app/, one at a time.

# 1. Project.swift IS the task: it describes the whole project in Swift, with
#    Alamofire and Kingfisher declared as SwiftPM packages right in the manifest.
#    It is ~80 lines, so take it verbatim rather than typing it. Open it and read
#    it — the packages: block and the .package(product:) references are the point.
# Create Project.swift — full contents below.

# 2. Mark the Tuist root. One line.
# Create Tuist.swift — full contents below.

# 3. Core stops being its own SwiftPM package — it is a Tuist target now.
git rm --cached Core/Package.swift Core/Package.resolved
rm -f Core/Package.swift Core/Package.resolved

# 4. Generate. No tuist install: the packages are Xcode-native SPM, resolved at
#    build time. (tuist install arrives in Task 6, with the module cache.)
tuist generate --no-open

# 5. The checked-in project becomes a build artefact. Merge conflicts stop here.
git rm -r --cached RockyFeed.xcodeproj
printf 'app/*.xcodeproj\napp/*.xcworkspace\napp/Derived/\n' >> ../.gitignore  # the repo-root ignore

# 6. Re-measure. Note the -workspace (see the hint).
export BUILD="xcodebuild build \
  -workspace RockyFeed.xcworkspace \
  -scheme RockyFeed \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ../.workshop/DerivedData \
  -quiet"

hyperfine --runs 3 --warmup 1 \
  --prepare 'rm -rf ../.workshop/DerivedData/Build' \
  --export-json ../.workshop/measurements/generated-clean-build.json \
  "$BUILD"

# Then: Validate my work.
```

**`Project.swift`** — type this out:

```swift
import ProjectDescription

// RockyFeed, described in Swift instead of stored in a pbxproj.
//
// This is a straight translation of what was already here — the same three
// targets, the same settings, the same monolithic Core. Nothing gets faster in
// this task, and that is the point: first we change *how* the project is
// defined, then we change *what* it says.
//
// What did change: RockyFeed.xcodeproj is now generated and gitignored. It is a
// build artefact, like a .o file. Nobody merges those.

let project = Project(
    name: "RockyFeed",
    packages: [
        .remote(url: "https://github.com/Alamofire/Alamofire", requirement: .upToNextMajor(from: "5.9.0")),
        .remote(url: "https://github.com/onevcat/Kingfisher", requirement: .upToNextMajor(from: "7.11.0")),
    ],
    targets: [
        .target(
            name: "RockyFeed",
            destinations: .iOS,
            product: .app,
            bundleId: "dev.tuist.rockyfeed",
            deploymentTargets: .iOS("17.0"),
            infoPlist: .extendingDefault(with: [
                "UILaunchScreen": [:],
                "UISupportedInterfaceOrientations": ["UIInterfaceOrientationPortrait"],
            ]),
            sources: ["RockyFeed/**"],
            scripts: [
                // Still declaring no inputs and no outputs, still shelling out to
                // git. We have not fixed this — we have only moved where it is
                // written down. It comes back to bite us later.
                .post(
                    path: "Scripts/stamp-build-info.sh",
                    name: "Stamp build info",
                    basedOnDependencyAnalysis: false
                ),
            ],
            dependencies: [
                .target(name: "Core"),
            ]
        ),
        // ⚠️ The god module, faithfully preserved. 82 files, one target, and it
        // owns both third-party dependencies. Task 4 is where this changes.
        .target(
            name: "Core",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.core",
            deploymentTargets: .iOS("17.0"),
            sources: ["Core/Sources/Core/**"],
            dependencies: [
                .package(product: "Alamofire"),
                .package(product: "Kingfisher"),
            ]
        ),
        .target(
            name: "RockyFeedTests",
            destinations: .iOS,
            product: .unitTests,
            bundleId: "dev.tuist.rockyfeed.tests",
            deploymentTargets: .iOS("17.0"),
            sources: ["RockyFeedTests/**"],
            dependencies: [
                .target(name: "RockyFeed"),
                .target(name: "Core"),
            ]
        ),
    ]
)
```

**`Tuist.swift`** — type this out:

```swift
import ProjectDescription

let tuist = Tuist()
```

**Show the solved state:**

```sh
git checkout solutions/03
cd app && tuist generate --no-open && open RockyFeed.xcworkspace   # native SPM: no tuist install
# Point at it: no .pbxproj in git, the workspace is generated from Project.swift.
```

<!-- COMMANDS:3:END -->

---

## Task 4 — Split the god module (~45 min)

> *A trade, not a win — and they see both sides.*

**The task tells them up front it's a two-sided trade, and to measure both.** The
verdict shows the two numbers moving opposite ways:

| | before | after | |
| --- | --- | --- | --- |
| **Clean build** | ~15–19s | ~17–23s | **≈ flat** — per-module tax, lost in noise at this scale |
| **Incremental** | 3.4s | 2.6s | **−24%** — relink a 3-file app, not a 90-file one |

So modularization is a genuine trade: it costs clean-build time and buys inner-loop
time. Land it like this: *"You made your daily edit-build loop faster and your CI
slower. The CI cost is what Task 6 pays back — and it can only pay it back because
you split."*

Someone will object that the clean-build cost is a bad deal. Good — that objection
*is* the lesson, and Task 6 answers it. Don't answer it early.

> ⚠️ **Don't say the module cache speeds up incremental builds.** It doesn't — the
> split does (smaller relink). Measured: split→cache incremental is a wash (2.6 →
> 2.9). The cache's win is the clean build. Keep the two straight.

What else it teaches:

- **The rule**: a module may not depend on something it doesn't use.
- **The file that fights you**: `RemoteImage.swift` imports Kingfisher *and* calls
  `Theme`. Leave it in the design system and every component waits on an image
  library — the original problem, in miniature. It gets its own module.
- **⚠️ Never name a module `CoreServices`.** It's an Apple system framework;
  Clang resolves `<CoreServices/CoreServices.h>` to yours and Kingfisher and
  Alamofire fail to build `MobileCoreServices` with an error naming neither your
  module nor your code. Cost me 12 errors and 20 confused minutes. A monolith
  can't make this mistake — it has one name.
- **Splitting forces API decisions**: the feature views must become `public`;
  `FeedRow` must not (it's internal and has a stored property). `BuildInfo` turned
  out to be in the wrong layer entirely, and moving it into Core tripped Swift 6
  strict concurrency.

<!-- COMMANDS:4:START — generated by `mise run cheatsheet`, do not edit by hand -->

**Type this live** (they mirror you):

```sh
# Run from app/, one at a time.

# 1. The split manifest. Take it verbatim — the layering is the lesson,
#    and typing five .target(...) blocks is not.
# Create Project.swift — full contents below.

# 2. import Core no longer exists. Give every former Core file the three modules
#    every feature target depends on: DesignSystem, Domain, Models. (Crude but
#    honest — an unused import is a warning; you would tidy these per-file later.)
grep -rl '^import Core$' RockyFeed | while read -r f; do
  perl -i -pe 's/^import Core$/import DesignSystem\nimport Domain\nimport Models/' "$f"
done
#    Images is different: only FeaturePlayer and FeatureProfile depend on it, and
#    only their two screens render a remote image. So add Images to just those two.
#    Put it in a feature that does not depend on it and it is a hard "no such module
#    Images" error, not a warning.
perl -i -pe 's/^import Domain$/import Domain\nimport Images/' \
  RockyFeed/Features/Player/PlayerView.swift \
  RockyFeed/Features/Profile/ProfileView.swift

# 3. Four files inside Core now cross a module boundary.
perl -i -pe 's/^import SwiftUI$/import DesignSystem\nimport SwiftUI/' \
  Core/Sources/Core/Images/RemoteImage.swift
perl -i -pe 's/^import Foundation$/import Models\nimport Foundation/' \
  Core/Sources/Core/Session/UserSession.swift \
  Core/Sources/Core/Ranking/RelevanceScoring.swift
perl -i -pe 's/^import Foundation$/import Models\nimport Networking\nimport Foundation/' \
  Core/Sources/Core/Feed/FeedService.swift

# 4. Regenerate.
tuist generate --no-open

# 5. Measure both, the same two shapes as Task 1, new export paths.
export BUILD="xcodebuild build \
  -workspace RockyFeed.xcworkspace \
  -scheme RockyFeed \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ../.workshop/DerivedData \
  -quiet"

# Clean build — expect this to be SLOWER than Task 1.
hyperfine --runs 3 --warmup 1 \
  --prepare 'rm -rf ../.workshop/DerivedData/Build' \
  --export-json ../.workshop/measurements/split-clean-build.json \
  "$BUILD"

# Incremental build — expect this to be FASTER than Task 1.
hyperfine --runs 3 --warmup 1 \
  --prepare 'touch RockyFeed/RootView.swift' \
  --export-json ../.workshop/measurements/split-incremental-build.json \
  "$BUILD"

# Then: Validate my work, and What did it cost.
```

**`Project.swift`** — type this out:

```swift
import ProjectDescription

// RockyFeed, with the god module taken apart.
//
// The rule, applied honestly: a module may not depend on something it does not
// use. Everything below follows from that.
//
// BEFORE — one Core, one app target, and a chain:
//
//   Alamofire  Kingfisher
//        └────┬────┘
//             ▼
//           Core              waiting on an HTTP client it barely uses
//             ▼
//         RockyFeed           every feature, one target
//
// AFTER — the shape from the talk. Features on top, services beneath,
// foundations at the bottom, and no arrows inside a layer:
//
//   Models       DesignSystem            Alamofire   Kingfisher
//        │            │    │                 │           │
//        │            │    └──────── Images ─│───────────┘
//        │            │              │       ▼
//        │            │              │  Networking
//        └────────────│──────────────│───────┘
//                     │              ▼
//                     │         Domain
//                     ▼              ▼
//     FeatureLogin  FeatureFeed  FeatureSearch  FeaturePlayer
//              FeatureProfile  FeatureSettings          ← six, in parallel
//                             ▼
//                         RockyFeed                     ← three files
//
// Nothing moved on disk. A module boundary is a manifest decision — `sources:`
// takes globs, and the folders already said what belonged together.

let coreRoot = "Core/Sources/Core"

/// Every feature needs the design system, the models, and the app's logic.
let featureBase: [TargetDependency] = [
    .target(name: "DesignSystem"),
    .target(name: "Models"),
    .target(name: "Domain"),
]

func feature(_ name: String, needsImages: Bool = false) -> Target {
    .target(
        name: "Feature\(name)",
        destinations: .iOS,
        product: .framework,
        bundleId: "dev.tuist.rockyfeed.feature\(name.lowercased())",
        deploymentTargets: .iOS("17.0"),
        sources: ["RockyFeed/Features/\(name)/**"],
        dependencies: needsImages ? featureBase + [.target(name: "Images")] : featureBase
    )
}

let project = Project(
    name: "RockyFeed",
    packages: [
        .remote(url: "https://github.com/Alamofire/Alamofire", requirement: .upToNextMajor(from: "5.9.0")),
        .remote(url: "https://github.com/onevcat/Kingfisher", requirement: .upToNextMajor(from: "7.11.0")),
    ],
    targets: [
        // The app is now three files: it starts up and picks a tab.
        .target(
            name: "RockyFeed",
            destinations: .iOS,
            product: .app,
            bundleId: "dev.tuist.rockyfeed",
            deploymentTargets: .iOS("17.0"),
            infoPlist: .extendingDefault(with: [
                "UILaunchScreen": [:],
                "UISupportedInterfaceOrientations": ["UIInterfaceOrientationPortrait"],
            ]),
            sources: ["RockyFeed/*.swift"],
            scripts: [
                // Still no declared inputs or outputs, still shelling out to git.
                // Not fixed, only relocated. It comes back to bite us later.
                .post(
                    path: "Scripts/stamp-build-info.sh",
                    name: "Stamp build info",
                    basedOnDependencyAnalysis: false
                ),
            ],
            dependencies: [
                .target(name: "FeatureLogin"),
                .target(name: "FeatureFeed"),
                .target(name: "FeatureSearch"),
                .target(name: "FeaturePlayer"),
                .target(name: "FeatureProfile"),
                .target(name: "FeatureSettings"),
                .target(name: "DesignSystem"),
                .target(name: "Domain"),
            ]
        ),

        // ── Features ──────────────────────────────────────────────────────────
        // Six targets, ~16 files each, none depending on another. This is the work
        // that used to be one 90-file queue.
        feature("Login"),
        feature("Feed"),
        feature("Search"),
        feature("Player", needsImages: true),
        feature("Profile", needsImages: true),
        feature("Settings"),

        // ── Services ──────────────────────────────────────────────────────────

        // The only target that needs Alamofire. One file.
        .target(
            name: "Networking",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.networking",
            deploymentTargets: .iOS("17.0"),
            sources: ["\(coreRoot)/Networking/**"],
            dependencies: [.package(product: "Alamofire")]
        ),

        // RemoteImage is the file that fights you: it imports Kingfisher *and*
        // calls Theme. Leave it in the design system and every component goes back
        // to waiting on an image library — the original problem, in miniature. So
        // it lives alone and pays for its own dependency.
        .target(
            name: "Images",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.images",
            deploymentTargets: .iOS("17.0"),
            sources: ["\(coreRoot)/Images/**"],
            dependencies: [
                .target(name: "DesignSystem"),
                .package(product: "Kingfisher"),
            ]
        ),

        // ⚠️ NOT "CoreServices" — that is an Apple system framework, and naming a
        // module after it makes Clang resolve <CoreServices/CoreServices.h> to
        // yours. Kingfisher and Alamofire then fail to build MobileCoreServices,
        // with an error mentioning neither your module nor your code.
        .target(
            name: "Domain",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.domain",
            deploymentTargets: .iOS("17.0"),
            sources: [
                "\(coreRoot)/Session/**",
                "\(coreRoot)/Storage/**",
                "\(coreRoot)/Feed/**",
                "\(coreRoot)/Ranking/**",
                "\(coreRoot)/Services/**",
            ],
            dependencies: [
                .target(name: "Models"),
                .target(name: "Networking"),
            ]
        ),

        // ── Foundation ────────────────────────────────────────────────────────
        // Both depend on nothing, so both start at t=0 — alongside Alamofire and
        // Kingfisher rather than behind them.

        .target(
            name: "Models",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.models",
            deploymentTargets: .iOS("17.0"),
            sources: [
                "\(coreRoot)/Models/**",
                "\(coreRoot)/Formatting/**",
                "\(coreRoot)/Fixtures/**",
                "\(coreRoot)/BuildInfo/**",
            ]
        ),

        .target(
            name: "DesignSystem",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.designsystem",
            deploymentTargets: .iOS("17.0"),
            sources: [
                "\(coreRoot)/DesignSystem/**",
                "\(coreRoot)/Components/**",
            ]
        ),

        .target(
            name: "RockyFeedTests",
            destinations: .iOS,
            product: .unitTests,
            bundleId: "dev.tuist.rockyfeed.tests",
            deploymentTargets: .iOS("17.0"),
            sources: ["RockyFeedTests/**"],
            dependencies: [
                .target(name: "RockyFeed"),
                .target(name: "Images"),
                .target(name: "Models"),
                .target(name: "Domain"),
            ]
        ),
    ]
)
```

**Show the solved state:**

```sh
git checkout solutions/04
cd app && tuist generate --no-open   # native SPM: no tuist install
tuist graph                 # the module graph, drawn — this is the payoff to SHOW
# Then open the "what did it cost" reveal: incremental faster, clean ~flat (noise at this scale).
```

<!-- COMMANDS:4:END -->

---

## Task 5 — Reuse, don't recompute (~30 min)

> *Same inputs, same output. Fetch it instead of building it.*

One build setting: `COMPILATION_CACHE_ENABLE_CACHING = YES`, project-level, not
per-target — that's what carries it into the external package targets, and
Alamofire and Kingfisher are still most of the build.

**⚠️ It goes in `app/Project.swift`, not Xcode's UI.** The project has been
generated since Task 3, so a setting clicked into Build Settings is erased by the
next `tuist generate` — silently. Someone will do this, re-measure, and find
nothing changed. It's a good moment rather than a bad one: the UI stopping being
the source of truth is the tax generation charges, and a setting in a manifest is
reviewable where a setting somebody clicked eight months ago is archaeology.

**The payoff (15 min).** Let them run *"So what did it cost?"* and read their own
three numbers before you say anything. Their numbers, on this sample, land near:

| | |
| --- | --- |
| Split, no cache | ~20s |
| Cache cold | ~29s — **+47%** |
| Cache warm | ~11s — **1.8×** |

Then:

> "Both are true at once. Warm, you're nearly twice as fast. Cold, you're half
> again slower than having no cache at all. So — do you turn this on for your
> team?"

Landing point: **"we added a cache" and "we got faster" are different claims.** A
CI job that never restores the cache has been made *worse*, on every run. Watch
the hit rate, not whether a cache exists.

There's an **under the hood** reveal (CAS, what goes in a key and why it's
paranoid, why it ignores your graph, why it's latency-bound where a module cache
is bandwidth-bound) which sets up task 6.

**Peek inside the cache (optional, facilitator demo).** Add one more flag to the
build and rebuild with a warm cache — every compile job then narrates its lookup:

```sh
COMPILATION_CACHE_ENABLE_DIAGNOSTIC_REMARKS=YES
```

```
note: Local cache found for key: llvmcas://0fa7467a03df… (in target 'Models')
note: Using CAS output swiftmodule: llvmcas://6d952876943c… (in target 'Models')
note: Using CAS output swiftdoc:    llvmcas://f3398ebf1a56… (in target 'Models')
note: Replay cache hit (in target 'Models')
```

That is the CAS made visible: the key is a hash of everything that could change the
answer, and each *output* — the `.swiftmodule`, the `.swiftdoc`, the generated header —
is a separately-keyed blob it *replays* instead of recompiling. On a cold cache the
same lines read "miss" and it writes them. The store itself is
`.workshop/CompilationCache.noindex/` — a `generic` and a `builtin` tree, ~1,150
content-addressed objects after one build: nothing named by file, everything by hash.
Leave it **off** for the timed runs, though — it is thousands of `note:` lines a build.

<!-- COMMANDS:5:START — generated by `mise run cheatsheet`, do not edit by hand -->

**Type this live** (they mirror you):

```sh
# Run these from app/, one at a time, and watch each one.

# 1. Turn on compilation caching. It is a project-wide build setting, and because the
#    project is generated, it belongs in the manifest, not the Xcode UI (the next
#    tuist generate would silently erase a click there). Add a project settings base:
perl -i -pe 's/^    targets: \[$/    settings: .settings(base: ["COMPILATION_CACHE_ENABLE_CACHING": "YES"]),\n    targets: [/' Project.swift
tuist generate --no-open

# If BUILD is no longer set in this shell:
export BUILD="xcodebuild build \
  -workspace RockyFeed.xcworkspace \
  -scheme RockyFeed \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ../.workshop/DerivedData \
  COMPILATION_CACHE_CAS_PATH=$(pwd)/../.workshop/CompilationCache.noindex \
  -quiet"

# 2. Clean build with the cache warm.
#    The --warmup run does double duty here: it fills the cache, so every
#    timed run is reading one rather than writing one.
hyperfine --runs 3 --warmup 1 \
  --prepare 'rm -rf ../.workshop/DerivedData/Build' \
  --export-json ../.workshop/measurements/cached-clean-build.json \
  "$BUILD"

# 3. Clean build with the cache cold. Products and cache both gone before
#    each run: a fresh CI runner, or the morning after an Xcode update.
#    One run, because it is the expensive one.
hyperfine --runs 1 \
  --prepare 'rm -rf ../.workshop/DerivedData/Build ../.workshop/CompilationCache.noindex' \
  --export-json ../.workshop/measurements/cold-cache-clean-build.json \
  "$BUILD"

# Then: Validate my work, and So what did it cost.
```

**Show the solved state:**

```sh
git checkout solutions/05
# Show the one line: COMPILATION_CACHE_ENABLE_CACHING in app/Project.swift's settings base.
cd app && tuist generate --no-open   # native SPM: no tuist install
# Then measure warm vs cold with the commands above.
```

<!-- COMMANDS:5:END -->

---

## Task 6 — Cache whole modules (~30 min)

> *The one the whole morning has been pointing at. Don't rush it.*

`tuist cache` builds each module once, hashes it, and stores the binary. Then
`tuist generate` swaps the binaries in for the sources, so the build links what it
would have compiled.

**First, the new step — a dependency migration.** Before caching, the deps move
from Xcode-native SPM to `.external` + `Tuist/Package.swift` + `tuist install`.
Why: `tuist cache` only caches **Tuist** targets, so native-SPM Alamofire/Kingfisher
are invisible to it and would rebuild every run. This is the task `Tuist/Package.swift`
finally exists for — and if someone's cached build is slower than ~3s, an un-migrated
dependency is the first thing to check.

**The beats.** Brief (5) → let them run it (10, mostly waiting) → **the payoff (15)**.
The payoff is the whole task; protect the time.

**Their numbers should land near:**

| | |
| --- | --- |
| Split, no cache | ~20s |
| Cached **monolith** | **8.1s** |
| Cached **split** | **3.3s** |

**Land it like this.** Ask the room what the cached monolith gets you — most will
guess "about the same as the split." It doesn't: 8.1s vs 3.3s. Then the sentence
the day has been building to:

> "A monolith is one module, so it's one hash, so it's one cache entry. Change any
> file and *all* of it misses. Fifteen modules is fifteen hashes — change one and
> fourteen are still good. **Task 4 didn't make you faster. It made you cacheable.**"

That's where the split from Task 4 finally pays off, and it's the moment to say
out loud that the split's clean-build cost was a bet on this exact payoff.

**⚠️ The sharp edge — do not skip it.** Changing `Networking` misses **8 of 15**
targets, because everything routes through `Domain`. They split the god module
and grew a smaller one in the middle. Nobody in the room will spot this unless you
point at it, and it's the most useful thing they take home:

> "Splitting isn't a thing you finish. The shape decides what a change costs, and
> your shape still has a bottleneck in it."

**Watch out for:** someone whose cache does nothing because they never ran
`tuist generate` after `tuist cache` — warming the cache doesn't change the project
until you regenerate it.

<!-- COMMANDS:6:START — generated by `mise run cheatsheet`, do not edit by hand -->

**Type this live** (they mirror you):

```sh
# Run from app/, one at a time.

# 1. Move the dependencies into Tuist's hands so tuist cache can see them.
#    Project.swift swaps .package(product:) for .external(name:), and a new
#    Tuist/Package.swift lists the packages. Take both verbatim from the branch:
mkdir -p Tuist
# Create Project.swift — full contents below.
# Create Tuist/Package.swift — full contents below.
printf 'app/Tuist/.build/\n' >> ../.gitignore  # the repo-root ignore

# 2. Resolve them, now that they are Tuist-managed.
tuist install

# 3. Warm the module cache. Slow the first time: it is building every module
#    once and storing it. You have seen this trade before.
tuist cache

# 4. Generate with the app focused. Everything else arrives as a binary.
#    Read what it prints: those are the targets it is not going to build.
tuist generate RockyFeed --no-open

# 5. Same clean build as every other task.
export BUILD="xcodebuild build \
  -workspace RockyFeed.xcworkspace \
  -scheme RockyFeed \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ../.workshop/DerivedData \
  COMPILATION_CACHE_CAS_PATH=$(pwd)/../.workshop/CompilationCache.noindex \
  -quiet"

hyperfine --runs 3 --warmup 1 \
  --prepare 'rm -rf ../.workshop/DerivedData/Build' \
  --export-json ../.workshop/measurements/module-cache-clean-build.json \
  "$BUILD"

# Then: Validate my work, and Was it worth it.
```

**`Project.swift`** — type this out:

```swift
import ProjectDescription

// RockyFeed, with the god module taken apart.
//
// The rule, applied honestly: a module may not depend on something it does not
// use. Everything below follows from that.
//
// BEFORE — one Core, one app target, and a chain:
//
//   Alamofire  Kingfisher
//        └────┬────┘
//             ▼
//           Core              waiting on an HTTP client it barely uses
//             ▼
//         RockyFeed           every feature, one target
//
// AFTER — the shape from the talk. Features on top, services beneath,
// foundations at the bottom, and no arrows inside a layer:
//
//   Models       DesignSystem            Alamofire   Kingfisher
//        │            │    │                 │           │
//        │            │    └──────── Images ─│───────────┘
//        │            │              │       ▼
//        │            │              │  Networking
//        └────────────│──────────────│───────┘
//                     │              ▼
//                     │         Domain
//                     ▼              ▼
//     FeatureLogin  FeatureFeed  FeatureSearch  FeaturePlayer
//              FeatureProfile  FeatureSettings          ← six, in parallel
//                             ▼
//                         RockyFeed                     ← three files
//
// Nothing moved on disk. A module boundary is a manifest decision — `sources:`
// takes globs, and the folders already said what belonged together.

let coreRoot = "Core/Sources/Core"

/// Every feature needs the design system, the models, and the app's logic.
let featureBase: [TargetDependency] = [
    .target(name: "DesignSystem"),
    .target(name: "Models"),
    .target(name: "Domain"),
]

func feature(_ name: String, needsImages: Bool = false) -> Target {
    .target(
        name: "Feature\(name)",
        destinations: .iOS,
        product: .framework,
        bundleId: "dev.tuist.rockyfeed.feature\(name.lowercased())",
        deploymentTargets: .iOS("17.0"),
        sources: ["RockyFeed/Features/\(name)/**"],
        dependencies: needsImages ? featureBase + [.target(name: "Images")] : featureBase
    )
}

let project = Project(
    name: "RockyFeed",
    settings: .settings(base: ["COMPILATION_CACHE_ENABLE_CACHING": "YES"]),
    targets: [
        // The app is now three files: it starts up and picks a tab.
        .target(
            name: "RockyFeed",
            destinations: .iOS,
            product: .app,
            bundleId: "dev.tuist.rockyfeed",
            deploymentTargets: .iOS("17.0"),
            infoPlist: .extendingDefault(with: [
                "UILaunchScreen": [:],
                "UISupportedInterfaceOrientations": ["UIInterfaceOrientationPortrait"],
            ]),
            sources: ["RockyFeed/*.swift"],
            scripts: [
                // Still no declared inputs or outputs, still shelling out to git.
                // Not fixed, only relocated. It comes back to bite us later.
                .post(
                    path: "Scripts/stamp-build-info.sh",
                    name: "Stamp build info",
                    basedOnDependencyAnalysis: false
                ),
            ],
            dependencies: [
                .target(name: "FeatureLogin"),
                .target(name: "FeatureFeed"),
                .target(name: "FeatureSearch"),
                .target(name: "FeaturePlayer"),
                .target(name: "FeatureProfile"),
                .target(name: "FeatureSettings"),
                .target(name: "DesignSystem"),
                .target(name: "Domain"),
            ]
        ),

        // ── Features ──────────────────────────────────────────────────────────
        // Six targets, ~16 files each, none depending on another. This is the work
        // that used to be one 90-file queue.
        feature("Login"),
        feature("Feed"),
        feature("Search"),
        feature("Player", needsImages: true),
        feature("Profile", needsImages: true),
        feature("Settings"),

        // ── Services ──────────────────────────────────────────────────────────

        // The only target that needs Alamofire. One file.
        .target(
            name: "Networking",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.networking",
            deploymentTargets: .iOS("17.0"),
            sources: ["\(coreRoot)/Networking/**"],
            dependencies: [.external(name: "Alamofire")]
        ),

        // RemoteImage is the file that fights you: it imports Kingfisher *and*
        // calls Theme. Leave it in the design system and every component goes back
        // to waiting on an image library — the original problem, in miniature. So
        // it lives alone and pays for its own dependency.
        .target(
            name: "Images",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.images",
            deploymentTargets: .iOS("17.0"),
            sources: ["\(coreRoot)/Images/**"],
            dependencies: [
                .target(name: "DesignSystem"),
                .external(name: "Kingfisher"),
            ]
        ),

        // ⚠️ NOT "CoreServices" — that is an Apple system framework, and naming a
        // module after it makes Clang resolve <CoreServices/CoreServices.h> to
        // yours. Kingfisher and Alamofire then fail to build MobileCoreServices,
        // with an error mentioning neither your module nor your code.
        .target(
            name: "Domain",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.domain",
            deploymentTargets: .iOS("17.0"),
            sources: [
                "\(coreRoot)/Session/**",
                "\(coreRoot)/Storage/**",
                "\(coreRoot)/Feed/**",
                "\(coreRoot)/Ranking/**",
                "\(coreRoot)/Services/**",
            ],
            dependencies: [
                .target(name: "Models"),
                .target(name: "Networking"),
            ]
        ),

        // ── Foundation ────────────────────────────────────────────────────────
        // Both depend on nothing, so both start at t=0 — alongside Alamofire and
        // Kingfisher rather than behind them.

        .target(
            name: "Models",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.models",
            deploymentTargets: .iOS("17.0"),
            sources: [
                "\(coreRoot)/Models/**",
                "\(coreRoot)/Formatting/**",
                "\(coreRoot)/Fixtures/**",
                "\(coreRoot)/BuildInfo/**",
            ]
        ),

        .target(
            name: "DesignSystem",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.designsystem",
            deploymentTargets: .iOS("17.0"),
            sources: [
                "\(coreRoot)/DesignSystem/**",
                "\(coreRoot)/Components/**",
            ]
        ),

        .target(
            name: "RockyFeedTests",
            destinations: .iOS,
            product: .unitTests,
            bundleId: "dev.tuist.rockyfeed.tests",
            deploymentTargets: .iOS("17.0"),
            sources: ["RockyFeedTests/**"],
            dependencies: [
                .target(name: "RockyFeed"),
                .target(name: "Images"),
                .target(name: "Models"),
                .target(name: "Domain"),
            ]
        ),
    ]
)
```

**`Tuist/Package.swift`** — type this out:

```swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "RockyFeed",
    dependencies: [
        .package(url: "https://github.com/Alamofire/Alamofire", from: "5.9.0"),
        .package(url: "https://github.com/onevcat/Kingfisher", from: "7.11.0"),
    ]
)
```

**Show the solved state:**

```sh
git checkout solutions/06
cd app && tuist install && tuist cache && tuist generate RockyFeed --no-open
# The big one. Read what `tuist cache` prints, then build → ~3.3s. Open "was it worth it".
```

<!-- COMMANDS:6:END -->

---

## Tasks 7–9 — the back half (~85 min)

### Task 7 — Test only what changed (~30 min)

`tuist test` hashes test targets like Task 6 hashed build targets. Run it twice
and the second says **"There are no tests to run, finishing early"** (verified).

**The beat:** ask *"what has to be true about a test before you're allowed to skip
it?"* — then let them find `ImageCacheTests`. It sleeps a random 40–120ms and
asserts a 100ms budget, so it fails **25% of the time by arithmetic**, not luck.
Twenty of the eighty milliseconds are over budget. Do that sum on the whiteboard;
it lands better than "flaky tests are bad".

**The real lesson is one level down.** `ImageCacheWarmer` only exposed `prefetch`
— a side effect with nothing to assert — so the only observable thing was *how
long it took*. That's **why** the test reached for a stopwatch. The fix extracts
`pending()`, the decision. Say it plainly: **a flaky test is usually untestable
code telling you so.**

> Fixed suite verified 5/5 runs.

<!-- COMMANDS:7:START — generated by `mise run cheatsheet`, do not edit by hand -->

**Type this live** (they mirror you):

```sh
# Run these from app/, one at a time.

# 1. The whole suite, every test, every time. This is CI today.
hyperfine --runs 1 \
  --export-json ../.workshop/measurements/test-everything.json \
  "xcodebuild test \
    -workspace RockyFeed.xcworkspace \
    -scheme RockyFeed-Workspace \
    -destination 'platform=iOS Simulator,name=iPhone 17e' \
    -derivedDataPath ../.workshop/DerivedData \
    -quiet"

# 2. Now Tuist's runner. First run does the work...
tuist test

# ...and the second refuses to, because nothing changed.
tuist test

# 3. Prove it notices real changes: touch a test, run again.
touch RockyFeedTests/ImageCacheTests.swift
tuist test

# 4. Then open that file and decide whether you would let it be skipped.
#    Fix it so that skipping it is an honest thing to do.

# Then: Validate my work.
```

**Show the solved state:**

```sh
git checkout solutions/07
cd app && tuist install && tuist generate --no-open
tuist test && tuist test    # second run skips — nothing changed
# Then touch a test and run again to show it notices.
```

<!-- COMMANDS:7:END -->

### Task 8 — The build that lies (~30 min)

Build twice, `diff` the bundles, find `BuildStamp.plist` differs. Four sins in one
40-line script; only one matters — **the timestamp makes the build
non-reproducible by design**, breaking the exact sentence Tasks 5, 6 and 7 rest
on. This is why teams enable a cache, measure nothing, and conclude caching
doesn't work on iOS.

Verified after the fix: two builds produce an **identical** plist, and the phase
is **skipped entirely** when the commit hasn't changed (it used to run on every
build — pure overhead on every incremental they measured in Task 1).

Watch for the trap: declaring `inputPaths`/`outputPaths` achieves **nothing**
while `basedOnDependencyAnalysis: false` stays. Both, or neither works.

<!-- COMMANDS:8:START — generated by `mise run cheatsheet`, do not edit by hand -->

**Type this live** (they mirror you):

```sh
# Run from app/, one at a time.

# 1. Build the same source twice, into two places.
xcodebuild build -workspace RockyFeed.xcworkspace -scheme RockyFeed \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/build-a -quiet
xcodebuild build -workspace RockyFeed.xcworkspace -scheme RockyFeed \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/build-b -quiet

# 2. Are they the same app?
diff -r /tmp/build-a/Build/Products/Debug-iphonesimulator/RockyFeed.app \
        /tmp/build-b/Build/Products/Debug-iphonesimulator/RockyFeed.app

# 3. Look at what differs.
diff /tmp/build-a/Build/Products/Debug-iphonesimulator/RockyFeed.app/BuildStamp.plist \
     /tmp/build-b/Build/Products/Debug-iphonesimulator/RockyFeed.app/BuildStamp.plist

# 4. Now open the culprit and fix it.
#    - take the timestamp out
#    - declare what it reads and writes, in app/Project.swift
#    - stop telling Xcode not to think (basedOnDependencyAnalysis: false)
#
#    app/Scripts/stamp-build-info.sh
#    app/Project.swift

# 5. Prove it: regenerate, build twice more, diff again. Silence is the pass.
tuist generate --no-open

# Then: Validate my work.
```

**Show the solved state:**

```sh
git checkout solutions/08
# Show the fixed app/Scripts/stamp-build-info.sh and the declared phase in Project.swift.
cd app && tuist install && tuist generate --no-open
# Build twice into /tmp/build-a and /tmp/build-b, diff → silence is the pass.
```

<!-- COMMANDS:8:END -->

### Task 9 — Make CI pay for it (~25 min)

The only task with **nothing to measure** — there's no runner in the room. Say
that out loud; it's the point. Every other task had a number to tell them they
were right. Here they have to *reason* about whether the caching is sound, which
is exactly Monday.

**The beat:** "every number today was taken on a warm laptop. A runner arrives
empty." Task 5 already showed them a cold cache is *slower* than no cache — on CI
that's the default, not a curiosity.

Discussion worth having: what's your cache **hit rate**? Nobody knows. That's the
finding. A silently-missing cache looks exactly like a working one for months,
which is why the solution workflow prints hits into the step summary and warns on
a cold module cache.

<!-- COMMANDS:9:START — generated by `mise run cheatsheet`, do not edit by hand -->

**Type this live** (they mirror you):

```sh
# There is nothing to run here, so nothing to paste. This is the shape.
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
#           key: mise-${{ hashFiles('mise.toml') }}
#       - uses: jdx/mise-action@v2
#
#       # 2. Resolved packages. Keyed on the resolution, not the manifest.
#       - uses: actions/cache@v4
#         with:
#           path: app/Tuist/.build
#           key: spm-${{ hashFiles('app/Tuist/Package.resolved') }}
#
#       # 3. The module cache from task 6.
#       - uses: actions/cache@v4
#         id: tuist-cache
#         with:
#           path: ~/.cache/tuist
#           key: tuist-${{ hashFiles('app/Project.swift', 'app/Core/**', 'app/RockyFeed/**') }}
#           restore-keys: tuist-
#
#       # 4. Say whether it hit. Out loud, every run.
#       - run: echo "module cache hit: ${{ steps.tuist-cache.outputs.cache-hit }}"
#
#       - run: cd app && tuist install && tuist cache
#       - run: cd app && tuist test    # only what changed, from task 7

# Then: Validate my work.
```

**Show the solved state:**

```sh
git checkout solutions/09
# Nothing to run — read .github/workflows/ci.yml together. The cache keys are the lesson.
```

<!-- COMMANDS:9:END -->

---

## The server (Tasks 10–12, ~90 min)

> *Everything so far lives on one laptop.*

| | |
| --- | --- |
| **10. Nobody else can see it** | account, project, `fullHandle`, one build uploaded |
| **11. A cache of one** | the 3.3s only you have — share it and prove it |
| **12. Ask it what changed** | point an agent at the history |

### ⚠️ Bandwidth is the whole risk

**Check the venue's upstream before you commit to this half.** Tuist's build upload
is a multipart S3 push with presigned URLs that **expire after 120 seconds**. On a
slow link a chunk doesn't finish in time and it dies at `partNumber=3` — the error
says "request timed out", which reads like a bug and isn't.

Measured, on the same machine, same command, hours apart:

| upstream | result |
| --- | --- |
| ~90 KB/s | **fails every time**, three attempts |
| ~2.2 MB/s | **succeeds first try** |

Test it on the day, from the room, before Task 10:

```bash
dd if=/dev/urandom of=/tmp/5mb.bin bs=1m count=5
curl -o /dev/null -w "%{speed_upload} B/s\n" --data-binary @/tmp/5mb.bin \
  https://speed.cloudflare.com/__up
```

Below ~500 KB/s, make Tasks 10–12 a demo from your own connection rather than
watching thirty people fail at once. Task 12 is the safest to demo — it's a URL and
some questions; nobody loses much by watching.

### 🔒 Never run `tuist cache config` on the projector

It prints a **live JWT** with read/write on every project the account can reach.
The runner's own probe deliberately throws the response away. Task 11's hint warns
them, but you should know before you improvise.

### Task 10 — the beats

Attendees each need their own account: `tuist auth login`, then
`tuist project create <them>/rockyfeed --build-system xcode`, then the handle into
`app/Tuist.swift`. Free, deletable, ~10 min.

**There is no solution branch and there cannot be** — ours would upload their
builds into a project they can't read. The validator catches exactly that
copy-paste and says so.

**`tuist xcodebuild` uploads insights by itself.** The docs point at a scheme
post-action; that's for builds started inside Xcode. In a terminal it's unnecessary.

Be honest about the payoff: **one build is one dot.** It's worth doing now because
it's worthless in a month if you don't.

<!-- COMMANDS:10:START — generated by `mise run cheatsheet`, do not edit by hand -->

**Type this live** (they mirror you):

```sh
# Run these from app/, one at a time.

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
tuist xcodebuild build \
  -workspace RockyFeed.xcworkspace \
  -scheme RockyFeed \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ../.workshop/DerivedData \
  -quiet

# If it says the upload timed out, that is bandwidth, not you. Retry with:
#   tuist inspect build --derived-data-path ../.workshop/DerivedData

# Then: Validate my work, and What can it see that you could not.
```

**Show the solved state:**

```sh
git checkout solutions/09      # the final code state; the server tasks build on it
# Live against the server: tuist auth login → project create → tuist inspect build.
# NEEDS the network. If the room's upstream is weak, demo this from a wired connection.
```

<!-- COMMANDS:10:END -->

### Task 11 — the beat that pays off Task 4

The only honest proof is destroying the local cache:

```bash
tuist cache                      # 0 remote hits, 4 local, 11 misses
rm -rf ~/.cache/tuist/Binaries   # ← Binaries, NOT BinaryCache
tuist cache                      # 11 remote hits, 0 local, 4 misses
```

> I got that path wrong first and read *15 local hits* as a pass. If someone's
> counts don't flip, that's why.

**6s to pull what costs ~20s to build.** Alamofire and Kingfisher stay misses —
external packages cache separately. 11 of 15 is the win.

Then land it: *cached monolith 8.1s, cached split 3.3s.* **This is where the split
regression from Task 4 gets paid** — a monolith is one hash, so a shared cache of
it is a shared cache of nothing.

<!-- COMMANDS:11:START — generated by `mise run cheatsheet`, do not edit by hand -->

**Type this live** (they mirror you):

```sh
# Run from app/, one at a time.

# 1. Warm it. With a fullHandle set, this now pushes to the server too.
#    Read the last line: it tells you hits, misses, and where they came from.
tuist cache

# 2. Become a new teammate: throw away every binary you have locally.
#    This is not a simulation. It is the state everyone else is in.
rm -rf ~/.cache/tuist/Binaries

# 3. Warm again. The counts should flip: remote hits where local hits were.
tuist cache

# 4. And the build that follows is the one from task 6, on a machine that
#    compiled none of it.
tuist generate --no-open

# Then: Validate my work, and So who is this actually for.
```

**Show the solved state:**

```sh
# Still on solutions/09. Warm the remote cache, then pull it on a 'fresh' machine:
cd app && tuist cache        # stores remotely
rm -rf ~/.cache/tuist/Binaries && tuist cache   # 11 remote hits — that's the point
```

<!-- COMMANDS:11:END -->

### Task 12 — the closer

`claude mcp add --transport http tuist https://tuist.dev/mcp`, then **`/mcp` →
authenticate** (OAuth, opens a browser). It will say "Needs authentication" and it
means it.

`tuist mcp` **does not exist** — it's a hosted endpoint, not a subcommand. Don't let
anyone go looking for a CLI.

The closing line of the day: *it can be confidently wrong.* It's a language model
reading a database. Ask it for a number, then check the number — which is what the
whole day was about.

<!-- COMMANDS:12:START — generated by `mise run cheatsheet`, do not edit by hand -->

**Type this live** (they mirror you):

```sh
# 1. Add the connector.
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
# Then: Validate my work, and What to actually ask it.
```

**Show the solved state:**

```sh
# Still on solutions/09. The MCP is a hosted endpoint, added once:
claude mcp add --transport http tuist https://tuist.dev/mcp
# Then authenticate it in an interactive session (/mcp) and ask it about your builds.
```

<!-- COMMANDS:12:END -->

---

## Facilitator gotchas

- **Reset between runs (from `app/`, where you and attendees stand):**
  `rm -rf ../.workshop && git checkout HEAD -- . ../.gitignore && git clean -fd .`.
  The `git clean` is the part a bare `git checkout` misses: Tuist tasks leave
  untracked `Project.swift`, `Tuist.swift` and `RockyFeed.xcworkspace/` behind, and
  Task 3 untracks the pbxproj — `checkout HEAD` re-tracks it, `clean` sweeps the rest.
- **Checkpoints:** `git stash && git checkout solutions/03`. Tasks 1 and 2 have
  none, on purpose — they're measurements of your own machine.
- **The flaky test** (`RockyFeedTests/ImageCacheTests`) fails ~25% of runs. If
  someone trips over it early, that's a gift — park it for later.
- **Benchmarks and branch surgery don't mix.** I killed one measurement by
  deleting the pbxproj underneath it. If you're demoing, don't switch branches
  mid-run.
- **Load matters.** A measurement taken on a busy laptop came back σ=33%; the same
  one on a quiet machine gave σ=0.5%. If someone's numbers are wild, ask what else
  is running.
- **`DVTDeviceOperation: Encountered a build number "" …` during `tuist generate`**
  is benign Xcode log noise, not an error. From Task 3 on, the deps are Xcode-native
  SPM, so `tuist generate` shells out to `xcodebuild -resolvePackageDependencies`, and
  that command prints this line on current Xcode regardless. The project still
  generates — tell anyone who asks to ignore it.
- **If Task 8's stamp phase can't read git** (commit shows `unknown`), check
  `ENABLE_USER_SCRIPT_SANDBOXING`. `Project.swift` sets no build settings — it
  relies on the default, which is `NO`, so the script can shell out to git. If a
  toolchain or org xcconfig ever flips that default to `YES`, the sandbox blocks
  the git call and Task 8's premise breaks. Fix: add `"ENABLE_USER_SCRIPT_SANDBOXING": "NO"`
  to a `settings:` base in `Project.swift`.

---

## The one thing not built

**Resolution — the SPM registry.** `tuist registry setup` exists and would fit
naturally in the server stage (it's server-backed like everything else there). It's the
last piece of the talk's pipeline with no task.

It is **not** built, and honestly there is nowhere to put it: the day is already
full (see below). If you want it, something else comes out.

---

## Bonus, if you somehow have time: take the compilation cache remote

Task 11 leaves one thread hanging on purpose — the compilation cache from Task 5 is
"still yours alone," because sharing a latency-bound, per-compile-job CAS over a
network is the hard case. Tuist now productizes exactly that, as a **remote Xcode
compilation cache**. You almost certainly won't reach it (see the budget below), but
it's the satisfying close to the two-caches story if the room is flying — and a real
answer to the cliffhanger the workshop sets up.

It builds straight on Task 10 (a Tuist account + `fullHandle`, authenticated) and
needs **Xcode 26+**. For the generated project it's two steps:

```sh
# 1. Set up the cache daemon: a local socket + LaunchAgent, backed by the remote CAS.
tuist setup cache

# 2. Turn it on. For a generated project there are NO manual build settings — add
#    `enableCaching: true` to Tuist.swift and Tuist wires the COMPILATION_CACHE_*
#    settings for you. Then regenerate and build.
tuist generate --no-open
```

This is the *compilation* cache going remote: per compile job, thousands of tiny
objects, latency-bound. Distinct from the module cache (Tasks 6/10/11), which ships
whole `.xcframework`s before the build and is bandwidth-bound. Same idea, opposite
shape — which is why the talk treats them separately, and why the module cache is the
one the workshop takes remote first.

Do it live off the current docs, since the API may move:
<https://tuist.dev/en/docs/guides/features/cache/xcode-cache>

---

## Is this a full day? Yes — arguably too full.

| | |
| --- | --- |
| Task time | **6h 35m** |
| + lunch and two breaks | 1h 30m |
| **Door to door** | **8h 05m** |

That's 09:00–17:05 with **zero slack**, and these estimates are the optimistic
kind — they assume nobody's Xcode is broken and the wifi holds.

**Decide your cut line before the day, not at 16:30.** In order of what costs least
to lose:

1. **Task 12 (MCP, 30 min) → demo it.** It's a URL and some questions; watching
   costs them almost nothing. Also the most likely to be eaten by OAuth + wifi.
2. **Tasks 10–12 (90 min) → demo the lot** if the room's upstream is bad. This is
   the natural pressure valve: it's the one stage that can't fall back to local,
   and you'd recover a full hour.
3. **Task 2 (25 min)** could be folded into Task 1's discussion — but it's what
   makes Task 4's trade land honestly (the inner-loop win needs the split), so cut it last.

**Do not cut Task 6.** The whole morning is a setup for it, and Task 4 is a
trade whose cache payoff goes uncollected without it.
