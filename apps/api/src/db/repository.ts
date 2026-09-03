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

export interface StoredArtifact<T> {
  value: T;
  hash: string;
}

export interface MergePilotRepository {
  createTask(input: CreateTaskInput, actor: Actor): Promise<Task>;
  getTask(taskId: string): Promise<Task | null>;
  listTasks(): Promise<Task[]>;
  transitionTask(taskId: string, expectedVersion: number, status: TaskStatus, actor: Actor): Promise<Task>;
  savePlan(taskId: string, expectedVersion: number, plan: Plan, actor: Actor): Promise<StoredArtifact<Plan>>;
  getPlan(taskId: string): Promise<StoredArtifact<Plan> | null>;
  recordApproval(approval: Approval): Promise<Approval>;
  listApprovals(taskId: string): Promise<Approval[]>;
  createRun(taskId: string, expectedVersion: number, idempotencyKey: string, actor: Actor): Promise<Run>;
  updateRun(run: Run, actor: Actor): Promise<Run>;
  getRun(runId: string): Promise<Run | null>;
  listRuns(taskId: string): Promise<Run[]>;
  recordToolCall(call: ToolCall): Promise<ToolCall>;
  savePatch(runId: string, patch: Patch, actor: Actor): Promise<StoredArtifact<Patch>>;
  getPatch(runId: string): Promise<StoredArtifact<Patch> | null>;
  recordCheck(result: CheckResult): Promise<CheckResult>;
  listChecks(runId: string): Promise<CheckResult[]>;
  saveReview(review: Review, actor: Actor): Promise<Review>;
  getReview(runId: string): Promise<Review | null>;
  createReleaseBundle(bundle: ReleaseBundle, actor: Actor): Promise<ReleaseBundle>;
  appendEvent(taskId: string, taskVersion: number, type: string, actor: Actor, payload: unknown): Promise<AuditEvent>;
  listEventsAfter(taskId: string, sequence: number): Promise<AuditEvent[]>;
}
