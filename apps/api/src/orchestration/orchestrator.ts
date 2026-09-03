import { randomUUID } from "node:crypto";
import {
  agentActionSchema,
  createTaskInputSchema,
  type Actor,
  type Approval,
  type CreateTaskInput,
  type Patch,
  type ReleaseBundle,
  type Review,
  type Task,
  type ToolName,
} from "@mergepilot/contracts";
import type { MergePilotRepository, StoredArtifact } from "../db/repository.js";
import { sha256 } from "../domain/hash-chain.js";
import type { AgentProvider } from "../providers/provider.js";

const systemActor: Actor = { id: "mergepilot", displayName: "MergePilot", type: "system" };
const providerActor: Actor = { id: "agent-provider", displayName: "Agent provider", type: "provider" };

export interface OrchestrationSession {
  call(name: string, arguments_: Record<string, unknown>): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}

export interface OrchestratorDependencies {
  readonly repository: MergePilotRepository;
  readonly providerFactory: (task: Task) => AgentProvider;
  readonly sessionFactory: (task: Task) => Promise<OrchestrationSession>;
  readonly maxToolCalls?: number;
  readonly deadlineMs?: number;
}

export interface DecisionInput {
  readonly decision: "approve" | "reject" | "revise";
  readonly artifactHash: string;
  readonly reason: string;
  readonly actor: Actor;
}

export class MergePilotOrchestrator {
  private readonly providers = new Map<string, AgentProvider>();
  private readonly maxToolCalls: number;
  private readonly deadlineMs: number;

  constructor(private readonly dependencies: OrchestratorDependencies) {
    this.maxToolCalls = dependencies.maxToolCalls ?? 24;
    this.deadlineMs = dependencies.deadlineMs ?? 15 * 60_000;
  }

  createTask(input: CreateTaskInput): Promise<Task> {
    return this.dependencies.repository.createTask(createTaskInputSchema.parse(input), systemActor);
  }

  async plan(taskId: string): Promise<{ task: Task; plan: StoredArtifact<import("@mergepilot/contracts").Plan> }> {
    let task = await this.requireTask(taskId);
    if (task.status !== "draft" && task.status !== "failed_recoverable") throw new Error("Task is not ready for planning");
    task = await this.dependencies.repository.transitionTask(task.id, task.version, "planning", systemActor);
    const provider = this.dependencies.providerFactory(task);
    this.providers.set(task.id, provider);
    const result = await provider.createPlan({ issue: task.issue, fixtureId: task.fixtureId, repositorySummary: `Visible fixture: ${task.fixtureId}` });
    const plan = await this.dependencies.repository.savePlan(task.id, task.version, result.value, providerActor);
    await this.dependencies.repository.appendEvent(task.id, task.version, "provider.used", providerActor, result.usage);
    task = await this.dependencies.repository.transitionTask(task.id, task.version, "awaiting_plan_approval", systemActor);
    return { task, plan };
  }

  async decidePlan(taskId: string, input: DecisionInput): Promise<{ task: Task; approval: Approval }> {
    const task = await this.requireTask(taskId);
    if (task.status !== "awaiting_plan_approval") throw new Error("Task is not awaiting plan approval");
    const approval = await this.dependencies.repository.recordApproval(this.makeApproval(task, "plan", input));
    const next = input.decision === "approve" ? "executing" : input.decision === "revise" ? "planning" : "cancelled";
    return { task: await this.dependencies.repository.transitionTask(task.id, task.version, next, input.actor), approval };
  }

