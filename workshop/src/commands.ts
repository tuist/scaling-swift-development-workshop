import path from "node:path";
import { paths, scheme, destination } from "./paths.js";

/**
 * The commands the workshop teaches.
 *
 * These are strings we *show*, never something we run. Attendees type them: the
 * point of the day is that they leave able to measure their own project, and
 * nobody learns hyperfine by watching a spinner someone else started.
 *
 * Every path is derived from paths.ts and rendered relative to app/ — because that
 * is where these commands run. You are working on the app (xcodebuild, tuist), so
 * you stand in app/; the workshop's own state lives one level up at the repo root,
 * which is why DerivedData, the cache and the measurements come out as
 * `../.workshop/...`. Deriving from paths.ts keeps the strings and the runner's own
 * reads in lockstep: move a directory and both follow.
 */

/** A path relative to app/, which is where the attendee stands to run these. */
const rel = (absolute: string): string => path.relative(paths.app, absolute);

const project = rel(paths.xcodeproj);
const workspace = rel(paths.xcworkspace);
const derivedData = rel(paths.derivedData);
const cas = rel(paths.compilationCache);
const measurements = rel(paths.measurementsDir);

const exportPath = (label: string): string => `${measurements}/${label}.json`;

const destAndDerived = `-scheme ${scheme} \\
  -destination '${destination}' \\
  -derivedDataPath ${derivedData}`;

const commonArgs = `${destAndDerived} \\
  -quiet`;

/**
 * The same args plus COMPILATION_CACHE_CAS_PATH, which points the compilation
 * cache at .workshop/ instead of Xcode's global location.
 *
 * Deliberately absent from the commands before task 5: it does nothing until
 * COMPILATION_CACHE_ENABLE_CACHING is turned on (that is task 5), and a flag that
 * does nothing but name a concept nobody has met yet is just noise in the first
 * benchmark anyone runs. From task 5 on it earns its place — it is what keeps the
 * workshop's cache out of the caches your real work depends on.
 */
const cachedArgs = `${destAndDerived} \\
  COMPILATION_CACHE_CAS_PATH=${cas} \\
  -quiet`;

/**
 * The build command for tasks 1 and 2, before the project is generated.
 *
 * Run from app/ — every path here is relative to it.
 */
export const buildEnv = `export BUILD="xcodebuild build \\
  -project ${project} \\
  ${commonArgs}"`;

/**
 * The build command from task 3 onwards.
 *
 * It has to change, and the reason is worth a minute of anyone's time: Tuist
 * integrates Alamofire and Kingfisher as generated Xcode projects sitting beside
 * yours in a *workspace*, rather than as a package graph Xcode resolves at build
 * time. So the workspace — not the project — is the thing that knows the whole
 * graph. Point xcodebuild at the project alone after generating and it fails with
 * "unable to resolve module dependency: 'Kingfisher'", which is the build system
 * telling you exactly that.
 *
 * Everything else is identical, so the numbers stay comparable with tasks 1 and 2.
 */
export const buildEnvGenerated = `export BUILD="xcodebuild build \\
  -workspace ${workspace} \\
  ${commonArgs}"`;

/**
 * The build command from task 5 onward, once compilation caching is on.
 *
 * Identical to buildEnvGenerated but with the cache redirected into .workshop/.
 * Introduced here rather than earlier because this is the task that enables the
 * cache — before now the flag would have been inert (see cachedArgs).
 */
export const buildEnvGeneratedCached = `export BUILD="xcodebuild build \\
  -workspace ${workspace} \\
  ${cachedArgs}"`;

/**
 * Resolve the packages once, before benchmarking anything.
 *
 * Without this the first timed clean build also clones Alamofire and Kingfisher,
 * so you measure resolution instead of compilation. It doesn't average out — it
 * lands entirely in run 1 and drags the mean somewhere meaningless. (Measured for
 * real: 47s ± 25s, when the honest clean build was ~29s.)
 *
 * Resolving and building are separate stages of the pipeline. Time them apart.
 */
export const resolvePackages = `xcodebuild -resolvePackageDependencies \\
  -project ${project} \\
  -scheme ${scheme} \\
  -derivedDataPath ${derivedData}`;

