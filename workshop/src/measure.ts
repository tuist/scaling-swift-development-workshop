import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { paths, scheme, destination } from "./paths.js";
import { run } from "./shell.js";

/** A single hyperfine benchmark result, in seconds. */
export interface Stat {
  mean: number;
  stddev: number;
  min: number;
  max: number;
  runs: number;
}

export type MetricKey =
  | "resolve"
  | "cleanBuild"
  | "incremental"
  | "touchCore"
  /**
   * A clean build with the compilation cache empty. Not part of the standard
   * set — it only means anything once caching is on, and it's the number that
   * stops the cache from looking like free money.
   */
  | "coldCacheCleanBuild";

export interface Measurement {
  label: string;
  recordedAt: string;
  machine: {
    model: string;
    cores: number;
    memoryGB: number;
    xcode: string;
  };
  metrics: Partial<Record<MetricKey, Stat>>;
}

export const metricTitles: Record<MetricKey, string> = {
  resolve: "Resolve packages",
  cleanBuild: "Clean build",
  incremental: "Incremental build (no changes)",
  touchCore: "Rebuild after a one-line change in Core",
  coldCacheCleanBuild: "Clean build, cache cold",
};

export const metricBlurbs: Record<MetricKey, string> = {
  resolve: "SwiftPM git-clones every dependency, with full history.",
  cleanBuild: "What CI pays on every run, and you pay after every clean.",
  incremental: "Should be ~free. Find out whether it is.",
  touchCore: "How far a design-system change reaches.",
  coldCacheCleanBuild: "The bill for filling the cache, not reading it.",
};

/** Rough wall-clock per run, used to warn people what they're in for. */
export const metricRoughSeconds: Record<MetricKey, number> = {
  resolve: 6,
  cleanBuild: 20,
  incremental: 2,
  touchCore: 19,
  coldCacheCleanBuild: 42,
};

const xcodebuildArgs = [
  "build",
  "-project",
  paths.xcodeproj,
  "-scheme",
  scheme,
  "-destination",
  destination,
  "-derivedDataPath",
  paths.derivedData,
  "-quiet",
  // Keep the compilation cache inside .workshop/ rather than Xcode's global
  // location. Harmless while caching is off; essential once it's on.
  `COMPILATION_CACHE_CAS_PATH=${paths.compilationCache}`,
];

const shellQuote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

const buildCommand = (): string =>
  ["xcodebuild", ...xcodebuildArgs].map(shellQuote).join(" ");

const resolveCommand = (): string =>
  [
    "xcodebuild",
    "-resolvePackageDependencies",
    "-project",
    paths.xcodeproj,
    "-scheme",
    scheme,
    "-derivedDataPath",
    paths.derivedData,
  ]
    .map(shellQuote)
    .join(" ");

/**
 * Simulating "someone changed one line in Core".
 *
 * `touch` does NOT work: Xcode's build system invalidates on content, not mtime,
 * so touching a file is indistinguishable from a no-op build and the benchmark
 * would quietly report ~0. We have to change the file's contents for real.
 *
 * We rewrite a spacing constant in the design system, because every component in
 * Core reads `Theme.Spacing` — so this is a faithful stand-in for an ordinary
 * design-system tweak, and it forces Core plus everything downstream to rebuild.
 *
 * The value is restored afterwards, so the working tree ends up clean.
 */
const coreMarkerFile = path.join(
  paths.corePackage,
  "Sources",
  "Core",
  "DesignSystem",
  "Theme.swift",
);
const coreMarkerPattern = /public static let xs: CGFloat = \d+/;
const coreMarkerCanonical = "public static let xs: CGFloat = 4";

/** Fails loudly rather than silently measuring nothing. */
const assertCoreMarker = async (): Promise<void> => {
  let contents: string;
  try {
    contents = await fs.readFile(coreMarkerFile, "utf8");
  } catch {
    throw new Error(
      `Can't find ${path.relative(paths.repoRoot, coreMarkerFile)}. The "${metricTitles.touchCore}" ` +
        `benchmark needs it to simulate a change in Core.`,
    );
  }
  if (!coreMarkerPattern.test(contents)) {
    throw new Error(
      `Couldn't find the spacing constant this benchmark rewrites in ` +
        `${path.relative(paths.repoRoot, coreMarkerFile)}.\n` +
        `Without it the benchmark would measure a no-op build and report a meaningless number.`,
    );
  }
};

const restoreCoreMarker = async (): Promise<void> => {
  try {
    const contents = await fs.readFile(coreMarkerFile, "utf8");
    const restored = contents.replace(coreMarkerPattern, coreMarkerCanonical);
    if (restored !== contents) await fs.writeFile(coreMarkerFile, restored, "utf8");
  } catch {
    // Nothing useful to do here; the assert above is where we care.
  }
};

interface Benchmark {
  key: MetricKey;
  /** Shell command run before *each* timed run. Not measured. */
  prepare?: string;
  command: string;
  /** Untimed runs before measuring. Only needed where run 1 wouldn't be representative. */
  warmup?: number;
  /** Checked before the benchmark runs. */
  precondition?: () => Promise<void>;
  /** Always runs afterwards, even if the benchmark fails. */
  cleanup?: () => Promise<void>;
}

