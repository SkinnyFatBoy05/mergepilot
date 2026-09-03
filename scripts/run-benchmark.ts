import { cpus } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../packages/evaluation/src/report.js";
import { inspectPatch } from "../packages/policy/src/patch-policy.js";
import { runEvaluationSuite } from "../packages/evaluation/src/run-suite.js";

export function summarizeDurations(samples: number[]) { const sorted = [...samples].sort((a, b) => a - b); return { samples: sorted.length, medianMs: sorted[Math.floor(sorted.length / 2)] ?? 0, p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0 }; }
const manifest = { schemaVersion: 1 as const, fixtureId: "entitlement-service" as const, writablePrefixes: ["src/"], protectedPrefixes: ["evaluation/"], checks: {}, limits: { maxFiles: 8, maxPatchBytes: 32768, maxChangedLines: 300 } };
const patch = "--- a/src/x.ts\n+++ b/src/x.ts\n@@ -1 +1 @@\n-old\n+new\n";
const operations: Record<string, () => unknown> = { artifactHashing: () => sha256(canonicalJson(runEvaluationSuite())), patchPolicy: () => inspectPatch(patch, manifest), reportSerialization: () => canonicalJson(runEvaluationSuite()), replayLoading: () => JSON.parse(canonicalJson({ run: "demo" })) };

async function main() {
  const outputIndex = process.argv.indexOf("--output"); const output = resolve(outputIndex >= 0 ? process.argv[outputIndex + 1]! : "reports/benchmark.json");
  const measured: Record<string, ReturnType<typeof summarizeDurations>> = {};
  for (const [name, operation] of Object.entries(operations)) { for (let index = 0; index < 10; index++) operation(); const samples: number[] = []; for (let index = 0; index < 50; index++) { const start = performance.now(); operation(); samples.push(Math.round((performance.now() - start) * 1000) / 1000); } measured[name] = summarizeDurations(samples); }
  const report = { schemaVersion: "1.0", generatedAt: new Date((Number(process.env.SOURCE_DATE_EPOCH) || Math.floor(Date.now() / 1000)) * 1_000).toISOString(), runtime: process.version, platform: process.platform, cpu: cpus()[0]?.model ?? "unknown", commit: process.env.GITHUB_SHA ?? "local-worktree", inputHash: sha256(patch), operations: measured, limitations: ["Local microbenchmark only; not throughput, availability, or a production SLA."] };
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, canonicalJson(report)); console.log(`Wrote ${Object.keys(measured).length} local benchmark measurements`);
}
if (import.meta.url === pathToFileURL(process.argv[1]!).href) await main();
