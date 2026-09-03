import { cp, mkdir, writeFile } from "node:fs/promises";
import type { CapabilityManifest } from "@mergepilot/policy";
import { startMcpServer } from "../apps/repo-mcp/src/server.js";

const fixtureId = process.env.MERGEPILOT_FIXTURE_ID;
const encodedManifest = process.env.MERGEPILOT_MANIFEST_B64;
if (!fixtureId || !/^(entitlement-service|webhook-worker|react-access-console)$/.test(fixtureId)) {
  throw new Error("Validated fixture identifier is required");
}
if (!encodedManifest) throw new Error("Encoded capability manifest is required");
const manifest = JSON.parse(Buffer.from(encodedManifest, "base64").toString("utf8")) as CapabilityManifest;
if (manifest.fixtureId !== fixtureId) throw new Error("Fixture and manifest do not match");

const workspace = "/workspace/task";
await mkdir(workspace, { recursive: true });
await cp(`/app/fixtures/visible/${fixtureId}`, workspace, { recursive: true, errorOnExist: true });
await writeFile("/workspace/capability-manifest.json", JSON.stringify(manifest), { mode: 0o400 });

await startMcpServer({ workspace, manifest, secrets: [] });
