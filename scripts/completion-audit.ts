import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson } from "../packages/evaluation/src/report.js";

export interface AuditFailure { code: string; detail: string }
export interface AuditResult { schemaVersion: "1.0"; passed: boolean; checkedAt: string; checks: number; failures: AuditFailure[] }
const required = ["README.md", "LICENSE", "SECURITY.md", "docs/architecture.md", "docs/threat-model.md", "docs/runbook.md", "docs/demo-script.md", "docs/claim-evidence.md", "docs/interview-stories.md", "docs/fixture-provenance.md", "docs/screenshots/desktop.png", "docs/screenshots/mobile.png", "evaluation/reports/latest.json", "apps/web/public/replay/latest.json", "reports/benchmark.json", "sbom.cdx.json", ".github/workflows/ci.yml"];

async function exists(path: string) { try { await stat(path); return true; } catch { return false; } }
async function nestedGit(dir: string, root: string): Promise<string[]> { const found: string[] = []; for (const entry of await readdir(dir, { withFileTypes: true })) { if (["node_modules", "dist", "test-results", "playwright-report"].includes(entry.name)) continue; const path = resolve(dir, entry.name); if (entry.isDirectory() && entry.name === ".git" && path !== resolve(root, ".git")) found.push(path); else if (entry.isDirectory()) found.push(...await nestedGit(path, root)); } return found; }

export async function auditProject(root: string): Promise<AuditResult> {
  const failures: AuditFailure[] = [];
  for (const file of required) if (!await exists(resolve(root, file))) failures.push({ code: file === "evaluation/reports/latest.json" ? "missing-evaluation-report" : "missing-evidence", detail: file });
  for (const image of ["docs/screenshots/desktop.png", "docs/screenshots/mobile.png"]) if (await exists(resolve(root, image))) { const bytes = await readFile(resolve(root, image)); if (bytes.length < 1000 || !bytes.subarray(1, 4).equals(Buffer.from("PNG"))) failures.push({ code: "invalid-screenshot", detail: image }); }
  if (await exists(resolve(root, "evaluation/reports/latest.json"))) { const report = JSON.parse(await readFile(resolve(root, "evaluation/reports/latest.json"), "utf8")); const ids = report.results?.map((entry: { taskId: string }) => entry.taskId) ?? []; if (ids.length !== 12 || new Set(ids).size !== 12 || report.totals?.expectedPolicyBlocks !== 3) failures.push({ code: "invalid-evaluation-report", detail: "Expected 12 unique tasks and three expected policy blocks" }); }
  if (await exists(resolve(root, "apps/web/public/replay/latest.json"))) { const replay = await readFile(resolve(root, "apps/web/public/replay/latest.json"), "utf8"); if (/sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}/.test(replay) || /"prompts"|"environment"/.test(replay)) failures.push({ code: "replay-secret-exposure", detail: "Public replay contains a prohibited field or credential pattern" }); }
  if (await exists(resolve(root, "sbom.cdx.json"))) { const sbom = JSON.parse(await readFile(resolve(root, "sbom.cdx.json"), "utf8")); if (sbom.bomFormat !== "CycloneDX" || sbom.specVersion !== "1.6" || !Array.isArray(sbom.components)) failures.push({ code: "invalid-sbom", detail: "SBOM must be CycloneDX 1.6" }); }
  for (const file of ["README.md", "portfolio/resume-bullets.md"]) if (await exists(resolve(root, file))) { const copy = await readFile(resolve(root, file), "utf8"); if (/deployed to production for customers/i.test(copy)) failures.push({ code: "unsupported-production-claim", detail: file }); }
  if ((await nestedGit(root, root)).length > 0) failures.push({ code: "nested-git", detail: "Project contains a nested .git directory" });
  const result: AuditResult = { schemaVersion: "1.0", passed: failures.length === 0, checkedAt: new Date((Number(process.env.SOURCE_DATE_EPOCH) || 1_788_393_600) * 1_000).toISOString(), checks: required.length + 6, failures };
  return result;
}

async function main() { const root = resolve("."); const result = await auditProject(root); await writeFile(resolve(root, "reports/completion-audit.json"), canonicalJson(result)); console.log(`Completion audit: ${result.passed ? "PASS" : "FAIL"} (${result.checks} checks, ${result.failures.length} failures)`); if (!result.passed) process.exitCode = 1; }
if (import.meta.url === pathToFileURL(process.argv[1]!).href) await main();
