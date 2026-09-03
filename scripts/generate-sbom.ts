import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { canonicalJson } from "../packages/evaluation/src/report.js";

const root = resolve(".");
const digest = async (file: string) => createHash("sha256").update(await readFile(resolve(root, file))).digest("hex");
async function packages(dir: string): Promise<Array<{ name: string; version: string; path: string }>> {
  const result: Array<{ name: string; version: string; path: string }> = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", ".worktrees", "dist", "test-results", "playwright-report"].includes(entry.name)) continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) result.push(...await packages(path));
    else if (entry.name === "package.json") { const manifest = JSON.parse(await readFile(path, "utf8")); result.push({ name: manifest.name ?? relative(root, dirname(path)), version: manifest.version ?? "0.0.0", path: relative(root, path).replaceAll("\\", "/") }); }
  }
  return result;
}
const components = (await packages(root)).sort((a, b) => a.name.localeCompare(b.name)).map((pkg) => ({ type: "application", name: pkg.name, version: pkg.version, "bom-ref": `pkg:npm/${encodeURIComponent(pkg.name)}@${pkg.version}`, purl: `pkg:npm/${encodeURIComponent(pkg.name)}@${pkg.version}`, properties: [{ name: "mergepilot:manifest", value: pkg.path }] }));
const lockHash = await digest("pnpm-lock.yaml");
const sourceHash = createHash("sha256").update(components.map((entry) => entry["bom-ref"]).join("\n")).digest("hex");
const taskSetHash = createHash("sha256").update((await readdir(resolve(root, "evaluation/tasks"))).sort().join("\n")).digest("hex");
const uuid = `${sourceHash.slice(0, 8)}-${sourceHash.slice(8, 12)}-4${sourceHash.slice(13, 16)}-8${sourceHash.slice(17, 20)}-${sourceHash.slice(20, 32)}`;
const sbom = { bomFormat: "CycloneDX", specVersion: "1.6", serialNumber: `urn:uuid:${uuid}`, version: 1, metadata: { timestamp: new Date((Number(process.env.SOURCE_DATE_EPOCH) || 1_788_393_600) * 1_000).toISOString(), component: { type: "application", name: "mergepilot", version: "0.1.0" }, properties: [{ name: "mergepilot:source-tree-sha256", value: sourceHash }, { name: "mergepilot:lockfile-sha256", value: lockHash }, { name: "mergepilot:evaluation-task-set-sha256", value: taskSetHash }] }, components };
await writeFile(resolve(root, "sbom.cdx.json"), canonicalJson(sbom));
console.log(`Generated CycloneDX SBOM with ${components.length} workspace components`);
