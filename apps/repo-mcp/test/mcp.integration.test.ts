import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CapabilityManifest } from "@mergepilot/policy";
import { createMcpServer } from "../src/server.js";

describe("repository MCP protocol", () => {
  let workspace: string;
  let client: Client;

  beforeEach(async () => {
    workspace = await mkdtemp(path.join(tmpdir(), "mergepilot-mcp-"));
    await mkdir(path.join(workspace, "src"));
    await writeFile(path.join(workspace, "src", "access.ts"), "export const allowed = true;\n", "utf8");
    const manifest: CapabilityManifest = {
      schemaVersion: 1,
      fixtureId: "entitlement-service",
      writablePrefixes: ["src/"],
      protectedPrefixes: [],
      checks: {},
      limits: { maxFiles: 3, maxPatchBytes: 8_192, maxChangedLines: 30 },
    };
    const server = await createMcpServer({ workspace, manifest, secrets: [] });
    client = new Client({ name: "mergepilot-test", version: "0.1.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await client.close();
    await rm(workspace, { recursive: true, force: true });
  });

  it("lists exactly the six bounded repository tools", async () => {
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual([
      "apply_patch",
      "get_diff",
      "inspect_tree",
      "read_file",
      "run_check",
      "search_code",
    ]);
  });

  it("returns structured content for a valid read", async () => {
    const result = await client.callTool({ name: "read_file", arguments: { path: "src/access.ts" } });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ path: "src/access.ts" });
  });

  it("returns a tool error for traversal", async () => {
    const result = await client.callTool({ name: "read_file", arguments: { path: "../secret.txt" } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain(workspace);
  });
});
