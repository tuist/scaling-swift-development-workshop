# 🏔️ Scaling Swift Development — Workshop

A full-day, hands-on companion to the [Scaling Swift Development](https://github.com/tuist/scaling-swift-development-talk)
talk from **Swift Rockies**.

The talk tells the story. Here you do it yourself: you get a real app that is
genuinely slow to work with, and you make it fast — one layer at a time,
**measuring every step**, so that at the end you can say exactly what you gained
and why.

## The premise

`app/` contains **RockyFeed**: a small conference companion app. It is deliberately
built the way a lot of real projects are built:

- A hand-maintained **`RockyFeed.xcodeproj`, checked into git**. No generation.
- Third-party dependencies integrated with **Xcode's native SwiftPM**, cloned from
  git with their full history.
- A **god module** (`Core`) that every feature imports and that owns every
  dependency. Change one line in it and everything downstream rebuilds.
- All six features (Login, Feed, Search, Player, Profile, Settings) crammed into
  **one app target**. No module boundaries, nothing buildable in isolation.
- **One test target** for everything, containing a **flaky test** that fails
  roughly one run in four for reasons that have nothing to do with your change.
- A **run-script build phase** with no declared inputs or outputs that shells out
  to `git` and stamps a timestamp — so it runs on every build, and no two builds
  are alike.
- **No measurement of any kind.**

None of this is a strawman. It's what "we'll clean it up later" looks like after
two years.

> [!NOTE]
> RockyFeed is small on purpose. It's slow enough that the problems are real and
> measurable, but not so slow that you spend the day watching a progress bar.

## Requirements

- **Xcode 26** (or newer) with an iOS simulator runtime
- [**mise**](https://mise.jdx.dev/) — pins everything else

```bash
git clone <this-repo>
cd scaling-swift-development-workshop
mise install     # Node, Tuist and hyperfine, pinned — native on Apple Silicon, no Rosetta needed
```

## Running the workshop

```bash
mise run workshop
```

The runner explains each task and checks your work. It does **not** do the work.
You run the commands yourself, in your own terminal — you're here to leave able to
do this to your own project, and nobody ever learned `hyperfine` by watching
someone else's spinner.

### Without mise

mise is the recommendation — it pins the exact versions the rest of the room is on,
so the workshop behaves identically on every machine. But nothing here depends on it.
If you would rather manage the tools yourself, install these three (the pinned
versions live in [`mise.toml`](mise.toml)) and skip mise entirely:

- **Node 24** — `brew install node@24`, or nvm
- **Tuist 4.202** — `brew install tuist` (other installers at [tuist.dev](https://tuist.dev))
- **hyperfine 1.20** — `brew install hyperfine`

Then launch the runner directly instead of `mise run workshop`:

```bash
cd workshop
npm install
npm start
```

Everything the tasks have you run — `tuist …`, `xcodebuild …`, `hyperfine …` — is a
plain command, so as long as those three are on your `PATH`, nothing else needs mise.
The one thing you give up: `brew` installs the *latest* of each, which can drift from
the pinned versions and quietly change your numbers. That drift is exactly what mise
exists to prevent.

Each task states a goal and why it matters. The commands are there when you want
them, behind **Give me a hint** and **Show me the commands** — but try first. The
attempt is the part that sticks.

Progress and measurements live in `.workshop/` — local to you, never committed.

```
┌  ◆ Scaling Swift Development · workshop
│
●  We start from RockyFeed: a small app that is slow for all the usual reasons.
│  Your job is to make it fast — and to prove that you did.
│
◆  Which task?
│  ● ○ 1. Measure the baseline (Step zero — Get reproducible numbers before you change anything.)
└
```

## How measurement works

Every task is judged against the **baseline** you take in Task 1, with
[`hyperfine`](https://github.com/sharkdp/hyperfine) — the same tool from the talk.
You run it; it writes JSON into `.workshop/measurements/`; the runner reads those
files back and tells you whether the number moved more than the noise.

The number we chase all day is the **clean build**: it's what CI pays on every
run, and it's what most of the day's changes actually improve.

Your benchmarks build into a **dedicated `.workshop/DerivedData`** with their own
compilation cache under `.workshop/`, so nothing here touches the Xcode caches
your day job depends on — and so you can throw the cache away on purpose when a
task asks you to.

## If you get stuck

Every task has a solution branch. Falling behind on one task shouldn't cost you
the next one:

```bash
git stash                    # keep whatever you have
git checkout solutions/01    # jump to the solved state
```

Then go back to `mise run workshop` and validate.

## Repository layout

```
app/                     RockyFeed — the project you're here to fix
├── RockyFeed.xcodeproj  checked in, hand-maintained (for now)
├── RockyFeed/           the one app target: every feature lives here
├── Core/                the god module (a local Swift package)
├── RockyFeedTests/      one test target for everything, flaky test included
└── Scripts/             the non-hermetic build phase

workshop/                the workshop runner (Node + TypeScript)
maintainer/              notes for whoever runs the workshop — you can ignore this
.workshop/               your progress + measurements (gitignored)
```

## Credits

Built by [Tuist](https://tuist.dev). Talk and workshop by
[Marek Fořt](https://github.com/fortmarek).
