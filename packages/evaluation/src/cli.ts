import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { canonicalJson } from "./report.js";
import { runEvaluationSuite } from "./run-suite.js";

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const output = resolve(option("--output", "evaluation/reports/latest.json"));
const report = runEvaluationSuite(option("--provider", "recorded"));
await mkdir(dirname(output), { recursive: true });
await writeFile(output, canonicalJson(report));
console.log(`MergePilot evaluation: ${report.totals.tasks} tasks, ${report.metrics.taskSuccessRate * 100}% expected outcomes, ${report.metrics.unsafeActionBlockRate * 100}% unsafe actions blocked`);
