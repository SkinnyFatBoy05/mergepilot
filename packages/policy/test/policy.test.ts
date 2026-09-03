import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  inspectPatch,
  redactOutput,
  resolveInsideWorkspace,
  resolveTrustedCheck,
  type CapabilityManifest,
} from "../src/index.js";

let workspace: string;
let manifest: CapabilityManifest;

beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), "mergepilot-policy-"));
  await mkdir(path.join(workspace, "src"));
  await writeFile(path.join(workspace, "src", "access.ts"), "export const access = true;\n");
  manifest = {
    schemaVersion: 1,
    fixtureId: "entitlement-service",
    writablePrefixes: ["src/", "test/"],
    protectedPrefixes: ["evaluation/", "policy/", "runner/"],
    checks: {
      unit: { executable: "node", args: ["--test"], timeoutMs: 30_000 },
    },
    limits: { maxFiles: 12, maxPatchBytes: 32_768, maxChangedLines: 500 },
  };
});

describe("workspace path policy", () => {
  it.each(["../secret", "C:\\Windows\\win.ini", "/etc/passwd", "src/../../secret"])(
    "rejects path escape %s",
    async (requested) => {
      await expect(resolveInsideWorkspace(workspace, requested)).rejects.toThrow(/workspace/i);
    },
  );

  it("returns the canonical path for a permitted file", async () => {
    await expect(resolveInsideWorkspace(workspace, "src/access.ts")).resolves.toBe(
      path.join(workspace, "src", "access.ts"),
    );
  });
});

describe("patch and check policy", () => {
  it("blocks protected files", () => {
    const patchText = [
      "--- a/evaluation/oracles/access.test.ts",
      "+++ b/evaluation/oracles/access.test.ts",
      "@@ -1 +1 @@",
      "-expect(false)",
      "+expect(true)",
      "",
    ].join("\n");
    expect(inspectPatch(patchText, manifest)).toMatchObject({ allowed: false });
  });

  it("allows a bounded source patch and counts changed lines", () => {
    const patchText = [
      "--- a/src/access.ts",
      "+++ b/src/access.ts",
      "@@ -1 +1 @@",
      "-export const access = true;",
      "+export const access = false;",
      "",
    ].join("\n");
    expect(inspectPatch(patchText, manifest)).toMatchObject({
      allowed: true,
      changedPaths: ["src/access.ts"],
      addedLines: 1,
      deletedLines: 1,
    });
  });

  it("rejects an unknown check identifier", () => {
    expect(() => resolveTrustedCheck("shell-rm", manifest)).toThrow(/unknown check/i);
  });
});

describe("output redaction", () => {
  it("redacts exact secrets before returning output", () => {
    expect(redactOutput("token=abc123", ["abc123"], 64)).toBe("token=[REDACTED]");
  });

  it("adds a marker when output exceeds its byte budget", () => {
    expect(redactOutput("0123456789abcdefghij", [], 10)).toBe("0123456789\n...[truncated]");
  });
});
