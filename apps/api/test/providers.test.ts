import { describe, expect, it, vi } from "vitest";
import { recordedSuccessfulRun } from "@mergepilot/test-fixtures";
import { OpenAIProvider } from "../src/providers/openai-provider.js";
import { RecordedProvider, RecordedSequenceError } from "../src/providers/recorded-provider.js";
import type { ActionProviderInput, PlanProviderInput } from "../src/providers/provider.js";

const planInput = (): PlanProviderInput => ({
  issue: "Prevent duplicate webhook deliveries after a worker restart.",
  fixtureId: "webhook-worker",
  repositorySummary: "src/worker.ts dispatches queued deliveries.",
});

const actionInput = (): ActionProviderInput => ({
  taskId: "00000000-0000-4000-8000-000000000001",
  plan: recordedSuccessfulRun.plan,
  ordinal: 1,
  observations: ["The worker sends before persisting completion."],
});

describe("RecordedProvider", () => {
  it("replays a finite labelled action sequence", async () => {
    const provider = new RecordedProvider(recordedSuccessfulRun);
    const plan = await provider.createPlan(planInput());
    expect(plan.metadata.mode).toBe("recorded");
    expect((await provider.nextAction(actionInput())).value.type).toBe("tool_call");
    expect(plan.usage).toMatchObject({ inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 });
  });

  it("rejects out-of-order and exhausted replay calls", async () => {
    const provider = new RecordedProvider(recordedSuccessfulRun);
    await expect(provider.nextAction(actionInput())).rejects.toBeInstanceOf(RecordedSequenceError);
    await provider.createPlan(planInput());
    await expect(provider.critique({ plan: recordedSuccessfulRun.plan, diff: "", checks: [] })).rejects.toBeInstanceOf(RecordedSequenceError);
  });
});

describe("OpenAIProvider", () => {
  it("rejects malformed structured output from the real adapter", async () => {
    const parse = vi.fn().mockResolvedValue({ output_parsed: { summary: "too small" }, usage: null });
    const client = { responses: { parse } };
    await expect(new OpenAIProvider(client, { model: "test-model" }).createPlan(planInput())).rejects.toThrow(/schema/i);
  });

  it("reports usage and treats repository observations as untrusted data", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: recordedSuccessfulRun.plan,
      usage: { input_tokens: 100, output_tokens: 40 },
    });
    const provider = new OpenAIProvider(
      { responses: { parse } },
      { model: "test-model", inputPricePerMillion: 2, outputPricePerMillion: 8 },
    );
    const result = await provider.createPlan(planInput());
    expect(result.usage).toMatchObject({ inputTokens: 100, outputTokens: 40, estimatedCostUsd: 0.00052 });
    expect(JSON.stringify(parse.mock.calls[0]?.[0]?.input)).toContain("repository_observation");
  });
});
