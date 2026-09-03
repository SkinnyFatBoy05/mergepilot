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
import { Pool, type PoolClient } from "pg";
import { appendAuditEvent, sha256 } from "../domain/hash-chain.js";
import { assertTransition } from "../domain/state-machine.js";
import type { MergePilotRepository, StoredArtifact } from "./repository.js";

type PayloadRow<T> = { payload: T };

export class PostgresRepository implements MergePilotRepository {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl, max: 8 });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async createTask(input: CreateTaskInput, actor: Actor): Promise<Task> {
    return this.transaction(async (client) => {
      const now = new Date().toISOString();
      const task: Task = { ...input, schemaVersion: 1, id: randomUUID(), status: "draft", version: 0, createdAt: now, updatedAt: now };
      await client.query(
        "insert into tasks(id, version, status, payload, created_at, updated_at) values($1,$2,$3,$4,$5,$6)",
        [task.id, task.version, task.status, task, task.createdAt, task.updatedAt],
      );
      await this.appendWithClient(client, task.id, task.version, "task.created", actor, input);
      return task;
    });
  }

  async getTask(taskId: string): Promise<Task | null> {
    const result = await this.pool.query<PayloadRow<Task>>("select payload from tasks where id=$1", [taskId]);
    return result.rows[0]?.payload ?? null;
  }

  async listTasks(): Promise<Task[]> {
    const result = await this.pool.query<PayloadRow<Task>>("select payload from tasks order by created_at desc");
    return result.rows.map((row) => row.payload);
  }

  async transitionTask(taskId: string, expectedVersion: number, status: TaskStatus, actor: Actor): Promise<Task> {
    return this.transaction(async (client) => {
      const current = await this.lockTask(client, taskId);
      if (current.version !== expectedVersion) throw new Error("Stale task version");
      assertTransition(current.status, status);
      const updated: Task = { ...current, status, version: current.version + 1, updatedAt: new Date().toISOString() };
      const result = await client.query(
        "update tasks set version=$3,status=$4,payload=$5,updated_at=$6 where id=$1 and version=$2",
        [taskId, expectedVersion, updated.version, status, updated, updated.updatedAt],
      );
      if (result.rowCount !== 1) throw new Error("Stale task version");
      await this.appendWithClient(client, taskId, updated.version, "task.transitioned", actor, { from: current.status, to: status });
      return updated;
    });
  }

  async savePlan(taskId: string, expectedVersion: number, plan: Plan, actor: Actor): Promise<StoredArtifact<Plan>> {
    return this.transaction(async (client) => {
      const task = await this.lockTask(client, taskId);
      if (task.version !== expectedVersion) throw new Error("Stale task version");
      if (task.status !== "planning") throw new Error("Plan can only be saved while planning");
      const stored = { value: plan, hash: sha256(plan) };
      await client.query(
        "insert into plans(task_id,artifact_hash,payload) values($1,$2,$3) on conflict(task_id) do update set artifact_hash=excluded.artifact_hash,payload=excluded.payload",
        [taskId, stored.hash, plan],
      );
      await this.appendWithClient(client, taskId, task.version, "plan.saved", actor, { hash: stored.hash });
      return stored;
    });
  }

  async getPlan(taskId: string): Promise<StoredArtifact<Plan> | null> {
    const result = await this.pool.query<{ payload: Plan; artifact_hash: string }>("select payload,artifact_hash from plans where task_id=$1", [taskId]);
    const row = result.rows[0];
    return row ? { value: row.payload, hash: row.artifact_hash.trim() } : null;
  }

  async recordApproval(approval: Approval): Promise<Approval> {
    return this.transaction(async (client) => {
      const duplicate = await client.query<PayloadRow<Approval>>("select payload from approvals where id=$1", [approval.id]);
      if (duplicate.rows[0]) return duplicate.rows[0].payload;
      const task = await this.lockTask(client, approval.taskId);
      if (task.version !== approval.taskVersion) throw new Error("Stale task version");
      const expectedStatus = approval.phase === "plan" ? "awaiting_plan_approval" : "awaiting_release_approval";
      if (task.status !== expectedStatus) throw new Error(`Task is not ${expectedStatus}`);
      const artifact = approval.phase === "plan"
        ? await client.query<{ hash: string }>("select artifact_hash as hash from plans where task_id=$1", [task.id])
        : await client.query<{ hash: string }>("select r.evidence_hash as hash from reviews r join runs x on x.id=r.run_id where x.task_id=$1 order by (x.payload->>'attempt')::int desc limit 1", [task.id]);
      if (artifact.rows[0]?.hash.trim() !== approval.artifactHash) throw new Error("Approval artifact hash mismatch");
      await client.query("insert into approvals(id,task_id,phase,artifact_hash,payload) values($1,$2,$3,$4,$5)", [approval.id, task.id, approval.phase, approval.artifactHash, approval]);
      await this.appendWithClient(client, task.id, task.version, "approval.recorded", approval.actor, { phase: approval.phase, decision: approval.decision, artifactHash: approval.artifactHash });
      return approval;
    });
  }

  async listApprovals(taskId: string): Promise<Approval[]> {
    const result = await this.pool.query<PayloadRow<Approval>>("select payload from approvals where task_id=$1 order by (payload->>'createdAt')", [taskId]);
    return result.rows.map((row) => row.payload);
  }

  async createRun(taskId: string, expectedVersion: number, idempotencyKey: string, actor: Actor): Promise<Run> {
    return this.transaction(async (client) => {
      const duplicate = await client.query<PayloadRow<Run>>("select payload from runs where idempotency_key=$1", [idempotencyKey]);
      if (duplicate.rows[0]) return duplicate.rows[0].payload;
      const task = await this.lockTask(client, taskId);
      if (task.version !== expectedVersion) throw new Error("Stale task version");
      const attempts = await client.query<{ count: string }>("select count(*) from runs where task_id=$1", [taskId]);
      const run: Run = {
        schemaVersion: 1,
        id: randomUUID(),
        taskId,
        attempt: Number(attempts.rows[0]?.count ?? 0) + 1,
        providerMode: task.providerMode,
        status: "active",
        idempotencyKey,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        outcome: null,
      };
      await client.query("insert into runs(id,task_id,idempotency_key,payload) values($1,$2,$3,$4)", [run.id, taskId, idempotencyKey, run]);
      await this.appendWithClient(client, taskId, task.version, "run.created", actor, { runId: run.id, idempotencyKey });
      return run;
    });
  }

  async updateRun(run: Run, actor: Actor): Promise<Run> {
    return this.transaction(async (client) => {
      const result = await client.query("update runs set payload=$2 where id=$1", [run.id, run]);
      if (result.rowCount !== 1) throw new Error("Run not found");
      const task = await this.lockTask(client, run.taskId);
      await this.appendWithClient(client, task.id, task.version, "run.updated", actor, { runId: run.id, status: run.status });
      return run;
    });
  }

  async getRun(runId: string): Promise<Run | null> {
    const result = await this.pool.query<PayloadRow<Run>>("select payload from runs where id=$1", [runId]);
    return result.rows[0]?.payload ?? null;
  }

  async listRuns(taskId: string): Promise<Run[]> {
    const result = await this.pool.query<PayloadRow<Run>>("select payload from runs where task_id=$1 order by (payload->>'attempt')::int", [taskId]);
    return result.rows.map((row) => row.payload);
  }

  async recordToolCall(call: ToolCall): Promise<ToolCall> {
    await this.pool.query("insert into tool_calls(id,run_id,ordinal,payload) values($1,$2,$3,$4) on conflict(id) do nothing", [call.id, call.runId, call.ordinal, call]);
    return call;
  }

  async savePatch(runId: string, patch: Patch, actor: Actor): Promise<StoredArtifact<Patch>> {
    return this.transaction(async (client) => {
      const task = await this.taskForRun(client, runId);
      await client.query("insert into patches(run_id,artifact_hash,payload) values($1,$2,$3) on conflict(run_id) do update set artifact_hash=excluded.artifact_hash,payload=excluded.payload", [runId, patch.hash, patch]);
      await this.appendWithClient(client, task.id, task.version, "patch.saved", actor, { runId, hash: patch.hash });
      return { value: patch, hash: patch.hash };
    });
  }

  async getPatch(runId: string): Promise<StoredArtifact<Patch> | null> {
    const result = await this.pool.query<{ payload: Patch; artifact_hash: string }>("select payload,artifact_hash from patches where run_id=$1", [runId]);
    const row = result.rows[0];
    return row ? { value: row.payload, hash: row.artifact_hash.trim() } : null;
  }

  async recordCheck(result: CheckResult): Promise<CheckResult> {
    await this.pool.query("insert into check_results(id,run_id,check_id,payload) values($1,$2,$3,$4) on conflict(run_id,check_id) do update set payload=excluded.payload", [result.id, result.runId, result.checkId, result]);
    return result;
  }

  async listChecks(runId: string): Promise<CheckResult[]> {
    const result = await this.pool.query<PayloadRow<CheckResult>>("select payload from check_results where run_id=$1 order by check_id", [runId]);
    return result.rows.map((row) => row.payload);
  }

  async saveReview(review: Review, actor: Actor): Promise<Review> {
    return this.transaction(async (client) => {
      const task = await this.taskForRun(client, review.runId);
      await client.query("insert into reviews(id,run_id,evidence_hash,payload) values($1,$2,$3,$4) on conflict(run_id) do update set evidence_hash=excluded.evidence_hash,payload=excluded.payload", [review.id, review.runId, review.evidenceHash, review]);
      await this.appendWithClient(client, task.id, task.version, "review.saved", actor, { reviewId: review.id, evidenceHash: review.evidenceHash });
      return review;
    });
  }

  async getReview(runId: string): Promise<Review | null> {
    const result = await this.pool.query<PayloadRow<Review>>("select payload from reviews where run_id=$1", [runId]);
    return result.rows[0]?.payload ?? null;
  }

  async createReleaseBundle(bundle: ReleaseBundle, actor: Actor): Promise<ReleaseBundle> {
    return this.transaction(async (client) => {
      const task = await this.lockTask(client, bundle.taskId);
      await client.query("insert into release_bundles(id,task_id,run_id,plan_approval_id,release_approval_id,payload) values($1,$2,$3,$4,$5,$6)", [bundle.id, bundle.taskId, bundle.runId, bundle.planApprovalId, bundle.releaseApprovalId, bundle]);
      await this.appendWithClient(client, task.id, task.version, "release.created", actor, { bundleHash: bundle.bundleHash });
      return bundle;
    });
  }

  async appendEvent(taskId: string, taskVersion: number, type: string, actor: Actor, payload: unknown): Promise<AuditEvent> {
    return this.transaction(async (client) => {
      await this.lockTask(client, taskId);
      return this.appendWithClient(client, taskId, taskVersion, type, actor, payload);
    });
  }

  async listEventsAfter(taskId: string, sequence: number): Promise<AuditEvent[]> {
    const result = await this.pool.query<PayloadRow<AuditEvent>>("select payload from audit_events where task_id=$1 and sequence>$2 order by sequence", [taskId, sequence]);
    return result.rows.map((row) => row.payload);
  }

  private async lockTask(client: PoolClient, taskId: string): Promise<Task> {
    const result = await client.query<PayloadRow<Task>>("select payload from tasks where id=$1 for update", [taskId]);
    const task = result.rows[0]?.payload;
    if (!task) throw new Error("Task not found");
    return task;
  }

  private async taskForRun(client: PoolClient, runId: string): Promise<Task> {
    const result = await client.query<PayloadRow<Task>>("select t.payload from tasks t join runs r on r.task_id=t.id where r.id=$1 for update of t", [runId]);
    const task = result.rows[0]?.payload;
    if (!task) throw new Error("Run not found");
    return task;
  }

  private async appendWithClient(client: PoolClient, taskId: string, taskVersion: number, type: string, actor: Actor, payload: unknown): Promise<AuditEvent> {
    const previous = await client.query<{ sequence: number; hash: string }>("select sequence,hash from audit_events where task_id=$1 order by sequence desc limit 1", [taskId]);
    const prior = previous.rows[0];
    const event = appendAuditEvent(prior?.hash.trim() ?? null, {
      schemaVersion: 1,
      id: randomUUID(),
      taskId,
      sequence: (prior?.sequence ?? 0) + 1,
      taskVersion,
      type,
      actor,
      payloadHash: sha256(payload),
      createdAt: new Date().toISOString(),
    });
    await client.query("insert into audit_events(id,task_id,sequence,previous_hash,payload_hash,hash,payload) values($1,$2,$3,$4,$5,$6,$7)", [event.id, taskId, event.sequence, event.previousHash, event.payloadHash, event.hash, event]);
    return event;
  }

  private async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const result = await operation(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
}