  async execute(taskId: string): Promise<{ task: Task; review: Review }> {
    let task = await this.requireTask(taskId);
    if (task.status !== "executing") throw new Error("Plan approval is required before execution");
    const plan = await this.dependencies.repository.getPlan(taskId);
    if (!plan) throw new Error("Approved plan was not found");
    const approvals = await this.dependencies.repository.listApprovals(taskId);
    if (!approvals.some((approval) => approval.phase === "plan" && approval.decision === "approve" && approval.artifactHash === plan.hash)) {
      throw new Error("Exact plan approval is required before execution");
    }
    const provider = this.providers.get(taskId) ?? this.dependencies.providerFactory(task);
    if (!this.providers.has(taskId)) await provider.createPlan({ issue: task.issue, fixtureId: task.fixtureId, repositorySummary: `Visible fixture: ${task.fixtureId}` });
    const run = await this.dependencies.repository.createRun(task.id, task.version, `${task.id}:run:${task.version}`, systemActor);
    const session = await this.dependencies.sessionFactory(task);
    const observations: string[] = [];
    const requestedChecks = new Set(plan.value.requestedCheckIds);
    const completedChecks = new Set<string>();
    let patch: Patch | null = null;
    const startedAt = Date.now();
    try {
      for (let ordinal = 1; ordinal <= this.maxToolCalls; ordinal += 1) {
        if (Date.now() - startedAt > this.deadlineMs) throw new Error("Execution deadline exceeded");
        const providerResult = await provider.nextAction({ taskId, plan: plan.value, ordinal, observations: observations.slice(-8) });
        const action = agentActionSchema.parse(providerResult.value);
        await this.dependencies.repository.appendEvent(task.id, task.version, "provider.used", providerActor, providerResult.usage);
        if (action.type === "complete") {
          if (!patch) throw new Error("A get_diff observation is required before review");
          const missing = [...requestedChecks].filter((checkId) => !completedChecks.has(checkId));
          if (missing.length) throw new Error(`Required checks were not run: ${missing.join(", ")}`);
          break;
        }
        const before = performance.now();
        const result = await session.call(action.tool, action.arguments);
        await this.dependencies.repository.recordToolCall({
          schemaVersion: 1,
          id: randomUUID(),
          runId: run.id,
          ordinal,
          tool: action.tool,
          redactedArguments: action.arguments,
          policyDecision: "allowed",
          outputSummary: JSON.stringify(result).slice(0, 4_000),
          durationMs: Math.round(performance.now() - before),
          createdAt: new Date().toISOString(),
        });
        observations.push(JSON.stringify({ tool: action.tool, result }).slice(0, 4_000));
        if (action.tool === "run_check") {
          const checkId = String(result.checkId);
          completedChecks.add(checkId);
          await this.dependencies.repository.recordCheck({
            schemaVersion: 1,
            id: randomUUID(),
            runId: run.id,
            checkId,
            exitCode: Number(result.exitCode),
            status: result.status as "passed" | "failed" | "timed_out",
            durationMs: Number(result.durationMs),
            outputHash: String(result.outputHash),
            outputSummary: String(result.output ?? "").slice(0, 4_000),
          });
        }
        if (action.tool === "get_diff") {
          const diff = String(result.diff);
          patch = {
            schemaVersion: 1,
            unifiedDiff: diff.slice(0, 32_768),
            changedPaths: changedPaths(diff),
            addedLines: countLines(diff, "+"),
            deletedLines: countLines(diff, "-"),
            hash: String(result.hash),
          };
          await this.dependencies.repository.savePatch(run.id, patch, providerActor);
        }
      }
      if (!patch) throw new Error("Tool budget exhausted before a reviewable diff was produced");
      task = await this.dependencies.repository.transitionTask(task.id, task.version, "reviewing", systemActor);
      const checks = await this.dependencies.repository.listChecks(run.id);
      const critique = await provider.critique({ plan: plan.value, diff: patch.unifiedDiff, checks });
      const deterministicFindings = checks.filter((check) => check.status !== "passed").map((check) => `${check.checkId} ${check.status}`);
      const review: Review = {
        schemaVersion: 1,
        id: randomUUID(),
        runId: run.id,
        deterministicFindings,
        modelCritique: critique.value,
        recommendation: deterministicFindings.length ? "revise" : critique.value.recommendation,
        evidenceHash: sha256({ planHash: plan.hash, patchHash: patch.hash, checks, critique: critique.value }),
        createdAt: new Date().toISOString(),
      };
      await this.dependencies.repository.saveReview(review, systemActor);
      await this.dependencies.repository.updateRun({ ...run, status: "succeeded", outcome: "success", finishedAt: new Date().toISOString() }, systemActor);
      task = await this.dependencies.repository.transitionTask(task.id, task.version, "awaiting_release_approval", systemActor);
      return { task, review };
    } catch (error) {
      await this.dependencies.repository.updateRun({ ...run, status: "failed", outcome: "failed", finishedAt: new Date().toISOString() }, systemActor);
      const current = await this.requireTask(taskId);
      if (current.status === "executing" || current.status === "reviewing") {
        await this.dependencies.repository.transitionTask(current.id, current.version, "failed_recoverable", systemActor);
      }
      throw error;
    } finally {
      await session.close();
    }
  }

