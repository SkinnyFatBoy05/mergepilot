import { readFile } from "node:fs/promises";
import type { CapabilityManifest } from "@mergepilot/policy";
import { z } from "zod";

const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  fixtureId: z.enum(["entitlement-service", "webhook-worker", "react-access-console"]),
  writablePrefixes: z.array(z.string().min(1)),
  protectedPrefixes: z.array(z.string().min(1)),
  checks: z.record(z.string(), z.object({
    executable: z.string().min(1),
    args: z.array(z.string()),
    timeoutMs: z.number().int().positive().max(300_000),
  })),
  limits: z.object({
    maxFiles: z.number().int().positive().max(50),
    maxPatchBytes: z.number().int().positive().max(1_048_576),
    maxChangedLines: z.number().int().positive().max(10_000),
  }),
});

export async function loadCapabilityManifest(path: string): Promise<CapabilityManifest> {
  return manifestSchema.parse(JSON.parse(await readFile(path, "utf8")));
}
