import fs from "node:fs/promises";
import path from "node:path";
import { paths, scheme, destination } from "./paths.js";
import { run } from "./shell.js";

/**
 * Reading measurements — not taking them.
 *
 * Attendees run hyperfine themselves and export JSON. This module reads what
 * they produced. The runner deliberately owns no benchmark of its own: if it did,
 * everyone would leave having watched a tool measure a build, which is not the
 * skill they came for.
 */

/** A single hyperfine benchmark result, in seconds. */
export interface Stat {
  mean: number;
  stddev: number;
  min: number;
  max: number;
  runs: number;
}

/** The shape hyperfine writes with --export-json. */
interface HyperfineExport {
  results?: Array<{
    mean?: number;
    stddev?: number | null;
    min?: number;
    max?: number;
    times?: number[];
  }>;
}

export const measurementPath = (label: string): string =>
  path.join(paths.measurementsDir, `${label}.json`);

/**
 * Reads a hyperfine export.
 *
 * Returns null when it's missing or isn't a hyperfine file, so a validator can
 * say "you haven't measured this yet" rather than throwing a stack trace at
 * someone who mistyped a path.
 */
export const readMeasurement = async (label: string): Promise<Stat | null> => {
  let raw: string;
  try {
    raw = await fs.readFile(measurementPath(label), "utf8");
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as HyperfineExport;
    const first = parsed.results?.[0];
    if (!first || typeof first.mean !== "number") return null;
    return {
      mean: first.mean,
      stddev: first.stddev ?? 0,
      min: first.min ?? first.mean,
      max: first.max ?? first.mean,
      runs: first.times?.length ?? 1,
    };
  } catch {
    return null;
  }
};

/**
 * Reads a resolved build setting.
 *
 * We ask xcodebuild rather than grepping the pbxproj, because the resolved value
 * is what actually governs the build — and it's true however the setting got
 * there: Xcode's UI, an xcconfig, or a hand edit.
 */
export const buildSetting = async (name: string): Promise<string | null> => {
  const result = await run("xcodebuild", [
    "-showBuildSettings",
    "-project",
    paths.xcodeproj,
    "-scheme",
    scheme,
    "-destination",
    destination,
  ]);
  if (!result.ok) return null;
  const match = result.stdout.match(new RegExp(`^\\s*${name} = (.*)$`, "m"));
  return match?.[1]?.trim() ?? null;
};

/**
 * The schemes in the generated workspace.
 *
 * Tuist emits one per target, so this is how we ask "what modules exist?" without
 * grepping the manifest for target names — we check what was actually generated,
 * which is true regardless of how someone chose to write their Swift.
 */
export const generatedSchemes = async (): Promise<string[]> => {
  const result = await run("xcodebuild", ["-list", "-workspace", paths.xcworkspace, "-json"]);
  if (!result.ok) return [];
  try {
    const parsed = JSON.parse(result.stdout) as { workspace?: { schemes?: string[] } };
    return parsed.workspace?.schemes ?? [];
  } catch {
    return [];
  }
};

/** Size of the compilation cache on disk, in bytes. Caches aren't free. */
export const compilationCacheBytes = async (): Promise<number> => {
  const result = await run("du", ["-sk", paths.compilationCache]);
  if (!result.ok) return 0;
  const kb = Number.parseInt(result.stdout.trim().split(/\s+/)[0] ?? "0", 10);
  return Number.isFinite(kb) ? kb * 1024 : 0;
};

/**
 * Tuist server probes.
 *
 * All read-only, and none of them print the cache token. `tuist cache config`
 * dumps a live JWT to stdout with read/write grants on every project you can
 * reach — we ask it whether it works and throw the answer away.
 */

/** The account handle you're logged in as, or null if you aren't. */
export const tuistWhoami = async (): Promise<string | null> => {
  const result = await run("tuist", ["auth", "whoami"], { cwd: paths.app });
  if (!result.ok) return null;
  const handle = result.stdout.trim().split("\n").pop()?.trim();
  return handle && !handle.includes("Error") ? handle : null;
};

/** The fullHandle this checkout is pointed at, read out of Tuist.swift. */
export const tuistFullHandle = async (): Promise<string | null> => {
  const result = await run("grep", ["-oE", 'fullHandle: *"[^"]+"', paths.tuistManifest]);
  if (!result.ok) return null;
  return result.stdout.match(/"([^"]+)"/)?.[1] ?? null;
};

/** Projects visible to the logged-in account. */
export const tuistProjects = async (): Promise<string[]> => {
  const result = await run("tuist", ["project", "list"], { cwd: paths.app });
  if (!result.ok) return [];
  return result.stdout
    .split("\n")
    .map((line) => line.replace(/^\s*[•*-]\s*/, "").trim())
    .filter((line) => /^[\w-]+\/[\w-]+$/.test(line));
};

/**
 * Whether the remote cache is reachable for this project.
 *
 * Deliberately returns a boolean and never the token `tuist cache config`
 * prints alongside it.
 */
export const remoteCacheReachable = async (): Promise<boolean> => {
  const result = await run("tuist", ["cache", "config"], { cwd: paths.app });
  return result.ok && /URL:\s*https:\/\//.test(result.stdout);
};
