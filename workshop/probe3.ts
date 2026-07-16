import { benchmark, saveMeasurement, metricTitles, type MetricKey, type Stat } from "./src/measure.js";
import { renderMeasurement, renderMachine } from "./src/report.js";
const keys: MetricKey[] = ["resolve", "cleanBuild", "incremental", "touchCore"];
const metrics: Partial<Record<MetricKey, Stat>> = {};
for (const key of keys) {
  const s = await benchmark(key, 2);
  metrics[key] = s;
  console.log(`  ${metricTitles[key].padEnd(40)} ${s.mean.toFixed(1)}s ± ${s.stddev.toFixed(2)}s`);
}
const m = await saveMeasurement("baseline", metrics);
console.log("\n=== as the participant sees it ===");
console.log(renderMeasurement(m));
console.log(renderMachine(m));
const tax = (metrics.touchCore!.mean / metrics.incremental!.mean);
console.log(`\ngod-module tax: ${tax.toFixed(1)}x a no-op build`);
