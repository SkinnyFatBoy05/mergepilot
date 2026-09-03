import { describe, expect, it } from "vitest";
import {
  agentActionSchema,
  createTaskInputSchema,
  planSchema,
  taskStatusSchema,
} from "../src/index.js";

describe("versioned contracts", () => {
  it("rejects blank issues and accepts the finite lifecycle", () => {
    expect(
      createTaskInputSchema.safeParse({
        issue: " ",
        fixtureId: "entitlement-service",
        providerMode: "recorded",
      }).success,
    ).toBe(false);
    expect(taskStatusSchema.parse("awaiting_plan_approval")).toBe(
      "awaiting_plan_approval",
    );
  });

  it("requires a concrete plan and a discriminated agent action", () => {
    expect(planSchema.safeParse({ schemaVersion: 1, summary: "fix" }).success).toBe(
      false,
    );
    expect(
      agentActionSchema.parse({
        type: "tool_call",
        tool: "read_file",
        arguments: { path: "src/access.ts", startLine: 1, endLine: 80 },
      }).type,
    ).toBe("tool_call");
  });
});
