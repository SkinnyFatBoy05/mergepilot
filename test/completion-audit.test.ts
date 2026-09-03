import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { auditProject } from "../scripts/completion-audit.js";

it("fails closed when evidence is missing or claims exceed reports", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "mergepilot-audit-"));
  await mkdir(resolve(root, "portfolio"), { recursive: true });
  await writeFile(resolve(root, "README.md"), "deployed to production for customers");
  await writeFile(resolve(root, "portfolio/resume-bullets.md"), "measured locally");
  const result = await auditProject(root);
  expect(result.passed).toBe(false);
  expect(result.failures).toContainEqual(expect.objectContaining({ code: "missing-evaluation-report" }));
  expect(result.failures).toContainEqual(expect.objectContaining({ code: "unsupported-production-claim" }));
});
