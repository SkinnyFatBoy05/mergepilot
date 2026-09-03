import { z } from "zod";

export const schemaVersionSchema = z.literal(1);
export const uuidSchema = z.uuid();
export const timestampSchema = z.iso.datetime({ offset: true });
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const fixtureIdSchema = z.enum([
  "entitlement-service",
  "webhook-worker",
  "react-access-console",
]);
export type FixtureId = z.infer<typeof fixtureIdSchema>;

export const providerModeSchema = z.enum(["recorded", "openai"]);
export type ProviderMode = z.infer<typeof providerModeSchema>;

export const taskStatusSchema = z.enum([
  "draft",
  "planning",
  "awaiting_plan_approval",
  "executing",
  "reviewing",
  "awaiting_release_approval",
  "completed",
  "failed_recoverable",
  "failed_terminal",
  "cancelled",
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const createTaskInputSchema = z.object({
  issue: z.string().trim().min(10).max(4_000),
  fixtureId: fixtureIdSchema,
  providerMode: providerModeSchema,
});
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export const actorSchema = z.object({
  id: z.string().min(1).max(120),
  displayName: z.string().min(1).max(120),
  type: z.enum(["human", "system", "provider"]),
});
export type Actor = z.infer<typeof actorSchema>;

export const taskSchema = createTaskInputSchema.extend({
  schemaVersion: schemaVersionSchema,
  id: uuidSchema,
  status: taskStatusSchema,
  version: z.number().int().nonnegative(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Task = z.infer<typeof taskSchema>;

export const planSchema = z.object({
  schemaVersion: schemaVersionSchema,
  summary: z.string().min(10).max(1_000),
  assumptions: z.array(z.string().min(1).max(500)).max(12),
  proposedFiles: z.array(z.string().min(1).max(240)).max(20),
  steps: z.array(z.string().min(1).max(500)).min(1).max(20),
  risks: z.array(z.string().min(1).max(500)).max(12),
  requestedCheckIds: z
    .array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/))
    .min(1)
    .max(12),
});
export type Plan = z.infer<typeof planSchema>;

export const approvalSchema = z.object({
  schemaVersion: schemaVersionSchema,
  id: uuidSchema,
  taskId: uuidSchema,
  phase: z.enum(["plan", "release"]),
  decision: z.enum(["approve", "reject", "revise"]),
  reason: z.string().trim().min(3).max(1_000),
  actor: actorSchema,
  taskVersion: z.number().int().nonnegative(),
  artifactHash: sha256Schema,
  createdAt: timestampSchema,
});
export type Approval = z.infer<typeof approvalSchema>;

export const runSchema = z.object({
  schemaVersion: schemaVersionSchema,
  id: uuidSchema,
  taskId: uuidSchema,
  attempt: z.number().int().positive(),
  providerMode: providerModeSchema,
  status: z.enum(["active", "succeeded", "failed", "interrupted", "cancelled"]),
  idempotencyKey: z.string().min(1).max(240),
  startedAt: timestampSchema,
  finishedAt: timestampSchema.nullable(),
  outcome: z.enum(["success", "policy_blocked", "failed", "interrupted"]).nullable(),
});
export type Run = z.infer<typeof runSchema>;

export const toolNameSchema = z.enum([
  "inspect_tree",
  "search_code",
  "read_file",
  "apply_patch",
  "get_diff",
  "run_check",
]);
export type ToolName = z.infer<typeof toolNameSchema>;

export const toolCallSchema = z.object({
  schemaVersion: schemaVersionSchema,
  id: uuidSchema,
  runId: uuidSchema,
  ordinal: z.number().int().positive(),
  tool: toolNameSchema,
  redactedArguments: z.record(z.string(), z.unknown()),
  policyDecision: z.enum(["allowed", "blocked"]),
  outputSummary: z.string().max(4_000),
  durationMs: z.number().nonnegative(),
  createdAt: timestampSchema,
});
export type ToolCall = z.infer<typeof toolCallSchema>;

export const patchSchema = z.object({
  schemaVersion: schemaVersionSchema,
  unifiedDiff: z.string().min(1).max(32_768),
  changedPaths: z.array(z.string().min(1).max(240)).max(12),
  addedLines: z.number().int().nonnegative(),
  deletedLines: z.number().int().nonnegative(),
  hash: sha256Schema,
});
export type Patch = z.infer<typeof patchSchema>;

export const checkResultSchema = z.object({
  schemaVersion: schemaVersionSchema,
  id: uuidSchema,
  runId: uuidSchema,
  checkId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  exitCode: z.number().int(),
  status: z.enum(["passed", "failed", "timed_out"]),
  durationMs: z.number().nonnegative(),
  outputHash: sha256Schema,
  outputSummary: z.string().max(4_000),
});
export type CheckResult = z.infer<typeof checkResultSchema>;

export const modelCritiqueSchema = z.object({
  schemaVersion: schemaVersionSchema,
  findings: z.array(z.string().min(1).max(500)).max(20),
  recommendation: z.enum(["approve", "revise", "reject"]),
  limitations: z.array(z.string().min(1).max(500)).max(12),
});
export type ModelCritique = z.infer<typeof modelCritiqueSchema>;

export const reviewSchema = z.object({
  schemaVersion: schemaVersionSchema,
  id: uuidSchema,
  runId: uuidSchema,
  deterministicFindings: z.array(z.string().min(1).max(500)).max(30),
  modelCritique: modelCritiqueSchema.nullable(),
  recommendation: z.enum(["approve", "revise", "reject"]),
  evidenceHash: sha256Schema,
  createdAt: timestampSchema,
});
export type Review = z.infer<typeof reviewSchema>;

export const releaseBundleSchema = z.object({
  schemaVersion: schemaVersionSchema,
  id: uuidSchema,
  taskId: uuidSchema,
  runId: uuidSchema,
  planHash: sha256Schema,
  patchHash: sha256Schema,
  reviewHash: sha256Schema,
  planApprovalId: uuidSchema,
  releaseApprovalId: uuidSchema,
  bundleHash: sha256Schema,
  createdAt: timestampSchema,
});
export type ReleaseBundle = z.infer<typeof releaseBundleSchema>;