/**
 * A clean build: wipe the products before each run, keep the resolved packages.
 *
 * The warmup matters as much as the prepare. Measured on a fresh DerivedData,
 * even with packages already resolved, the runs came out [44.5s, 26.1s, 24.7s] —
 * the first build is cold in ways that never repeat (build description, module
 * cache, the OS file cache), so it drags the mean up by a third and inflates σ to
 * where nothing is comparable. One untimed run throws that away.
 */
export const cleanBuild = (label: string, runs = 3): string =>
  `hyperfine --runs ${runs} --warmup 1 \\
  --prepare 'rm -rf ${derivedData}/Build' \\
  --export-json ${exportPath(label)} \\
  "$BUILD"`;

/**
 * The same clean build, restricted to one job at a time.
 *
 * One timed run is enough here on purpose: we're looking for a factor of three,
 * not three percent, and a second serial build costs another minute for a
 * precision the conclusion doesn't need. Rigour should be proportionate to the
 * effect you're chasing.
 */
export const serialCleanBuild = (label: string, runs = 1): string =>
  `hyperfine --runs ${runs} --warmup 1 \\
  --prepare 'rm -rf ${derivedData}/Build' \\
  --export-json ${exportPath(label)} \\
  "$BUILD -jobs 1"`;

/**
 * The file we edit to trigger an incremental build.
 *
 * It's the app's root view — top of the graph, so touching it recompiles exactly
 * one file and relinks the app, with no downstream fan-out. That makes it the
 * honest "I edited the screen I'm working on and hit build" number, and it exists
 * in every state we compare (it never moves between the monolith and the split).
 */
export const incrementalEditFile = "RockyFeed/RootView.swift";

/**
 * An incremental build: edit one file, rebuild.
 *
 * `touch` bumps the file's mtime before each timed run, which is enough to make
 * the build system recompile it — the everyday edit-build loop, not a from-clean
 * build and not a no-op. The warmup run gets the tree built first, so every timed
 * run measures the same one-file change rather than run 1 measuring a real build.
 */
export const incrementalBuild = (label: string, runs = 3): string =>
  `hyperfine --runs ${runs} --warmup 1 \\
  --prepare 'touch ${incrementalEditFile}' \\
  --export-json ${exportPath(label)} \\
  "$BUILD"`;

/** A clean build with the compilation cache thrown away too. */
export const coldCacheBuild = (label: string, runs = 1): string =>
  `hyperfine --runs ${runs} \\
  --prepare 'rm -rf ${derivedData}/Build ${cas}' \\
  --export-json ${exportPath(label)} \\
  "$BUILD"`;

/** Warm the module cache: build every cacheable target, store it as an xcframework. */
export const tuistCache = `tuist cache`;

/**
 * Generate with the app focused.
 *
 * Naming a target means "keep this one as source, bring everything else in as a
 * prebuilt binary". That is the whole point of a module cache, and it is only
 * possible because task 4 gave the project modules to swap.
 */
export const tuistGenerateFocused = `tuist generate RockyFeed --no-open`;

/**
 * Run the whole test suite, every test, every time. The status quo.
 *
 * Points at the workspace Tuist generates, so it is the same suite either way.
 */
export const testEverything = (label: string, runs = 1): string =>
  `hyperfine --runs ${runs} \\
  --export-json ${exportPath(label)} \\
  "xcodebuild test \\
    -workspace ${workspace} \\
    -scheme RockyFeed-Workspace \\
    -destination 'platform=iOS Simulator,name=iPhone 17e' \\
    -derivedDataPath ${derivedData} \\
    -quiet"`;

/**
 * Tuist's test runner: hashes each test target the way task 6 hashed each build
 * target, and skips the ones whose inputs have not moved.
 */
export const testSelective = `tuist test`;

export const labels = {
  baselineClean: "baseline-clean-build",
  baselineIncremental: "baseline-incremental",
  serialClean: "serial-clean-build",
  generatedClean: "generated-clean-build",
  splitClean: "split-clean-build",
  splitIncremental: "split-incremental-build",
  cachedClean: "cached-clean-build",
  moduleCacheClean: "module-cache-clean-build",
  coldCacheClean: "cold-cache-clean-build",
  testAll: "test-everything",
} as const;
