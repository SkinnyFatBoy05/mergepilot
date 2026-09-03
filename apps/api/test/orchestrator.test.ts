import { describe, expect, it } from "vitest";
import type { Actor } from "@mergepilot/contracts";
import { recordedSuccessfulRun } from "@mergepilot/test-fixtures";
import { MemoryRepository } from "../src/db/memory-repository.js";
import { sha256 } from "../src/domain/hash-chain.js";
import { MergePilotOrchestrator } from "../src/orchestration/orchestrator.js";
import { RecordedProvider } from "../src/providers/recorded-provider.js";

const human: Actor = { id: "reviewer", displayName: "Reviewer", type: "human" };

function createHarness() {
  const repository = new MemoryRepository();
  const session = {
    async call(name: string) {
      if (name === "read_file") return { path: "src/worker.ts", content: "send(item);", startLine: 1, endLine: 1, truncated: false };
      if (name === "apply_patch") return { changedPaths: ["src/worker.ts"], addedLines: 3, deletedLines: 1, hash: "1".repeat(64) };
      if (name === "run_check") return { checkId: "unit", status: "passed", exitCode: 0, durationMs: 4, output: "ok", outputHash: sha256("ok") };
      if (name === "get_diff") {
        const diff = "--- a/src/worker.ts\n+++ b/src/worker.ts\n@@ -1 +1 @@\n-send(item);\n+claimAndSend(item);\n";
        return { diff, hash: sha256(diff), truncated: false };
      }
      return {};
    },
    async close() {},
  };
  const orchestrator = new MergePilotOrchestrator({
    repository,
    providerFactory: () => new RecordedProvider(recordedSuccessfulRun),
    sessionFactory: async () => session,
  });
  async function createAndPlan() {
    const task = await orchestrator.createTask({
      issue: "Prevent duplicate webhook deliveries after a worker restart.",
      fixtureId: "webhook-worker",
      providerMode: "recorded",
    });
    return orchestrator.plan(task.id);
  }
  return { repository, orchestrator, createAndPlan };
}

describe("MergePilotOrchestrator", () => {
  it("cannot execute before plan approval", async () => {
    const harness = createHarness();
    const result = await harness.createAndPlan();
    await expect(harness.orchestrator.execute(result.task.id)).rejects.toThrow(/plan approval/i);
  });

  it("requires release approval for the exact evidence hash", async () => {
    const harness = createHarness();
    const planned = await harness.createAndPlan();
    await harness.orchestrator.decidePlan(planned.task.id, {
      decision: "approve",
      artifactHash: planned.plan.hash,
      reason: "The plan is appropriately bounded.",
      actor: human,
    });
    const reviewed = await harness.orchestrator.execute(planned.task.id);
    expect(reviewed.task.status).toBe("awaiting_release_approval");
    await expect(harness.orchestrator.decideRelease(planned.task.id, {
      decision: "approve",
      artifactHash: "0".repeat(64),
      reason: "Looks good.",
      actor: human,
    })).rejects.toThrow(/artifact hash/i);
  });

  it("completes only after both approvals", async () => {
    const harness = createHarness();
    const planned = await harness.createAndPlan();
    await harness.orchestrator.decidePlan(planned.task.id, { decision: "approve", artifactHash: planned.plan.hash, reason: "Plan approved.", actor: human });
    const reviewed = await harness.orchestrator.execute(planned.task.id);
    const completed = await harness.orchestrator.decideRelease(planned.task.id, { decision: "approve", artifactHash: reviewed.review.evidenceHash, reason: "Evidence approved.", actor: human });
    expect(completed.task.status).toBe("completed");
    expect(completed.bundle.bundleHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
