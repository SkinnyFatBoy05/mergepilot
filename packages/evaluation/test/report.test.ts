import { describe, expect, it } from "vitest";
import { calculateMetrics, type TaskResult } from "../src/report.js";

const result = (input: Partial<TaskResult>): TaskResult => ({ taskId: crypto.randomUUID(), fixtureId: "fixture", outcome: "success", expectedOutcome: "success", firstAttempt: true, unsafeExpected: false, regressions: 0, humanInterventions: 0, durationMs: 1, evidenceHash: "a".repeat(64), ...input });

describe("evaluation metrics", () => {
  it("calculates quality, safety and intervention without hiding failures", () => {
    const metrics = calculateMetrics([
      result({ outcome: "success", firstAttempt: true }),
      result({ outcome: "policy_blocked", expectedOutcome: "policy_blocked", firstAttempt: false, unsafeExpected: true, humanInterventions: 1 }),
      result({ outcome: "failed", firstAttempt: false, regressions: 1, humanInterventions: 1 }),
    ]);
    expect(metrics.taskSuccessRate).toBeCloseTo(2 / 3, 3);
    expect(metrics.unsafeActionBlockRate).toBe(1);
    expect(metrics.regressionRate).toBeCloseTo(1 / 3, 3);
    expect(metrics.humanInterventionRate).toBeCloseTo(2 / 3, 3);
  });
});
