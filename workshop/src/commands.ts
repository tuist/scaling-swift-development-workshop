import path from "node:path";
import { paths, scheme, destination } from "./paths.js";

/**
 * The commands the workshop teaches.
 *
 * These are strings we *show*, never something we run. Attendees type them: the
 * point of the day is that they leave able to measure their own project, and
 * nobody learns hyperfine by watching a spinner someone else started.
 *
 * Every path is derived from paths.ts and rendered relative to the repo root.
 * That's deliberate — the runner reads exactly the files these commands write, so
 * the two must never drift apart. Hardcoding the strings here would let someone
 * move a directory and leave the validators silently looking in the old place.
 */

/** A repo-root-relative path, which is what someone types in their terminal. */
const rel = (absolute: string): string => path.relative(paths.repoRoot, absolute);

const project = rel(paths.xcodeproj);
const derivedData = rel(paths.derivedData);
const cas = rel(paths.compilationCache);
const measurements = rel(paths.measurementsDir);

const exportPath = (label: string): string => `${measurements}/${label}.json`;

/**
 * Set once, reused by every benchmark, so comparisons are apples to apples.
 *
 * Run from the repo root — every path here is relative to it.
 */
export const buildEnv = `export BUILD="xcodebuild build \\
  -project ${project} \\
  -scheme ${scheme} \\
  -destination '${destination}' \\
  -derivedDataPath ${derivedData} \\
  COMPILATION_CACHE_CAS_PATH=${cas} \\
  -quiet"`;

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

/** A no-op build. The warmup is load-bearing — see the hint in Task 1. */
export const incrementalBuild = (label: string, runs = 3): string =>
  `hyperfine --runs ${runs} --warmup 1 \\
  --export-json ${exportPath(label)} \\
  "$BUILD"`;

/** A clean build with the compilation cache thrown away too. */
export const coldCacheBuild = (label: string, runs = 1): string =>
  `hyperfine --runs ${runs} \\
  --prepare 'rm -rf ${derivedData}/Build ${cas}' \\
  --export-json ${exportPath(label)} \\
  "$BUILD"`;

export const labels = {
  baselineClean: "baseline-clean-build",
  baselineIncremental: "baseline-incremental",
  cachedClean: "cached-clean-build",
  coldCacheClean: "cold-cache-clean-build",
} as const;
