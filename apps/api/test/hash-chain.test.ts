import { describe, expect, it } from "vitest";
import type { AuditEventInput } from "@mergepilot/contracts";
import { appendAuditEvent, canonicalJson, verifyAuditChain } from "../src/domain/hash-chain.js";

const TASK_ID = "10000000-0000-4000-8000-000000000001";

function eventInput(type: string, sequence = 1): AuditEventInput {
  return {
    schemaVersion: 1,
    id: `10000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    taskId: TASK_ID,
    sequence,
    taskVersion: sequence - 1,
    type,
    actor: { id: "mergepilot", displayName: "MergePilot", type: "system" },
    payloadHash: "a".repeat(64),
    createdAt: "2026-09-03T00:00:00.000Z",
  };
}

describe("audit hash chain", () => {
  it("canonicalizes object keys without reordering arrays", () => {
    expect(canonicalJson({ z: 1, a: [3, 2, 1] })).toBe('{"a":[3,2,1],"z":1}');
  });

  it("creates a deterministic tamper-evident chain", () => {
    const first = appendAuditEvent(null, eventInput("task.created"));
    const second = appendAuditEvent(first.hash, eventInput("plan.approved", 2));
    expect(second.previousHash).toBe(first.hash);
    expect(second.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(appendAuditEvent(null, eventInput("task.created")).hash).toBe(first.hash);
    expect(verifyAuditChain([first, second])).toEqual({ valid: true });
  });

  it("detects a changed event", () => {
    const first = appendAuditEvent(null, eventInput("task.created"));
    const second = appendAuditEvent(first.hash, eventInput("plan.approved", 2));
    const changed = { ...second, type: "plan.rejected" };
    expect(verifyAuditChain([first, changed])).toMatchObject({ valid: false, index: 1 });
  });
});
