import { describe, expect, it } from "vitest";
import { recordedSuccessfulRun } from "@mergepilot/test-fixtures";
import { MemoryRepository } from "../src/db/memory-repository.js";
import { buildServer } from "../src/http/server.js";
import { MergePilotOrchestrator } from "../src/orchestration/orchestrator.js";
import { RecordedProvider } from "../src/providers/recorded-provider.js";

function harness() {
  const repository = new MemoryRepository();
  const orchestrator = new MergePilotOrchestrator({
    repository,
    providerFactory: () => new RecordedProvider(recordedSuccessfulRun),
    sessionFactory: async () => ({ async call() { return {}; }, async close() {} }),
  });
  return buildServer({ repository, orchestrator, adminToken: "test-admin-token", latestEvaluation: async () => ({ passRate: 1 }) });
}

describe("control-plane HTTP API", () => {
  it("requires bearer auth for mutations", async () => {
    const app = harness();
    const response = await app.inject({ method: "POST", url: "/api/v1/tasks", payload: {} });
    expect(response.statusCode).toBe(401);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    await app.close();
  });

  it("creates and lists a validated task", async () => {
    const app = harness();
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/tasks",
      headers: { authorization: "Bearer test-admin-token" },
      payload: { issue: "Prevent duplicate webhook deliveries after a worker restart.", fixtureId: "webhook-worker", providerMode: "recorded" },
    });
    expect(created.statusCode).toBe(201);
    const listed = await app.inject({ method: "GET", url: "/api/v1/tasks" });
    expect(listed.json()).toHaveLength(1);
    await app.close();
  });

  it("supports resumable event reads and health endpoints", async () => {
    const app = harness();
    const live = await app.inject({ method: "GET", url: "/health/live" });
    expect(live.json()).toEqual({ status: "ok" });
    const metrics = await app.inject({ method: "GET", url: "/metrics" });
    expect(metrics.body).toContain("mergepilot_info 1");
    await app.close();
  });
});
