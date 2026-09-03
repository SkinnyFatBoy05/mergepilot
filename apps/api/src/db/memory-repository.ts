import { randomUUID } from "node:crypto";
import type {
  Actor,
  Approval,
  AuditEvent,
  CheckResult,
  CreateTaskInput,
  Patch,
  Plan,
  ReleaseBundle,
  Review,
  Run,
  Task,
  TaskStatus,
  ToolCall,
} from "@mergepilot/contracts";
import { appendAuditEvent, sha256 } from "../domain/hash-chain.js";
import { assertTransition } from "../domain/state-machine.js";
import type { MergePilotRepository, StoredArtifact } from "./repository.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryRepository implements MergePilotRepository {
  private readonly tasks = new Map<string, Task>();
  private readonly plans = new Map<string, StoredArtifact<Plan>>();
  private readonly approvals = new Map<string, Approval>();
  private readonly runs = new Map<string, Run>();
  private readonly runKeys = new Map<string, string>();
  private readonly toolCalls = new Map<string, ToolCall>();
  private readonly patches = new Map<string, StoredArtifact<Patch>>();
  private readonly checks = new Map<string, CheckResult>();
  private readonly reviews = new Map<string, Review>();
  private readonly bundles = new Map<string, ReleaseBundle>();
  private readonly events = new Map<string, AuditEvent[]>();

  async createTask(input: CreateTaskInput, actor: Actor): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      ...input,
      schemaVersion: 1,
      id: randomUUID(),
      status: "draft",
      version: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.id, task);
    await this.appendEvent(task.id, task.version, "task.created", actor, input);
    return clone(task);
  }

  async getTask(taskId: string): Promise<Task | null> {
    const task = this.tasks.get(taskId);
    return task ? clone(task) : null;
  }

  async listTasks(): Promise<Task[]> {
    return [...this.tasks.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(clone);
  }

  async transitionTask(taskId: string, expectedVersion: number, status: TaskStatus, actor: Actor): Promise<Task> {
    const current = this.requireTask(taskId);
    if (current.version !== expectedVersion) throw new Error("Stale task version");
    assertTransition(current.status, status);
    const updated: Task = {
      ...current,
      status,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(taskId, updated);
    await this.appendEvent(taskId, updated.version, "task.transitioned", actor, {
      from: current.status,
      to: status,
    });
    return clone(updated);
  }

  async savePlan(taskId: string, expectedVersion: number, plan: Plan, actor: Actor): Promise<StoredArtifact<Plan>> {
    const task = this.requireTask(taskId);
    if (task.version !== expectedVersion) throw new Error("Stale task version");
    if (task.status !== "planning") throw new Error("Plan can only be saved while planning");
    const stored = { value: clone(plan), hash: sha256(plan) };
    this.plans.set(taskId, stored);
    await this.appendEvent(taskId, task.version, "plan.saved", actor, { hash: stored.hash });
    return clone(stored);
  }

  async getPlan(taskId: string): Promise<StoredArtifact<Plan> | null> {
    const plan = this.plans.get(taskId);
    return plan ? clone(plan) : null;
  }

  async recordApproval(approval: Approval): Promise<Approval> {
    const existing = this.approvals.get(approval.id);
    if (existing) return clone(existing);
    const task = this.requireTask(approval.taskId);
    if (task.version !== approval.taskVersion) throw new Error("Stale task version");
    const expectedStatus = approval.phase === "plan" ? "awaiting_plan_approval" : "awaiting_release_approval";
    if (task.status !== expectedStatus) throw new Error(`Task is not ${expectedStatus}`);
    const expectedHash = approval.phase === "plan"
      ? this.plans.get(task.id)?.hash
      : [...this.reviews.values()].find((review) => this.runs.get(review.runId)?.taskId === task.id)?.evidenceHash;
    if (!expectedHash || expectedHash !== approval.artifactHash) throw new Error("Approval artifact hash mismatch");
    this.approvals.set(approval.id, clone(approval));
    await this.appendEvent(task.id, task.version, "approval.recorded", approval.actor, {
      phase: approval.phase,
      decision: approval.decision,
      artifactHash: approval.artifactHash,
    });
    return clone(approval);
  }

  async listApprovals(taskId: string): Promise<Approval[]> {
    return [...this.approvals.values()].filter((approval) => approval.taskId === taskId).map(clone);
  }

  async createRun(taskId: string, expectedVersion: number, idempotencyKey: string, actor: Actor): Promise<Run> {
    const previousId = this.runKeys.get(idempotencyKey);
    if (previousId) return clone(this.runs.get(previousId)!);
    const task = this.requireTask(taskId);
    if (task.version !== expectedVersion) throw new Error("Stale task version");
    const run: Run = {
      schemaVersion: 1,
      id: randomUUID(),
      taskId,
      attempt: [...this.runs.values()].filter((entry) => entry.taskId === taskId).length + 1,
      providerMode: task.providerMode,
      status: "active",
      idempotencyKey,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      outcome: null,
    };
    this.runs.set(run.id, run);
    this.runKeys.set(idempotencyKey, run.id);
    await this.appendEvent(taskId, task.version, "run.created", actor, { runId: run.id, idempotencyKey });
    return clone(run);
  }

  async updateRun(run: Run, actor: Actor): Promise<Run> {
    if (!this.runs.has(run.id)) throw new Error("Run not found");
    this.runs.set(run.id, clone(run));
    const task = this.requireTask(run.taskId);
    await this.appendEvent(task.id, task.version, "run.updated", actor, { runId: run.id, status: run.status });
    return clone(run);
  }

  async getRun(runId: string): Promise<Run | null> {
    const run = this.runs.get(runId);
    return run ? clone(run) : null;
  }

  async recordToolCall(call: ToolCall): Promise<ToolCall> {
    this.toolCalls.set(call.id, clone(call));
    const run = this.requireRun(call.runId);
    const task = this.requireTask(run.taskId);
    await this.appendEvent(task.id, task.version, "tool.called", { id: "repository", displayName: "Repository tools", type: "system" }, {
      callId: call.id,
      tool: call.tool,
      policyDecision: call.policyDecision,
    });
    return clone(call);
  }

  async savePatch(runId: string, patch: Patch, actor: Actor): Promise<StoredArtifact<Patch>> {
    const run = this.requireRun(runId);
    const stored = { value: clone(patch), hash: patch.hash };
    this.patches.set(runId, stored);
    const task = this.requireTask(run.taskId);
    await this.appendEvent(task.id, task.version, "patch.saved", actor, { runId, hash: patch.hash });
    return clone(stored);
  }

  async getPatch(runId: string): Promise<StoredArtifact<Patch> | null> {
    const patch = this.patches.get(runId);
    return patch ? clone(patch) : null;
  }

  async recordCheck(result: CheckResult): Promise<CheckResult> {
    this.checks.set(result.id, clone(result));
    return clone(result);
  }

  async listChecks(runId: string): Promise<CheckResult[]> {
    return [...this.checks.values()].filter((entry) => entry.runId === runId).map(clone);
  }

  async saveReview(review: Review, actor: Actor): Promise<Review> {
    const run = this.requireRun(review.runId);
    this.reviews.set(review.runId, clone(review));
    const task = this.requireTask(run.taskId);
    await this.appendEvent(task.id, task.version, "review.saved", actor, { reviewId: review.id, evidenceHash: review.evidenceHash });
    return clone(review);
  }

  async getReview(runId: string): Promise<Review | null> {
    const review = this.reviews.get(runId);
    return review ? clone(review) : null;
  }

  async createReleaseBundle(bundle: ReleaseBundle, actor: Actor): Promise<ReleaseBundle> {
    const task = this.requireTask(bundle.taskId);
    const approvals = await this.listApprovals(task.id);
    if (!approvals.some((entry) => entry.id === bundle.planApprovalId && entry.decision === "approve")) {
      throw new Error("Approved plan evidence is required");
    }
    if (!approvals.some((entry) => entry.id === bundle.releaseApprovalId && entry.decision === "approve")) {
      throw new Error("Approved release evidence is required");
    }
    this.bundles.set(bundle.id, clone(bundle));
    await this.appendEvent(task.id, task.version, "release.created", actor, { bundleHash: bundle.bundleHash });
    return clone(bundle);
  }

  async appendEvent(taskId: string, taskVersion: number, type: string, actor: Actor, payload: unknown): Promise<AuditEvent> {
    const events = this.events.get(taskId) ?? [];
    const event = appendAuditEvent(events.at(-1)?.hash ?? null, {
      schemaVersion: 1,
      id: randomUUID(),
      taskId,
      sequence: events.length + 1,
      taskVersion,
      type,
      actor,
      payloadHash: sha256(payload),
      createdAt: new Date().toISOString(),
    });
    events.push(event);
    this.events.set(taskId, events);
    return clone(event);
  }

  async listEventsAfter(taskId: string, sequence: number): Promise<AuditEvent[]> {
    return (this.events.get(taskId) ?? []).filter((event) => event.sequence > sequence).map(clone);
  }

  private requireTask(taskId: string): Task {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error("Task not found");
    return task;
  }

  private requireRun(runId: string): Run {
    const run = this.runs.get(runId);
    if (!run) throw new Error("Run not found");
    return run;
  }
}
