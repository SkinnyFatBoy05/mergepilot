# Architecture

## Control plane

The Fastify API owns the explicit task state machine: `draft → planning → awaiting_plan_approval → executing → reviewing → awaiting_release_approval → completed`, with recoverable, terminal, cancelled, and revision paths. Every mutating repository call uses optimistic task versions. Plan and release decisions bind a reason and actor to a SHA-256 artifact identity.

PostgreSQL transactions persist tasks, plans, approvals, attempts, tool calls, patches, checks, reviews, release bundles, and hash-linked audit events. The memory repository implements the same contract for deterministic unit tests.

## Agent and tool boundary

Providers return schema-validated plans, actions, and critiques. Recorded mode replays checked-in transcripts; OpenAI mode uses structured outputs and records bounded usage metadata. Provider output never executes directly.

The repository MCP exposes exactly `inspect_tree`, `search_code`, `read_file`, `apply_patch`, `get_diff`, and `run_check`. A provider chooses typed arguments; the policy package independently validates path containment, writable/protected prefixes, patch size, changed lines, and trusted check IDs.

Runner containers use no network, a read-only root filesystem, UID/GID 10001, dropped Linux capabilities, no-new-privileges, bounded CPU/memory/PIDs, and a size-limited temporary workspace. The Docker socket is never mounted. Hidden evaluator inputs are absent from the runner image and root-readable only in the evaluator image.

## Read models

The React console consumes either `/api/v1` or the redacted public replay through one data-source contract. Audit history is rendered as a timeline rather than a chat transcript. SSE resumes from an event sequence. The Compose profile starts the API in replay-only mode and rejects all mutations.