const benchmarks = (): Record<MetricKey, Benchmark> => ({
  // Wipe only the resolved packages — never the participant's global caches.
  resolve: {
    key: "resolve",
    prepare: `rm -rf ${shellQuote(path.join(paths.derivedData, "SourcePackages"))}`,
    command: resolveCommand(),
  },
  // Keep SourcePackages so we measure compilation, not resolution. The
  // compilation cache lives outside Build/, so it survives — which is the point:
  // this is the clean build you get with a cache you already have.
  cleanBuild: {
    key: "cleanBuild",
    prepare: `rm -rf ${shellQuote(path.join(paths.derivedData, "Build"))}`,
    command: buildCommand(),
  },
  // The same clean build with the cache thrown away too: a fresh CI runner, or
  // the morning after an Xcode update invalidated everything.
  coldCacheCleanBuild: {
    key: "coldCacheCleanBuild",
    prepare:
      `rm -rf ${shellQuote(path.join(paths.derivedData, "Build"))} ` +
      shellQuote(paths.compilationCache),
    command: buildCommand(),
  },
  // The only benchmark that needs a warmup. It has no `prepare`, so if the build
  // happens to be stale when we start, run 1 measures a real rebuild instead of a
  // no-op and the mean is meaningless (we saw σ of ~4.7s without this). One
  // untimed build first guarantees every timed run is a genuine no-op.
  incremental: {
    key: "incremental",
    command: buildCommand(),
    warmup: 1,
  },
  touchCore: {
    key: "touchCore",
    // $RANDOM is expanded by the shell before each run, so every run is a genuine
    // content change rather than a repeat of the same edit.
    prepare:
      `sed -i '' "s/public static let xs: CGFloat = [0-9][0-9]*/public static let xs: CGFloat = $RANDOM/" ` +
      shellQuote(coreMarkerFile),
    command: buildCommand(),
    precondition: assertCoreMarker,
    cleanup: restoreCoreMarker,
  },
});

interface HyperfineExport {
  results: Array<{
    mean: number;
    stddev: number | null;
    min: number;
    max: number;
    times: number[];
  }>;
}

/**
 * Runs one benchmark through hyperfine and returns its statistics.
 *
 * We shell out to hyperfine rather than timing things ourselves because it does
 * the boring parts correctly: warmups, repeated runs, and a standard deviation
 * so you can tell a real improvement from noise.
 */
export const benchmark = async (key: MetricKey, runs: number): Promise<Stat> => {
  const spec = benchmarks()[key];
  await spec.precondition?.();

  const exportPath = path.join(os.tmpdir(), `rockyfeed-${key}-${Date.now()}.json`);
  const args = ["--runs", String(runs), "--export-json", exportPath, "--style", "none"];
  if (spec.prepare) args.push("--prepare", spec.prepare);
  // Warm up only where it changes the answer. The clean/resolve benchmarks reset
  // their own state in `prepare`, so a warmup there would just burn minutes.
  if (spec.warmup) args.push("--warmup", String(spec.warmup));
  args.push(spec.command);

  try {
    const result = await run("hyperfine", args, { cwd: paths.app });
    if (!result.ok) {
      throw new Error(
        `hyperfine failed for "${metricTitles[key]}".\n${result.stderr || result.stdout}`.trim(),
      );
    }

    const raw = await fs.readFile(exportPath, "utf8");
    const parsed = JSON.parse(raw) as HyperfineExport;

    const first = parsed.results[0];
    if (!first) throw new Error(`hyperfine returned no results for "${metricTitles[key]}".`);

    return {
      mean: first.mean,
      stddev: first.stddev ?? 0,
      min: first.min,
      max: first.max,
      runs: first.times.length,
    };
  } finally {
    await fs.rm(exportPath, { force: true });
    await spec.cleanup?.();
  }
};

const describeMachine = async (): Promise<Measurement["machine"]> => {
  const [model, xcode] = await Promise.all([
    run("sysctl", ["-n", "hw.model"]),
    run("xcodebuild", ["-version"]),
  ]);
  return {
    model: model.ok ? model.stdout.trim() : "unknown",
    cores: os.cpus().length,
    memoryGB: Math.round(os.totalmem() / 1024 ** 3),
    xcode: xcode.ok ? (xcode.stdout.split("\n")[0] ?? "unknown").trim() : "unknown",
  };
};

export const saveMeasurement = async (
  label: string,
  metrics: Partial<Record<MetricKey, Stat>>,
): Promise<Measurement> => {
  const measurement: Measurement = {
    label,
    recordedAt: new Date().toISOString(),
    machine: await describeMachine(),
    metrics,
  };
  await fs.mkdir(paths.measurementsDir, { recursive: true });
  await fs.writeFile(
    path.join(paths.measurementsDir, `${label}.json`),
    `${JSON.stringify(measurement, null, 2)}\n`,
    "utf8",
  );
  return measurement;
};

/**
 * Reads a resolved build setting from the project.
 *
 * We ask xcodebuild rather than grepping the pbxproj, because the resolved value
 * is what actually governs the build — and because it's true regardless of
 * whether the setting was set in Xcode, an xcconfig, or by hand.
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

/** Size of the compilation cache on disk, in bytes. Caches aren't free. */
export const compilationCacheBytes = async (): Promise<number> => {
  const result = await run("du", ["-sk", paths.compilationCache]);
  if (!result.ok) return 0;
  const kb = Number.parseInt(result.stdout.trim().split(/\s+/)[0] ?? "0", 10);
  return Number.isFinite(kb) ? kb * 1024 : 0;
};

export const loadMeasurement = async (label: string): Promise<Measurement | null> => {
  try {
    const raw = await fs.readFile(path.join(paths.measurementsDir, `${label}.json`), "utf8");
    return JSON.parse(raw) as Measurement;
  } catch {
    return null;
  }
};
