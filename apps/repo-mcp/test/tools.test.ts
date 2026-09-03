import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CapabilityManifest } from "@mergepilot/policy";
import { createRepositoryTools } from "../src/tools.js";

describe("bounded repository tools", () => {
  let workspace: string;
  let manifest: CapabilityManifest;

  beforeEach(async () => {
    workspace = await mkdtemp(path.join(tmpdir(), "mergepilot-tools-"));
    await mkdir(path.join(workspace, "src"));
    await writeFile(path.join(workspace, "src", "access.ts"), "one\ntwo\nthree\nfour\n", "utf8");
    manifest = {
      schemaVersion: 1,
      fixtureId: "entitlement-service",
      writablePrefixes: ["src/"],
      protectedPrefixes: ["src/protected.ts"],
      checks: {
        unit: {
          executable: process.execPath,
          args: ["-e", "console.log('token=secret-value')"],
          timeoutMs: 2_000,
        },
      },
      limits: { maxFiles: 3, maxPatchBytes: 8_192, maxChangedLines: 30 },
    };
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it("reads only bounded text ranges", async () => {
    const tools = createRepositoryTools({ workspace, manifest, secrets: [] });
    await expect(tools.readFile({ path: "src/access.ts", startLine: 0, endLine: 50 })).rejects.toThrow(/startLine/i);
    const result = await tools.readFile({ path: "src/access.ts", startLine: 2, endLine: 3 });
    expect(result.content).toBe("two\nthree");
  });

  it("never accepts command text", async () => {
    const tools = createRepositoryTools({ workspace, manifest, secrets: [] });
    await expect(tools.runCheck({ checkId: "unit", command: "whoami" } as never)).rejects.toThrow();
  });

  it("blocks protected patches before mutation", async () => {
    const tools = createRepositoryTools({ workspace, manifest, secrets: [] });
    const patch = [
      "--- a/src/protected.ts",
      "+++ b/src/protected.ts",
      "@@ -0,0 +1 @@",
      "+export const unsafe = true;",
      "",
    ].join("\n");
    await expect(tools.applyPatch({ patch })).rejects.toThrow(/protected/i);
  });

  it("applies an allowed patch and returns its digest", async () => {
    const tools = createRepositoryTools({ workspace, manifest, secrets: [] });
    const patch = [
      "--- a/src/access.ts",
      "+++ b/src/access.ts",
      "@@ -1,4 +1,4 @@",
      " one",
      "-two",
      "+TWO",
      " three",
      " four",
      "",
    ].join("\n");
    const result = await tools.applyPatch({ patch });
    expect(result).toMatchObject({ changedPaths: ["src/access.ts"], addedLines: 1, deletedLines: 1 });
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(await readFile(path.join(workspace, "src", "access.ts"), "utf8")).toContain("TWO");
  });

  it("runs only a trusted check and redacts its output", async () => {
    const tools = createRepositoryTools({ workspace, manifest, secrets: ["secret-value"] });
    const result = await tools.runCheck({ checkId: "unit" });
    expect(result.status).toBe("passed");
    expect(result.output).toContain("[REDACTED]");
    expect(result.output).not.toContain("secret-value");
  });
});
