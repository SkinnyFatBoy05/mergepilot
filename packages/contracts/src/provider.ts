import { z } from "zod";
import {
  modelCritiqueSchema,
  planSchema,
  providerModeSchema,
  schemaVersionSchema,
  toolNameSchema,
} from "./domain.js";

export const providerUsageSchema = z.object({
  schemaVersion: schemaVersionSchema,
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative().nullable(),
  model: z.string().min(1).max(160),
  providerMode: providerModeSchema,
});
export type ProviderUsage = z.infer<typeof providerUsageSchema>;

export const agentActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("tool_call"),
    tool: toolNameSchema,
    arguments: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal("complete"),
    summary: z.string().min(1).max(1_000),
  }),
]);
export type AgentAction = z.infer<typeof agentActionSchema>;

export const recordedProviderSequenceSchema = z.object({
  schemaVersion: schemaVersionSchema,
  recordingId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  plan: planSchema,
  actions: z.array(agentActionSchema).min(1).max(24),
  critique: modelCritiqueSchema,
});
export type RecordedProviderSequence = z.infer<typeof recordedProviderSequenceSchema>;
