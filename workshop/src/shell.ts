import { execa } from "execa";
import { paths } from "./paths.js";

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  ok: boolean;
}

/**
 * Runs a command without throwing. Validators care about exit codes and output,
 * not exceptions.
 */
export const run = async (
  command: string,
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {},
): Promise<RunResult> => {
  try {
    const result = await execa(command, args, {
      cwd: options.cwd ?? paths.repoRoot,
      env: options.env,
      reject: false,
      all: false,
    });
    return {
      exitCode: result.exitCode ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      ok: (result.exitCode ?? 1) === 0,
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      ok: false,
    };
  }
};

/** True when a binary is resolvable on PATH. */
export const hasBinary = async (name: string): Promise<boolean> => {
  const result = await run("which", [name]);
  return result.ok;
};

export const git = async (args: string[]): Promise<RunResult> =>
  run("git", args, { cwd: paths.repoRoot });
