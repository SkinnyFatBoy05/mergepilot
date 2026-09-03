import OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { OpenAIProvider, type OpenAIClientLike } from "../src/providers/openai-provider.js";

const enabled = process.env.MERGEPILOT_RUN_LIVE === "1";

describe.skipIf(!enabled)("OpenAI live provider", () => {
  it("returns a schema-valid plan through the Responses API", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.MERGEPILOT_OPENAI_MODEL;
    if (!apiKey || !model) throw new Error("OPENAI_API_KEY and MERGEPILOT_OPENAI_MODEL are required");
    const client = new OpenAI({ apiKey });
    const provider = new OpenAIProvider(client as unknown as OpenAIClientLike, { model });
    const result = await provider.createPlan({
      issue: "Prevent duplicate webhook deliveries after a worker restart.",
      fixtureId: "webhook-worker",
      repositorySummary: "A small TypeScript worker reads queued events, sends each webhook, then marks it complete. Unit checks are available as the trusted check ID unit.",
    });
    expect(result.value.requestedCheckIds).toContain("unit");
    expect(result.usage.providerMode).toBe("openai");
    expect(result.usage.inputTokens).toBeGreaterThan(0);
  }, 120_000);
});
