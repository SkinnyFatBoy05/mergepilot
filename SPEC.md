# MergePilot MCP Boundary

## Value Proposition

MergePilot lets a software engineer delegate a bounded change to an agent while retaining control over the plan and release. Its repository MCP server gives the orchestrating model the minimum capabilities required to inspect, edit, and verify one isolated fixture workspace.

**Core actions**: inspect repository context, apply a policy-checked patch, and run a named trusted check.

## Why an LLM?

**Conversational win**: an engineer can describe an issue in natural language instead of manually locating every affected file and drafting each edit.

**LLM adds**: issue decomposition, code-context selection, patch generation, and evidence synthesis.

**What the LLM lacks**: filesystem access, permission to mutate code, trusted command definitions, and authority to approve either the plan or release. MCP supplies only those bounded capabilities; humans retain both approvals.

## UI Overview

The MCP server has no embedded view. MergePilot's standalone React console is the shared human/agent surface: it begins with a task brief, pauses on a hash-bound plan approval, streams tool and policy evidence, pauses on a hash-bound release approval, and ends with an auditable release bundle.

## Product Context

- **Existing product**: greenfield portfolio project with an approved architecture and implementation plan.
- **Protocol**: Model Context Protocol over stdio, using `@modelcontextprotocol/sdk`.
- **Tools**: exactly `inspect_tree`, `search_code`, `read_file`, `apply_patch`, `get_diff`, and `run_check`.
- **Authentication**: none; the server is launched locally for one isolated task workspace.
- **Filesystem constraints**: all paths must resolve inside the workspace; protected prefixes include the capability manifest, evaluation oracle, policy package, and container runner.
- **Output constraints**: tree 500 paths, search 100 matches, reads 400 lines/64 KiB, and diffs 128 KiB.
- **Execution constraints**: `run_check` accepts only a manifest check ID and spawns its predeclared executable/arguments with `shell: false`, a trusted environment, redaction, output bounds, and a timeout.
- **Mutation constraints**: `apply_patch` is inspected against byte, file, line, and path budgets before application and returns changed paths, line counts, and a SHA-256 digest.
- **Errors**: policy failures become concise tool errors without absolute paths or secrets.

## UX Flows

Inspect context:
1. List a bounded repository tree or search bounded code matches.
2. Read a bounded text range from an identified file.

Change code:
1. Submit a unified diff.
2. Validate the diff against the task capability manifest.
3. Apply an allowed patch and return its evidence digest.

Verify a change:
1. Read the current diff.
2. Invoke one trusted check by identifier.
3. Return redacted, bounded output and the exit status.

These are tool-only flows. The MCP client is the orchestrator; the standalone console owns the visual task and approval experience.

## Tools

- **`inspect_tree`** — input `{ path?, depth? }`; output `{ paths[], truncated }`; read-only.
- **`search_code`** — input `{ query, path?, maxResults? }`; output `{ matches[], truncated }`; read-only.
- **`read_file`** — input `{ path, startLine?, endLine? }`; output `{ path, content, startLine, endLine, truncated }`; read-only.
- **`apply_patch`** — input `{ patch }`; output `{ changedPaths, addedLines, deletedLines, hash }`; bounded workspace mutation.
- **`get_diff`** — input `{}`; output `{ diff, hash, truncated }`; read-only.
- **`run_check`** — input `{ checkId }`; output `{ checkId, status, exitCode, durationMs, output, outputHash }`; executes only a manifest-defined check.
