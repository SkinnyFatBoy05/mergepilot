import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  inspectPatch,
  PolicyError,
  redactOutput,
  resolveInsideWorkspace,
  resolveTrustedCheck,
  type CapabilityManifest,
} from "@mergepilot/policy";
import { z } from "zod";

const inspectTreeInput = z.object({
  path: z.string().default("."),
  depth: z.number().int().min(0).max(12).default(5),
}).strict();
const searchCodeInput = z.object({
  query: z.string().min(1).max(200),
  path: z.string().default("."),
  maxResults: z.number().int().min(1).max(100).default(100),
}).strict();
const readFileInput = z.object({
  path: z.string().min(1),
  startLine: z.number().int().min(1).default(1),
  endLine: z.number().int().min(1).max(1_000_000).optional(),
}).strict();
const applyPatchInput = z.object({ patch: z.string().min(1) }).strict();
const getDiffInput = z.object({}).strict();
const runCheckInput = z.object({ checkId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/) }).strict();

export const repositoryToolSchemas = {
  inspect_tree: inspectTreeInput,
  search_code: searchCodeInput,
  read_file: readFileInput,
  apply_patch: applyPatchInput,
  get_diff: getDiffInput,
  run_check: runCheckInput,
} as const;

export interface ToolContext {
  readonly workspace: string;
  readonly manifest: CapabilityManifest;
  readonly secrets: readonly string[];
  readonly trustedEnv?: Readonly<Record<string, string>>;
}

export interface CheckOutput {
  checkId: string;
  status: "passed" | "failed" | "timed_out";
  exitCode: number;
  durationMs: number;
  output: string;
  outputHash: string;
}

export interface RepositoryTools {
  inspectTree(input: unknown): Promise<{ paths: string[]; truncated: boolean }>;
  searchCode(input: unknown): Promise<{ matches: Array<{ path: string; line: number; text: string }>; truncated: boolean }>;
  readFile(input: unknown): Promise<{ path: string; content: string; startLine: number; endLine: number; truncated: boolean }>;
  applyPatch(input: unknown): Promise<{ changedPaths: readonly string[]; addedLines: number; deletedLines: number; hash: string }>;
  getDiff(input: unknown): Promise<{ diff: string; hash: string; truncated: boolean }>;
  runCheck(input: unknown): Promise<CheckOutput>;
}

const MAX_TREE_PATHS = 500;
const MAX_READ_LINES = 400;
const MAX_READ_BYTES = 64 * 1024;
const MAX_DIFF_BYTES = 128 * 1024;

function digest(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function portable(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function trustedEnvironment(context: ToolContext): NodeJS.ProcessEnv {
  const inherited = ["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "TEMP", "TMP"];
  const env: NodeJS.ProcessEnv = {};
  for (const key of inherited) if (process.env[key]) env[key] = process.env[key];
  return { ...env, ...context.trustedEnv };
}

async function collectFiles(root: string, requestedPath: string, depth: number, limit: number): Promise<{ files: string[]; truncated: boolean }> {
  const absolute = await resolveInsideWorkspace(root, requestedPath);
  const info = await stat(absolute);
  if (info.isFile()) return { files: [portable(path.relative(root, absolute))], truncated: false };
  const files: string[] = [];
  let truncated = false;
  async function visit(directory: string, remaining: number): Promise<void> {
    if (files.length >= limit) { truncated = true; return; }
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink() || entry.name === ".git" || entry.name === "node_modules") continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (remaining > 0) await visit(fullPath, remaining - 1);
      } else if (entry.isFile()) {
        files.push(portable(path.relative(root, fullPath)));
      }
      if (files.length >= limit) { truncated = true; return; }
    }
  }
  await visit(absolute, depth);
  return { files, truncated };
}

function runProcess(
  executable: string,
  args: readonly string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number; input?: string },
): Promise<{ output: string; exitCode: number; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [...args], { cwd: options.cwd, env: options.env, shell: false, windowsHide: true });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", reject);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ output: Buffer.concat(chunks).toString("utf8"), exitCode: code ?? -1, timedOut });
    });
    if (options.input !== undefined) child.stdin.end(options.input);
  });
}

