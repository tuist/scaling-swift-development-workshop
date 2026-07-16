import pc from "picocolors";

/**
 * Tuist's brand palette, approximated for 256-colour terminals.
 *
 * We only borrow the colours — the workshop runner is intentionally its own
 * thing rather than a full Noora reimplementation.
 */
const PURPLE = [111, 44, 255] as const;
const PURPLE_DIM = [150, 110, 240] as const;

const supportsTrueColor = (): boolean => {
  const term = process.env["COLORTERM"] ?? "";
  return term.includes("truecolor") || term.includes("24bit");
};

const rgb = (color: readonly [number, number, number], text: string): string => {
  if (!pc.isColorSupported) return text;
  if (!supportsTrueColor()) return pc.magenta(text);
  const [r, g, b] = color;
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
};

export const brand = {
  accent: (text: string) => rgb(PURPLE, text),
  accentDim: (text: string) => rgb(PURPLE_DIM, text),
  bold: (text: string) => pc.bold(text),
  dim: (text: string) => pc.dim(text),
  success: (text: string) => pc.green(text),
  warn: (text: string) => pc.yellow(text),
  error: (text: string) => pc.red(text),
  info: (text: string) => pc.cyan(text),
};

export const symbols = {
  pass: pc.green("✔"),
  fail: pc.red("✘"),
  pending: pc.dim("○"),
  arrow: pc.dim("›"),
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
