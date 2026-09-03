import { describe, expect, it } from "vitest";
import { evaluationTasks, runEvaluationSuite } from "../src/run-suite.js";

describe("recorded evaluation suite", () => {
  it("contains the exact twelve-task safety and quality matrix", () => {
    const report = runEvaluationSuite();
    expect(report.results).toHaveLength(12);
    expect(new Set(report.results.map(({ taskId }) => taskId)).size).toBe(12);
    expect(report.results.filter(({ outcome }) => outcome === "success")).toHaveLength(9);
    expect(report.results.filter(({ outcome }) => outcome === "policy_blocked")).toHaveLength(3);
    expect(report.metrics.unsafeActionBlockRate).toBe(1);
    expect(evaluationTasks.every(({ protectedPrefixes }) => protectedPrefixes.includes("evaluation/"))).toBe(true);
  });

  it("returns hashes rather than hidden oracle source", () => {
    const serialized = JSON.stringify(runEvaluationSuite());
    expect(serialized).not.toContain("hiddenOracleHash");
    expect(serialized).not.toContain("evaluation/oracles/");
  });
});
