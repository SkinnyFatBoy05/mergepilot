import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PolicyError } from "@mergepilot/policy";
import { z } from "zod";
import { loadCapabilityManifest } from "./capability-manifest.js";
import { createRepositoryTools, repositoryToolSchemas, type ToolContext } from "./tools.js";

function success(value: object, summary: string) {
  return {
    content: [{ type: "text" as const, text: summary }],
    structuredContent: value as Record<string, unknown>,
  };
}

function failure(error: unknown) {
  const text = error instanceof PolicyError
    ? `Request blocked by repository policy (${error.code}).`
    : error instanceof z.ZodError
      ? "Repository tool input was invalid."
      : "Repository tool failed safely.";
  return { isError: true as const, content: [{ type: "text" as const, text }] };
}

async function safely<T extends object>(operation: () => Promise<T>, summary: (value: T) => string) {
  try {
    const value = await operation();
    return success(value, summary(value));
  } catch (error) {
    return failure(error);
  }
}

export async function createMcpServer(context: ToolContext): Promise<McpServer> {
  const server = new McpServer({ name: "mergepilot-repository", version: "0.1.0" });
  const tools = createRepositoryTools(context);

  server.registerTool("inspect_tree", {
    description: "List bounded file paths inside the isolated task workspace.",
    inputSchema: repositoryToolSchemas.inspect_tree,
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  }, (input) => safely(() => tools.inspectTree(input), (value) => `Listed ${value.paths.length} repository paths.`));

  server.registerTool("search_code", {
    description: "Search text inside bounded repository files.",
    inputSchema: repositoryToolSchemas.search_code,
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  }, (input) => safely(() => tools.searchCode(input), (value) => `Found ${value.matches.length} code matches.`));

  server.registerTool("read_file", {
    description: "Read a bounded line range from one text file inside the task workspace.",
    inputSchema: repositoryToolSchemas.read_file,
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  }, (input) => safely(() => tools.readFile(input), (value) => `Read ${value.path} lines ${value.startLine}-${value.endLine}.`));

  server.registerTool("apply_patch", {
    description: "Apply a unified diff only after independent path and size policy checks.",
    inputSchema: repositoryToolSchemas.apply_patch,
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: true, idempotentHint: false },
  }, (input) => safely(() => tools.applyPatch(input), (value) => `Applied a bounded patch to ${value.changedPaths.length} files.`));

  server.registerTool("get_diff", {
    description: "Return the bounded current workspace diff and its digest.",
    inputSchema: repositoryToolSchemas.get_diff,
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  }, (input) => safely(() => tools.getDiff(input), () => "Read the current repository diff."));

  server.registerTool("run_check", {
    description: "Run one trusted manifest check by identifier; command text is never accepted.",
    inputSchema: repositoryToolSchemas.run_check,
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  }, (input) => safely(() => tools.runCheck(input), (value) => `Check ${value.checkId} ${value.status}.`));

  return server;
}

export async function startMcpServer(context: ToolContext): Promise<void> {
  const server = await createMcpServer(context);
  await server.connect(new StdioServerTransport());
}

async function main(): Promise<void> {
  const workspace = process.env.MERGEPILOT_WORKSPACE;
  const manifestPath = process.env.MERGEPILOT_MANIFEST;
  if (!workspace || !manifestPath) throw new Error("MERGEPILOT_WORKSPACE and MERGEPILOT_MANIFEST are required");
  const manifest = await loadCapabilityManifest(manifestPath);
  await startMcpServer({
    workspace,
    manifest,
    secrets: (process.env.MERGEPILOT_SECRETS ?? "").split(",").filter(Boolean),
  });
}

const entryPath = process.argv[1]?.replaceAll("\\", "/");
if (entryPath && import.meta.url.endsWith(entryPath)) await main();
