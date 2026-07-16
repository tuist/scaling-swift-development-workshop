import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repository root (the directory holding mise.toml). */
export const repoRoot = path.resolve(here, "..", "..");

export const paths = {
  repoRoot,
  /** The sample project we spend the workshop fixing. */
  app: path.join(repoRoot, "app"),
  xcodeproj: path.join(repoRoot, "app", "RockyFeed.xcodeproj"),
  corePackage: path.join(repoRoot, "app", "Core"),
  /** Per-participant state. Gitignored — never committed. */
  workshopDir: path.join(repoRoot, ".workshop"),
  statePath: path.join(repoRoot, ".workshop", "state.json"),
  measurementsDir: path.join(repoRoot, ".workshop", "measurements"),
  /** DerivedData we own, so benchmarks can clean it without nuking the user's. */
  derivedData: path.join(repoRoot, ".workshop", "DerivedData"),
} as const;

export const scheme = "RockyFeed";
export const destination = "generic/platform=iOS Simulator";
