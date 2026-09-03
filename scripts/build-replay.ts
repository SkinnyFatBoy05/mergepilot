import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../packages/evaluation/src/report.js";
import { demoRun } from "../apps/web/src/lib/replay.js";

const secretPattern = /(sk-[A-Za-z0-9_-]+|(?:api[_-]?key|authorization|password)\s*[:=]\s*[^\s,;]+)/gi;

function sanitize(value: unknown): unknown {
  if (typeof value === "string") return value.replace(secretPattern, "[REDACTED]");
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !["prompts", "environment"].includes(key)).map(([key, entry]) => [key, sanitize(entry)]));
  return value;
}

export function buildPublicReplay(input: unknown) {
  const sanitized = sanitize(input) as Record<string, unknown>;
  return { schemaVersion: "1.0", generatedAt: new Date((Number(process.env.SOURCE_DATE_EPOCH) || 1_788_393_600) * 1_000).toISOString(), providerMode: "recorded", evaluationHash: sha256("evaluation/reports/latest.json"), run: sanitized };
}

async function main() {
  const index = process.argv.indexOf("--output");
  const output = resolve(index >= 0 ? process.argv[index + 1]! : "apps/web/public/replay/latest.json");
  const inputIndex = process.argv.indexOf("--input");
  const input = inputIndex >= 0 ? JSON.parse(await readFile(resolve(process.argv[inputIndex + 1]!), "utf8")) : demoRun;
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, canonicalJson(buildPublicReplay(input)));
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) await main();
