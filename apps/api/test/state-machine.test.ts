import { describe, expect, it } from "vitest";
import { assertTransition, canTransition } from "../src/domain/state-machine.js";

describe("task state machine", () => {
  it("blocks execution when plan approval is skipped", () => {
    expect(() => assertTransition("planning", "executing")).toThrow(
      /illegal transition/i,
    );
  });

  it("allows the two approval gates in order", () => {
    expect(canTransition("planning", "awaiting_plan_approval")).toBe(true);
    expect(canTransition("awaiting_plan_approval", "executing")).toBe(true);
    expect(canTransition("reviewing", "awaiting_release_approval")).toBe(true);
    expect(canTransition("awaiting_release_approval", "completed")).toBe(true);
  });

  it("keeps terminal states terminal", () => {
    expect(canTransition("completed", "executing")).toBe(false);
    expect(canTransition("failed_terminal", "planning")).toBe(false);
    expect(canTransition("cancelled", "draft")).toBe(false);
  });
});
