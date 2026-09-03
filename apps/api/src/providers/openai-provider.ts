import {
  agentActionSchema,
  modelCritiqueSchema,
  planSchema,
  type AgentAction,
  type ModelCritique,
  type Plan,
} from "@mergepilot/contracts";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { buildActionMessages, buildCritiqueMessages, buildPlanMessages } from "./prompts.js";
import { buildUsage, type ProviderPricing, type UsageInput } from "./pricing.js";
import type {
  ActionProviderInput,
  AgentProvider,
  CritiqueProviderInput,
  PlanProviderInput,
  ProviderResult,
} from "./provider.js";

interface ParsedResponse {
  readonly output_parsed?: unknown;
  readonly usage?: UsageInput | null;
}

export interface OpenAIClientLike {
  readonly responses: {
    parse(params: unknown): Promise<ParsedResponse>;
  };
}

export interface OpenAIProviderConfig extends ProviderPricing {
  readonly model: string;
}

export class ProviderSchemaError extends Error {
  constructor(label: string, cause?: unknown) {
    super(`${label} response failed schema validation`, { cause });
    this.name = "ProviderSchemaError";
  }
}

export class OpenAIProvider implements AgentProvider {
  readonly mode = "openai" as const;

  constructor(
    private readonly client: OpenAIClientLike,
    private readonly config: OpenAIProviderConfig,
  ) {
    if (!config.model.trim()) throw new Error("An explicit OpenAI model is required");
  }

  createPlan(input: PlanProviderInput): Promise<ProviderResult<Plan>> {
    return this.parse("Plan", planSchema, "mergepilot_plan", buildPlanMessages(input));
  }

  nextAction(input: ActionProviderInput): Promise<ProviderResult<AgentAction>> {
    return this.parse("Action", agentActionSchema, "mergepilot_action", buildActionMessages(input));
  }

  critique(input: CritiqueProviderInput): Promise<ProviderResult<ModelCritique>> {
    return this.parse("Critique", modelCritiqueSchema, "mergepilot_critique", buildCritiqueMessages(input));
  }

  private async parse<T>(label: string, schema: z.ZodType<T>, schemaName: string, input: unknown): Promise<ProviderResult<T>> {
    const response = await this.client.responses.parse({
      model: this.config.model,
      input,
      text: { format: zodTextFormat(schema, schemaName) },
      store: false,
    });
    if (response.output_parsed === undefined || response.output_parsed === null) throw new ProviderSchemaError(label);
    const parsed = schema.safeParse(response.output_parsed);
    if (!parsed.success) throw new ProviderSchemaError(label, parsed.error);
    return {
      value: parsed.data,
      usage: buildUsage(response.usage, this.config.model, this.config),
      metadata: { mode: "openai" },
    };
  }
}
