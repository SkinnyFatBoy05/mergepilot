import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Actor, Approval, CreateTaskInput, Plan } from "@mergepilot/contracts";
import type { MergePilotRepository } from "../src/db/repository.js";
import { MemoryRepository } from "../src/db/memory-repository.js";

export const systemActor: Actor = {
  id: "mergepilot",
  displayName: "MergePilot",
  type: "system",
};

export const humanActor: Actor = {
  id: "reviewer",
  displayName: "Reviewer",
  type: "human",
};

export const validTaskInput = (): CreateTaskInput => ({
  issue: "Prevent duplicate webhook deliveries after a worker restart.",
  fixtureId: "webhook-worker",
  providerMode: "recorded",
});

export const validPlan = (): Plan => ({
  schemaVersion: 1,
  summary: "Persist delivery claims before dispatch and make retries idempotent.",
  assumptions: ["The fixture uses a single PostgreSQL database."],
  proposedFiles: ["src/worker.ts", "test/worker.test.ts"],
  steps: ["Add a durable delivery claim", "Prove retries do not deliver twice"],
  risks: ["A stale claim could delay a later retry."],
  requestedCheckIds: ["unit"],
});

export function repositoryContract(
  name: string,
  createRepository: () => Promise<MergePilotRepository>,
): void {
  describe(name, () => {
    it("rejects a stale task version", async () => {
      const repo = await createRepository();
      const task = await repo.createTask(validTaskInput(), systemActor);
      await repo.transitionTask(task.id, task.version, "planning", systemActor);

      await expect(
        repo.transitionTask(task.id, task.version, "cancelled", humanActor),
      ).rejects.toThrow(/stale/i);
    });

    it("binds approval to the exact artifact hash", async () => {
      const repo = await createRepository();
      let task = await repo.createTask(validTaskInput(), systemActor);
      task = await repo.transitionTask(task.id, task.version, "planning", systemActor);
      const stored = await repo.savePlan(task.id, task.version, validPlan(), systemActor);
      task = await repo.transitionTask(task.id, task.version, "awaiting_plan_approval", systemActor);
      const approval: Approval = {
        schemaVersion: 1,
        id: randomUUID(),
        taskId: task.id,
        phase: "plan",
        decision: "approve",
        reason: "The plan is scoped and the requested check is sufficient.",
        actor: humanActor,
        taskVersion: task.version,
        artifactHash: "0".repeat(64),
        createdAt: new Date().toISOString(),
      };

      await expect(repo.recordApproval(approval)).rejects.toThrow(/artifact hash/i);
      await expect(
        repo.recordApproval({ ...approval, id: randomUUID(), artifactHash: stored.hash }),
      ).resolves.toMatchObject({ artifactHash: stored.hash });
    });

    it("orders a tamper-evident event stream", async () => {
      const repo = await createRepository();
      const task = await repo.createTask(validTaskInput(), systemActor);
      await repo.transitionTask(task.id, task.version, "planning", systemActor);

      const events = await repo.listEventsAfter(task.id, 0);
      expect(events.map((event) => event.sequence)).toEqual([1, 2]);
      expect(events[1]?.previousHash).toBe(events[0]?.hash);
    });

    it("returns the existing run for an idempotency key", async () => {
      const repo = await createRepository();
      const task = await repo.createTask(validTaskInput(), systemActor);
      const first = await repo.createRun(task.id, task.version, "same-run", systemActor);
      const second = await repo.createRun(task.id, task.version, "same-run", systemActor);
      expect(second.id).toBe(first.id);
    });
  });
}

repositoryContract("MemoryRepository", async () => new MemoryRepository());
