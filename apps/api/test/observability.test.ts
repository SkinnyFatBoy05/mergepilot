import { describe, expect, it } from "vitest";
import { createMetrics } from "../src/observability/metrics.js";

describe("observability", () => {
  it("uses bounded labels and exports Prometheus metrics", async () => {
    const metrics = createMetrics();
    metrics.policy.inc({ tool: "apply_patch", decision: "blocked" });
    const output = await metrics.registry.metrics();
    expect(output).toContain('tool="apply_patch",decision="blocked"');
    expect(output).not.toContain("taskId");
  });
});
