import { brand, formatDuration, symbols } from "./theme.js";
import { metricTitles, type Measurement, type MetricKey, type Stat } from "./measure.js";

const METRIC_ORDER: MetricKey[] = ["resolve", "cleanBuild", "incremental", "touchCore"];

const pad = (text: string, width: number): string =>
  text.length >= width ? text : text + " ".repeat(width - text.length);

const padStart = (text: string, width: number): string =>
  text.length >= width ? text : " ".repeat(width - text.length) + text;

const formatStat = (stat: Stat): string =>
  `${formatDuration(stat.mean)} ${brand.dim(`± ${formatDuration(stat.stddev)}`)}`;

/** Renders a measurement as a small table. */
export const renderMeasurement = (measurement: Measurement): string => {
  const rows = METRIC_ORDER.filter((key) => measurement.metrics[key]);
  const labelWidth = Math.max(...rows.map((key) => metricTitles[key].length));

  const lines = rows.map((key) => {
    const stat = measurement.metrics[key];
    if (!stat) return "";
    return `${pad(metricTitles[key], labelWidth)}  ${formatStat(stat)}`;
  });

  return lines.join("\n");
};

/**
 * Renders a measurement against the baseline, so an improvement (or a
 * regression) is impossible to miss.
 */
export const renderComparison = (baseline: Measurement, current: Measurement): string => {
  const rows = METRIC_ORDER.filter((key) => baseline.metrics[key] && current.metrics[key]);
  const labelWidth = Math.max(...rows.map((key) => metricTitles[key].length));

  const lines = rows.map((key) => {
    const before = baseline.metrics[key];
    const after = current.metrics[key];
    if (!before || !after) return "";

    const delta = (after.mean - before.mean) / before.mean;
    const percent = `${Math.abs(delta * 100).toFixed(0)}%`;

    // Only call it a change if it clears the combined noise of both runs.
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
      pad(metricTitles[key], labelWidth),
      padStart(formatDuration(before.mean), 8),
      brand.dim("→"),
      padStart(formatDuration(after.mean), 8),
      verdict,
    ].join("  ");
  });

  return lines.join("\n");
};

export const renderMachine = (measurement: Measurement): string =>
  brand.dim(
    `${measurement.machine.model} · ${measurement.machine.cores} cores · ` +
      `${measurement.machine.memoryGB} GB · ${measurement.machine.xcode}`,
  );
