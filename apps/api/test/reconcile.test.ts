import { describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/db/memory-repository.js";
import { reconcileInterruptedRuns } from "../src/orchestration/reconcile.js";

describe("restart reconciliation", () => {
  it("marks an active attempt interrupted and never replays its patch", async () => {
    const repository = new MemoryRepository();
    const actor = { id: "test", displayName: "Test", type: "system" as const };
    let task = await repository.createTask({ issue: "Fix a reproducible delivery failure", fixtureId: "entitlement-service", providerMode: "recorded" }, actor);
    task = await repository.transitionTask(task.id, task.version, "planning", actor);
    const plan = await repository.savePlan(task.id, task.version, { schemaVersion: 1, summary: "A complete bounded plan", assumptions: [], proposedFiles: ["src/x.ts"], steps: ["Patch safely"], risks: [], requestedCheckIds: ["unit"] }, actor);
    task = await repository.transitionTask(task.id, task.version, "awaiting_plan_approval", actor);
    await repository.recordApproval({ schemaVersion: 1, id: crypto.randomUUID(), taskId: task.id, phase: "plan", decision: "approve", reason: "Bounded plan", actor, taskVersion: task.version, artifactHash: plan.hash, createdAt: new Date().toISOString() });
    task = await repository.transitionTask(task.id, task.version, "executing", actor);
    const run = await repository.createRun(task.id, task.version, "attempt-1", actor);
    expect(await reconcileInterruptedRuns(repository, new Date("2026-09-03T00:00:00Z"))).toBe(1);
    expect((await repository.getRun(run.id))?.outcome).toBe("interrupted");
    expect((await repository.getTask(task.id))?.status).toBe("failed_recoverable");
  });
});