export function createRepositoryTools(context: ToolContext): RepositoryTools {
  return {
    async inspectTree(rawInput) {
      const input = inspectTreeInput.parse(rawInput);
      const result = await collectFiles(context.workspace, input.path, input.depth, MAX_TREE_PATHS);
      return { paths: result.files, truncated: result.truncated };
    },

    async searchCode(rawInput) {
      const input = searchCodeInput.parse(rawInput);
      const { files } = await collectFiles(context.workspace, input.path, 12, 2_000);
      const matches: Array<{ path: string; line: number; text: string }> = [];
      for (const file of files) {
        if (matches.length >= input.maxResults) break;
        const absolute = await resolveInsideWorkspace(context.workspace, file);
        const info = await stat(absolute);
        if (info.size > 1024 * 1024) continue;
        const text = await readFile(absolute, "utf8").catch(() => null);
        if (text === null || text.includes("\0")) continue;
        for (const [index, line] of text.split(/\r?\n/).entries()) {
          if (line.toLocaleLowerCase().includes(input.query.toLocaleLowerCase())) {
            matches.push({ path: file, line: index + 1, text: line.slice(0, 500) });
            if (matches.length >= input.maxResults) break;
          }
        }
      }
      return { matches, truncated: matches.length >= input.maxResults };
    },

    async readFile(rawInput) {
      const input = readFileInput.parse(rawInput);
      const absolute = await resolveInsideWorkspace(context.workspace, input.path);
      const raw = await readFile(absolute);
      if (raw.includes(0)) throw new PolicyError("binary-file", "Binary files cannot be read");
      const allLines = raw.toString("utf8").split(/\r?\n/);
      const requestedEnd = input.endLine ?? input.startLine + MAX_READ_LINES - 1;
      if (requestedEnd < input.startLine) throw new PolicyError("line-range", "endLine must not be before startLine");
      const boundedEnd = Math.min(requestedEnd, input.startLine + MAX_READ_LINES - 1, allLines.length);
      const selected = allLines.slice(input.startLine - 1, boundedEnd).join("\n");
      const bytes = Buffer.from(selected, "utf8");
      const content = bytes.length > MAX_READ_BYTES ? new TextDecoder().decode(bytes.subarray(0, MAX_READ_BYTES)) : selected;
      return {
        path: portable(input.path),
        content,
        startLine: input.startLine,
        endLine: boundedEnd,
        truncated: requestedEnd > boundedEnd || bytes.length > MAX_READ_BYTES,
      };
    },

    async applyPatch(rawInput) {
      const input = applyPatchInput.parse(rawInput);
      const decision = inspectPatch(input.patch, context.manifest);
      if (!decision.allowed) throw new PolicyError("patch-blocked", decision.reasons.join("; "));
      const result = await runProcess("git", ["apply", "--whitespace=nowarn", "-"], {
        cwd: context.workspace,
        env: trustedEnvironment(context),
        timeoutMs: 10_000,
        input: input.patch,
      });
      if (result.exitCode !== 0) throw new PolicyError("patch-apply-failed", "Validated patch could not be applied");
      return { changedPaths: decision.changedPaths, addedLines: decision.addedLines, deletedLines: decision.deletedLines, hash: digest(input.patch) };
    },

    async getDiff(rawInput) {
      getDiffInput.parse(rawInput);
      const result = await runProcess("git", ["diff", "--no-ext-diff", "--unified=3", "--"], {
        cwd: context.workspace,
        env: trustedEnvironment(context),
        timeoutMs: 10_000,
      });
      if (result.exitCode !== 0) throw new PolicyError("diff-failed", "Repository diff could not be read");
      const bytes = Buffer.from(result.output, "utf8");
      const truncated = bytes.length > MAX_DIFF_BYTES;
      const diff = truncated ? `${new TextDecoder().decode(bytes.subarray(0, MAX_DIFF_BYTES))}\n...[truncated]` : result.output;
      return { diff, hash: digest(result.output), truncated };
    },

    async runCheck(rawInput) {
      const input = runCheckInput.parse(rawInput);
      const check = resolveTrustedCheck(input.checkId, context.manifest);
      const startedAt = performance.now();
      const result = await runProcess(check.executable, check.args, {
        cwd: context.workspace,
        env: trustedEnvironment(context),
        timeoutMs: check.timeoutMs,
      });
      const output = redactOutput(result.output, context.secrets, 64 * 1024);
      return {
        checkId: input.checkId,
        status: result.timedOut ? "timed_out" : result.exitCode === 0 ? "passed" : "failed",
        exitCode: result.exitCode,
        durationMs: Math.round(performance.now() - startedAt),
        output,
        outputHash: digest(output),
      };
    },
  };
}
