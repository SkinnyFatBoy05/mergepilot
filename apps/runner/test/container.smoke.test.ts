import { describe, expect, it } from "vitest";
import type { CapabilityManifest } from "@mergepilot/policy";
import { ContainerSession } from "../src/container-session.js";

const image = process.env.MERGEPILOT_RUNNER_IMAGE;

describe.skipIf(!image)("runner container", () => {
  it("reads and checks a fixture, blocks traversal, and closes", async () => {
    const manifest: CapabilityManifest = {
      schemaVersion: 1,
      fixtureId: "webhook-worker",
      writablePrefixes: ["src/", "test/"],
      protectedPrefixes: [],
      checks: { unit: { executable: "pnpm", args: ["test"], timeoutMs: 30_000 } },
      limits: { maxFiles: 6, maxPatchBytes: 32_768, maxChangedLines: 240 },
    };
    const session = await ContainerSession.open({ manifest, image: image! });
    try {
      await expect(session.call("read_file", { path: "README.md" })).resolves.toMatchObject({ path: "README.md" });
      await expect(session.call("read_file", { path: "../secret.txt" })).rejects.toThrow(/failed/i);
      await expect(session.call("run_check", { checkId: "unit" })).resolves.toMatchObject({ status: "passed" });
    } finally {
      await session.close();
    }
  }, 90_000);
});
