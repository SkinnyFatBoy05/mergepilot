import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { createTaskInputSchema, sha256Schema } from "@mergepilot/contracts";
import { z, ZodError } from "zod";
import type { MergePilotRepository } from "../db/repository.js";
import type { MergePilotOrchestrator } from "../orchestration/orchestrator.js";
import { requireAdmin } from "./auth.js";
import { encodeSse } from "./events.js";

export interface ServerDependencies {
  readonly repository: MergePilotRepository;
  readonly orchestrator: MergePilotOrchestrator;
  readonly adminToken: string;
  readonly latestEvaluation: () => Promise<unknown>;
}

const paramsSchema = z.object({ taskId: z.uuid() });
const decisionSchema = z.object({
  decision: z.enum(["approve", "reject", "revise"]),
  artifactHash: sha256Schema,
  reason: z.string().trim().min(3).max(1_000),
});

export function buildServer(dependencies: ServerDependencies): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024 });
  void app.register(cors, { origin: false });
  const admin = requireAdmin(dependencies.adminToken);
  const actor = { id: "console-reviewer", displayName: "Console reviewer", type: "human" as const };

  app.setErrorHandler((error, _request, reply) => {
    const cause = error instanceof Error ? error : new Error("Unknown request failure");
    const validation = cause instanceof ZodError;
    const conflict = /stale|illegal|not ready|not awaiting|required|incomplete|approval/i.test(cause.message);
    const status = validation ? 400 : conflict ? 409 : 500;
    void reply.code(status).type("application/problem+json").send({
      type: `https://mergepilot.dev/problems/${validation ? "validation" : conflict ? "conflict" : "internal"}`,
      title: validation ? "Invalid request" : conflict ? "Workflow conflict" : "Internal error",
      status,
      detail: status === 500 ? "The request failed safely." : cause.message,
    });
  });

  app.post("/api/v1/tasks", { preHandler: admin }, async (request, reply) => {
    const task = await dependencies.orchestrator.createTask(createTaskInputSchema.parse(request.body));
    return reply.code(201).send(task);
  });
  app.get("/api/v1/tasks", () => dependencies.repository.listTasks());
  app.get("/api/v1/tasks/:taskId", async (request, reply) => {
    const { taskId } = paramsSchema.parse(request.params);
    const task = await dependencies.repository.getTask(taskId);
    if (!task) return reply.code(404).type("application/problem+json").send({ type: "https://mergepilot.dev/problems/not-found", title: "Task not found", status: 404 });
    const runs = await dependencies.repository.listRuns(taskId);
    const latestRun = runs.at(-1) ?? null;
    return {
      task,
      plan: await dependencies.repository.getPlan(taskId),
      approvals: await dependencies.repository.listApprovals(taskId),
      latestRun,
      patch: latestRun ? await dependencies.repository.getPatch(latestRun.id) : null,
      checks: latestRun ? await dependencies.repository.listChecks(latestRun.id) : [],
      review: latestRun ? await dependencies.repository.getReview(latestRun.id) : null,
      events: await dependencies.repository.listEventsAfter(taskId, 0),
    };
  });
  app.post("/api/v1/tasks/:taskId/plan", { preHandler: admin }, async (request) => dependencies.orchestrator.plan(paramsSchema.parse(request.params).taskId));
  app.post("/api/v1/tasks/:taskId/plan-decision", { preHandler: admin }, async (request) => {
    const input = decisionSchema.parse(request.body);
    return dependencies.orchestrator.decidePlan(paramsSchema.parse(request.params).taskId, { ...input, actor });
  });
  app.post("/api/v1/tasks/:taskId/run", { preHandler: admin }, async (request) => dependencies.orchestrator.execute(paramsSchema.parse(request.params).taskId));
  app.post("/api/v1/tasks/:taskId/release-decision", { preHandler: admin }, async (request) => {
    const input = decisionSchema.parse(request.body);
    return dependencies.orchestrator.decideRelease(paramsSchema.parse(request.params).taskId, { ...input, actor });
  });
  app.get("/api/v1/tasks/:taskId/events", async (request, reply) => {
    const { taskId } = paramsSchema.parse(request.params);
    const query = z.object({ after: z.coerce.number().int().nonnegative().optional() }).parse(request.query);
    const headerSequence = Number(request.headers["last-event-id"] ?? 0);
    const events = await dependencies.repository.listEventsAfter(taskId, query.after ?? headerSequence);
    return reply.type("text/event-stream").header("cache-control", "no-cache").send(encodeSse(events));
  });
  app.get("/api/v1/evaluations/latest", dependencies.latestEvaluation);
  app.get("/health/live", () => ({ status: "ok" }));
  app.get("/health/ready", async () => ({ status: "ok", repository: (await dependencies.repository.listTasks()) ? "ready" : "unavailable" }));
  app.get("/metrics", (_request, reply) => reply.type("text/plain; version=0.0.4").send("# HELP mergepilot_info MergePilot process information\n# TYPE mergepilot_info gauge\nmergepilot_info 1\n"));
  return app;
}
