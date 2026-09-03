import { fixtureIdSchema } from "@mergepilot/contracts";
import type { CapabilityManifest } from "@mergepilot/policy";

export interface DockerSessionInput {
  readonly manifest: CapabilityManifest;
  readonly image: string;
}

export function buildDockerArgs(input: DockerSessionInput): readonly string[] {
  const fixtureId = fixtureIdSchema.parse(input.manifest.fixtureId);
  if (!/^[a-z0-9][a-z0-9._/-]{0,127}(?::[a-z0-9][a-z0-9._-]{0,127})?$/.test(input.image)) {
    throw new Error("Runner image name is invalid");
  }
  const manifest = Buffer.from(JSON.stringify(input.manifest), "utf8").toString("base64");
  return [
    "run",
    "--rm",
    "-i",
    "--network",
    "none",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    "128",
    "--memory",
    "512m",
    "--cpus",
    "1",
    "--user",
    "10001:10001",
    "--tmpfs",
    "/workspace:rw,nosuid,nodev,size=128m",
    "--env",
    `MERGEPILOT_FIXTURE_ID=${fixtureId}`,
    "--env",
    `MERGEPILOT_MANIFEST_B64=${manifest}`,
    input.image,
  ];
}
