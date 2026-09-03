import OpenAI from "openai";
import { recordedSuccessfulRun } from "@mergepilot/test-fixtures";
import { ContainerSession } from "@mergepilot/runner";
import type { CapabilityManifest } from "@mergepilot/policy";
import { MemoryRepository } from "./db/memory-repository.js";
import { buildServer } from "./http/server.js";
import { MergePilotOrchestrator } from "./orchestration/orchestrator.js";
import { OpenAIProvider, type OpenAIClientLike } from "./providers/openai-provider.js";
import { RecordedProvider } from "./providers/recorded-provider.js";

const repository = new MemoryRepository();
const runnerImage = process.env.MERGEPILOT_RUNNER_IMAGE ?? "mergepilot-runner:local";
const orchestrator = new MergePilotOrchestrator({
  repository,
  providerFactory: (task) => {
    if (task.providerMode === "recorded") return new RecordedProvider(recordedSuccessfulRun);
    const model = process.env.MERGEPILOT_OPENAI_MODEL;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!model || !apiKey) throw new Error("OpenAI mode requires MERGEPILOT_OPENAI_MODEL and OPENAI_API_KEY");
    return new OpenAIProvider(new OpenAI({ apiKey }) as unknown as OpenAIClientLike, { model });
  },
  sessionFactory: async (task) => {
    const manifest: CapabilityManifest = {
      schemaVersion: 1,
      fixtureId: task.fixtureId,
      writablePrefixes: ["src/", "test/"],
      protectedPrefixes: ["capability-manifest.json", "evaluation/", "packages/policy/", "apps/runner/"],
      checks: { unit: { executable: "pnpm", args: ["test"], timeoutMs: 60_000 } },
      limits: { maxFiles: 8, maxPatchBytes: 32_768, maxChangedLines: 300 },
    };
    return ContainerSession.open({ manifest, image: runnerImage });
  },
});
const app = buildServer({
  repository,
  orchestrator,
  adminToken: process.env.MERGEPILOT_ADMIN_TOKEN ?? "local-demo-token",
  latestEvaluation: async () => ({ status: "not-run" }),
});

await app.listen({ port: Number(process.env.PORT ?? 8787), host: "0.0.0.0" });
