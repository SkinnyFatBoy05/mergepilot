import type { RecordedProviderSequence } from "@mergepilot/contracts";

export const recordedSuccessfulRun: RecordedProviderSequence = {
  schemaVersion: 1,
  recordingId: "webhook-idempotency-success",
  plan: {
    schemaVersion: 1,
    summary: "Persist an idempotency claim before dispatch and cover restart retries.",
    assumptions: ["Delivery identifiers are stable across retries."],
    proposedFiles: ["src/worker.ts", "test/worker.test.ts"],
    steps: ["Inspect the worker", "Apply the idempotency patch", "Run unit checks"],
    risks: ["Claims must not remain pending forever."],
    requestedCheckIds: ["unit"],
  },
  actions: [
    { type: "tool_call", tool: "read_file", arguments: { path: "src/worker.ts" } },
    { type: "tool_call", tool: "apply_patch", arguments: { patch: "recorded-fixture-patch" } },
    { type: "tool_call", tool: "run_check", arguments: { checkId: "unit" } },
    { type: "complete", summary: "The worker now claims delivery IDs before dispatch." },
  ],
  critique: {
    schemaVersion: 1,
    findings: [],
    recommendation: "approve",
    limitations: ["The recorded path does not call an external model."],
  },
};
