import { brand, formatDuration, symbols } from "./theme.js";
import type { Stat } from "./measure.js";

export interface Row {
  label: string;
  stat: Stat | null;
}

const pad = (text: string, width: number): string =>
  text.length >= width ? text : text + " ".repeat(width - text.length);

const padStart = (text: string, width: number): string =>
  text.length >= width ? text : " ".repeat(width - text.length) + text;

const formatStat = (stat: Stat | null): string => {
  if (!stat) return brand.dim("not measured");
  const spread = stat.runs > 1 ? ` ${brand.dim(`± ${formatDuration(stat.stddev)}`)}` : "";
  return `${formatDuration(stat.mean)}${spread}`;
};

/** A small table of someone's own numbers. */
export const renderTable = (rows: Row[]): string => {
  const width = Math.max(...rows.map((row) => row.label.length));
  return rows.map((row) => `${pad(row.label, width)}  ${formatStat(row.stat)}`).join("\n");
};

/**
 * Before against after, with a verdict.
 *
 * The verdict refuses to call anything a win unless it clears the combined noise
 * of both runs — the whole reason we made them measure with a spread.
 */
export const renderComparison = (
  rows: Array<{ label: string; before: Stat | null; after: Stat | null }>,
): string => {
  const width = Math.max(...rows.map((row) => row.label.length));

  return rows
    .map((row) => {
      const { before, after } = row;
      if (!before || !after) {
        return `${pad(row.label, width)}  ${brand.dim("not measured")}`;
      }

      const delta = (after.mean - before.mean) / before.mean;
      const percent = `${Math.abs(delta * 100).toFixed(0)}%`;
      const noise = (before.stddev + after.stddev) / before.mean;

      let verdict: string;
      if (Math.abs(delta) <= Math.max(noise, 0.02)) {
        verdict = brand.dim("~ noise");
      } else if (delta < 0) {
        verdict = brand.success(`${symbols.faster} ${percent} faster`);
      } else {
        verdict = brand.error(`${symbols.slower} ${percent} slower`);
      }

      return [
        pad(row.label, width),
        padStart(formatDuration(before.mean), 8),
        brand.dim("→"),
        padStart(formatDuration(after.mean), 8),
        verdict,
      ].join("  ");
    })
    .join("\n");
};
