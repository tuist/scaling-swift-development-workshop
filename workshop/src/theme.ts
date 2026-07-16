import pc from "picocolors";

/**
 * Tuist's brand colours, chosen to stay legible on both light and dark terminals.
 *
 * Two rules learned the hard way:
 *
 *  - Never use the ANSI *dim attribute* for anything anyone has to read. Many
 *    terminals render it as barely-there grey, and on a light theme it vanishes.
 *    Secondary text uses an explicit mid-grey instead, which has real contrast
 *    against both a near-white and a near-black background.
 *
 *  - The accent is a touch lighter than Tuist's #6f2cff, which is handsome on
 *    white and nearly invisible on a dark terminal.
 */
const PURPLE = [130, 87, 255] as const;
const PURPLE_DIM = [150, 120, 235] as const;
const GREY = [124, 124, 140] as const;

const supportsTrueColor = (): boolean => {
  const term = process.env["COLORTERM"] ?? "";
  return term.includes("truecolor") || term.includes("24bit");
};

const rgb = (color: readonly [number, number, number], text: string): string => {
  if (!pc.isColorSupported) return text;
  // Fall back to the nearest ANSI colour when the terminal can't do 24-bit.
  if (!supportsTrueColor()) return pc.magenta(text);
  const [r, g, b] = color;
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
};

const grey = (text: string): string => {
  if (!pc.isColorSupported) return text;
  if (!supportsTrueColor()) return pc.gray(text);
  const [r, g, b] = GREY;
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
};

export const brand = {
  accent: (text: string) => rgb(PURPLE, text),
  accentDim: (text: string) => rgb(PURPLE_DIM, text),
  bold: (text: string) => pc.bold(text),
  /** Secondary text. Readable — see the note above about the dim attribute. */
  dim: (text: string) => grey(text),
  success: (text: string) => pc.green(text),
  warn: (text: string) => pc.yellow(text),
  error: (text: string) => pc.red(text),
  info: (text: string) => pc.cyan(text),
};

export const symbols = {
  pass: pc.green("✔"),
  fail: pc.red("✘"),
  pending: grey("○"),
  arrow: grey("›"),
  faster: pc.green("▼"),
  slower: pc.red("▲"),
};

/** Formats seconds as a short human duration, e.g. `1m 12s` or `840ms`. */
export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
};
