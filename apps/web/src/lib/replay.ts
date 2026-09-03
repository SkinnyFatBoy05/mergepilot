import type { EvaluationEvidence, MergePilotDataSource, RunEvidence } from "./api.js";

export class ReadOnlyReplayError extends Error {
  constructor() { super("Recorded demo is read-only"); this.name = "ReadOnlyReplayError"; }
}

const checks = [
  "Unit tests", "Integration tests", "TypeScript", "Lint", "Path containment", "Patch budget",
  "Secret scan", "Audit chain", "Approval binding", "Idempotency", "Accessibility", "Production build",
].map((label, index) => ({ id: `check-${index + 1}`, label, duration: `${(0.4 + index * 0.07).toFixed(1)}s`, status: "passed" as const }));

export const demoRun: RunEvidence = {
  id: "demo-run",
  issue: "Fix duplicate entitlement grants",
  mode: "recorded",
  status: "Completed",
  createdAt: "12 May 2026 · 10:42 UTC",
  branch: "fixture/entitlement-service",
  commit: "a1b2c3d",
  duration: "14m 36s",
  phases: ["Intake", "Plan", "Code", "Test", "Verify", "Package", "Release"],
  events: [
    { id: "e1", time: "10:42:21", tool: "planner.generate", summary: "Generated execution plan", status: "success" },
    { id: "e2", time: "10:42:37", tool: "inspect_tree", summary: "Inspected the bounded fixture workspace", status: "success" },
    { id: "e3", time: "10:43:05", tool: "apply_patch", summary: "Blocked: protected path", status: "blocked", detail: "The first proposal attempted to change evaluation/oracle.ts. Repository policy rejected it before mutation. The agent replanned against src/entitlements/service.ts." },
    { id: "e4", time: "10:43:42", tool: "apply_patch", summary: "Corrected entitlement grant idempotency", status: "success" },
    { id: "e5", time: "10:45:11", tool: "run_check", summary: "Ran trusted unit and integration checks", status: "success" },
    { id: "e6", time: "10:46:02", tool: "get_diff", summary: "Captured reviewable patch evidence", status: "success" },
  ],
  diff: "--- a/src/entitlements/service.ts\n+++ b/src/entitlements/service.ts\n@@ -41,5 +41,8 @@\n- await grants.insert({ userId, entitlementId });\n+ const claim = await grants.claim({ userId, entitlementId });\n+ if (!claim.created) return claim.grant;\n+ await grants.activate(claim.grant.id);\n+ return claim.grant;",
  checks,
  approvals: [
    { phase: "Plan", label: "Plan approved", reviewer: "Jane Smith", time: "12 May 2026 · 10:42:55 UTC", artifactHash: "8f3c1a7e9b2d4a10", reason: "Plan is bounded, testable, and covers duplicate delivery." },
    { phase: "Release", label: "Release approved by human", reviewer: "Michael Rivera", time: "12 May 2026 · 10:47:22 UTC", artifactHash: "3d9e7b2c4a1f805c", reason: "All deterministic checks passed; policy history is clean." },
  ],
  plan: {
    summary: "Claim each grant by its stable request key before activation, then prove duplicate delivery returns the original grant.",
    steps: ["Inspect grant persistence", "Add an atomic idempotency claim", "Cover concurrent duplicate requests", "Run trusted unit and integration checks"],
    risks: ["Existing rows without request keys require the unchanged fallback path."],
    hash: "8f3c1a7e9b2d4a10f493260c7a851f879bded2c417fcb0423853fc192bbf4ca1",
  },
};

const evaluation: EvaluationEvidence = { passRate: 1, passed: 12, total: 12, policyBlocks: 3, medianDurationSeconds: 38 };

export function recordedDataSource(): MergePilotDataSource {
  return {
    mode: "recorded",
    async listRuns() { return [demoRun]; },
    async getRun(id) { if (id !== demoRun.id) throw new Error("Replay run not found"); return demoRun; },
    async getEvaluation() { return evaluation; },
    async createTask() { throw new ReadOnlyReplayError(); },
    async decidePlan() { throw new ReadOnlyReplayError(); },
  };
}
