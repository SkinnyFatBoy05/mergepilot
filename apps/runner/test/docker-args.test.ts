import { describe, expect, it } from "vitest";
import type { CapabilityManifest } from "@mergepilot/policy";
import { buildDockerArgs } from "../src/docker-args.js";

const manifest: CapabilityManifest = {
  schemaVersion: 1,
  fixtureId: "webhook-worker",
  writablePrefixes: ["src/", "test/"],
  protectedPrefixes: ["capability-manifest.json"],
  checks: { unit: { executable: "node", args: ["--test"], timeoutMs: 30_000 } },
  limits: { maxFiles: 6, maxPatchBytes: 32_768, maxChangedLines: 240 },
};

describe("buildDockerArgs", () => {
  it("builds a networkless non-root disposable runner", () => {
    const args = buildDockerArgs({ manifest, image: "mergepilot-runner:test" });
    expect(args).toEqual(expect.arrayContaining([
      "run", "--rm", "-i", "--network", "none", "--read-only",
      "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
      "--pids-limit", "128", "--memory", "512m", "--cpus", "1",
      "--user", "10001:10001",
    ]));
    expect(args).toContain("/workspace:rw,nosuid,nodev,size=128m");
    expect(args.at(-1)).toBe("mergepilot-runner:test");
    expect(args.join(" ")).not.toContain("docker.sock");
  });

  it("serializes only the validated manifest as data", () => {
    const args = buildDockerArgs({ manifest, image: "mergepilot-runner:test" });
    const encoded = args.find((entry) => entry.startsWith("MERGEPILOT_MANIFEST_B64="))?.split("=").at(1);
    expect(JSON.parse(Buffer.from(encoded!, "base64").toString("utf8"))).toEqual(manifest);
  });
});
