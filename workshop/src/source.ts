import fs from "node:fs/promises";
import { fromRoot } from "./paths.js";

/**
 * Reads a source file with its comments removed.
 *
 * Validators are supposed to check what the code does, and a comment is not code.
 * This matters more than it sounds: our own solutions explain the mistake they
 * fixed by *quoting* it —
 *
 *     // It used to sleep for Int.random(in: 40 ... 120) and assert a budget.
 *
 * — so a validator grepping the raw text finds the very thing it is checking for
 * and fails work that is correct. Both task 7 and task 8 did exactly that, on
 * their own solution branches. Strip first, then match.
 *
 * Returns "" when the file is missing, so a validator can say "you haven't done
 * this yet" instead of throwing a stack trace at someone who mistyped a path.
 *
 * Not a Swift parser: a `//` inside a string literal preceded by whitespace would
 * be cut. Fine for grepping a known file for a known construct; don't grow it
 * into something load-bearing.
 */
export const readCode = async (relative: string): Promise<string> => {
  let raw: string;
  try {
    raw = await fs.readFile(fromRoot(relative), "utf8");
  } catch {
    return "";
  }
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/^\s*\/\/.*$/gm, "") // whole-line comments
    .replace(/\s\/\/.*$/gm, ""); // trailing comments — `https://` is safe, no space
};

/** Reads a file verbatim, comments and all. */
export const readRaw = async (relative: string): Promise<string> => {
  try {
    return await fs.readFile(fromRoot(relative), "utf8");
  } catch {
    return "";
  }
};
