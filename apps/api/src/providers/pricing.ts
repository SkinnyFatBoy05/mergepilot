import type { ProviderUsage } from "@mergepilot/contracts";

export interface UsageInput {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
}

export interface ProviderPricing {
  readonly inputPricePerMillion?: number;
  readonly outputPricePerMillion?: number;
}

export function buildUsage(
  usage: UsageInput | null | undefined,
  model: string,
  pricing: ProviderPricing,
): ProviderUsage {
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;
  const estimatedCostUsd = pricing.inputPricePerMillion === undefined || pricing.outputPricePerMillion === undefined
    ? null
    : (inputTokens * pricing.inputPricePerMillion + outputTokens * pricing.outputPricePerMillion) / 1_000_000;
  return {
    schemaVersion: 1,
    inputTokens,
    outputTokens,
    estimatedCostUsd,
    model,
    providerMode: "openai",
  };
}
