import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CapabilityManifest } from "@mergepilot/policy";
import { buildDockerArgs } from "./docker-args.js";

export interface OpenSessionInput {
  readonly manifest: CapabilityManifest;
  readonly image: string;
  readonly deadlineMs?: number;
}

export interface RepositorySession {
  call<T extends Record<string, unknown>>(name: string, arguments_: Record<string, unknown>): Promise<T>;
  close(): Promise<void>;
}

class McpRepositorySession implements RepositorySession {
  private closed = false;

  constructor(
    private readonly client: Client,
    private readonly transport: StdioClientTransport,
    private readonly deadline: ReturnType<typeof setTimeout>,
  ) {}

  async call<T extends Record<string, unknown>>(name: string, arguments_: Record<string, unknown>): Promise<T> {
    if (this.closed) throw new Error("Container session is closed");
    const result = await this.client.callTool({ name, arguments: arguments_ });
    if (result.isError) throw new Error(`Repository tool ${name} failed`);
    return result.structuredContent as T;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.deadline);
    await this.client.close();
    await this.transport.close();
  }
}

export class ContainerSession {
  static async open(input: OpenSessionInput): Promise<RepositorySession> {
    const transport = new StdioClientTransport({
      command: "docker",
      args: [...buildDockerArgs(input)],
      stderr: "pipe",
    });
    const client = new Client({ name: "mergepilot-control-plane", version: "0.1.0" });
    await client.connect(transport);
    let session: McpRepositorySession | undefined;
    const deadline = setTimeout(() => void session?.close(), input.deadlineMs ?? 5 * 60_000);
    session = new McpRepositorySession(client, transport, deadline);
    return session;
  }
}
