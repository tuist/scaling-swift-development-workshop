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
mise install     # Node + hyperfine, pinned — native on Apple Silicon, no Rosetta needed
```

## Running the workshop

Everything happens through the workshop runner:

```bash
mise run workshop
```

It shows you the current task, explains the *why*, runs the benchmarks, and
validates your work. Progress and measurements live in `.workshop/` — local to
you, never committed.

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

Every task is judged against the **baseline** you record in Task 1. The runner
uses [`hyperfine`](https://github.com/sharkdp/hyperfine) to benchmark four things
that fail independently:

| Metric | Why it's separate |
| --- | --- |
| **Resolve packages** | SwiftPM git-clones every dependency, with full history. |
| **Clean build** | What CI pays every run, and you pay after every clean. |
| **Incremental build** | Nothing changed. Should be free. Find out whether it is. |
| **Rebuild after touching `Core`** | The god-module tax — the number that hurts most. |

Benchmarks run against a **dedicated `.workshop/DerivedData`**, so nothing the
workshop does touches your normal Xcode caches.

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