  async decideRelease(taskId: string, input: DecisionInput): Promise<{ task: Task; approval: Approval; bundle: ReleaseBundle }> {
    const task = await this.requireTask(taskId);
    if (task.status !== "awaiting_release_approval") throw new Error("Task is not awaiting release approval");
    const approval = await this.dependencies.repository.recordApproval(this.makeApproval(task, "release", input));
    if (input.decision !== "approve") {
      const next = input.decision === "revise" ? "executing" : "cancelled";
      const transitioned = await this.dependencies.repository.transitionTask(task.id, task.version, next, input.actor);
      throw new Error(`Release ${input.decision}; task moved to ${transitioned.status}`);
    }
    const plan = await this.dependencies.repository.getPlan(task.id);
    const planApproval = (await this.dependencies.repository.listApprovals(task.id)).find((entry) => entry.phase === "plan" && entry.decision === "approve");
    const reviewRun = await this.findReviewRun(task.id);
    if (!plan || !planApproval || !reviewRun) throw new Error("Release evidence is incomplete");
    const patch = await this.dependencies.repository.getPatch(reviewRun.run.id);
    const review = await this.dependencies.repository.getReview(reviewRun.run.id);
    if (!patch || !review) throw new Error("Release evidence is incomplete");
    const bundleBase = {
      schemaVersion: 1 as const,
      id: randomUUID(),
      taskId: task.id,
      runId: reviewRun.run.id,
      planHash: plan.hash,
      patchHash: patch.hash,
      reviewHash: review.evidenceHash,
      planApprovalId: planApproval.id,
      releaseApprovalId: approval.id,
      createdAt: new Date().toISOString(),
    };
    const bundle: ReleaseBundle = { ...bundleBase, bundleHash: sha256(bundleBase) };
    await this.dependencies.repository.createReleaseBundle(bundle, systemActor);
    return { task: await this.dependencies.repository.transitionTask(task.id, task.version, "completed", input.actor), approval, bundle };
  }

  private makeApproval(task: Task, phase: "plan" | "release", input: DecisionInput): Approval {
    return { schemaVersion: 1, id: randomUUID(), taskId: task.id, phase, decision: input.decision, reason: input.reason, actor: input.actor, taskVersion: task.version, artifactHash: input.artifactHash, createdAt: new Date().toISOString() };
  }

  private async requireTask(taskId: string): Promise<Task> {
    const task = await this.dependencies.repository.getTask(taskId);
    if (!task) throw new Error("Task not found");
    return task;
  }

  private async findReviewRun(taskId: string): Promise<{ run: import("@mergepilot/contracts").Run } | null> {
    const runs = (await this.dependencies.repository.listRuns(taskId)).reverse();
    for (const run of runs) {
      if (await this.dependencies.repository.getReview(run.id)) return { run };
    }
    return null;
  }
}

function changedPaths(diff: string): string[] {
  return [...diff.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((match) => match[1]!).slice(0, 12);
}

function countLines(diff: string, prefix: "+" | "-"): number {
  return diff.split(/\r?\n/).filter((line) => line.startsWith(prefix) && !line.startsWith(prefix.repeat(3))).length;
}
