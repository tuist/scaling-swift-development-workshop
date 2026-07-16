import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repository root (the directory holding mise.toml). */
export const repoRoot = path.resolve(here, "..", "..");

export const paths = {
  repoRoot,
  /** The sample project we spend the workshop fixing. */
  app: path.join(repoRoot, "app"),
  /** Hand-maintained and committed, until task 3 generates it instead. */
  xcodeproj: path.join(repoRoot, "app", "RockyFeed.xcodeproj"),
  /** Only exists once Tuist generates it — the deps live beside the app in here. */
  xcworkspace: path.join(repoRoot, "app", "RockyFeed.xcworkspace"),
  /** Tuist manifests, from task 3 onwards. */
  projectManifest: path.join(repoRoot, "app", "Project.swift"),
  tuistManifest: path.join(repoRoot, "app", "Tuist.swift"),
  corePackage: path.join(repoRoot, "app", "Core"),
  /** Per-participant state. Gitignored — never committed. */
  workshopDir: path.join(repoRoot, ".workshop"),
  statePath: path.join(repoRoot, ".workshop", "state.json"),
  measurementsDir: path.join(repoRoot, ".workshop", "measurements"),
  /** DerivedData we own, so benchmarks can clean it without nuking the user's. */
  derivedData: path.join(repoRoot, ".workshop", "DerivedData"),
  /**
   * The compilation cache (CAS) we own.
   *
   * Xcode defaults this to a *global* location under ~/Library/Developer/Xcode.
   * We point it inside .workshop/ instead, so the workshop never writes hundreds
   * of megabytes into the caches your day job depends on — and so we can wipe it
   * to demonstrate a cold cache without consequences.
   */
  compilationCache: path.join(repoRoot, ".workshop", "CompilationCache.noindex"),
} as const;

export const scheme = "RockyFeed";
export const destination = "generic/platform=iOS Simulator";
