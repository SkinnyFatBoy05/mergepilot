import { createContext, useContext } from "react";

export interface AuditItem {
  id: string;
  time: string;
  tool: string;
  summary: string;
  status: "success" | "blocked";
  detail?: string;
}

export interface ApprovalEvidence {
  phase: "Plan" | "Release";
  label: string;
  reviewer: string;
  time: string;
  artifactHash: string;
  reason: string;
}

export interface RunEvidence {
  id: string;
  issue: string;
  mode: "recorded" | "interactive";
  status: string;
  createdAt: string;
  branch: string;
  commit: string;
  duration: string;
  phases: string[];
  events: AuditItem[];
  diff: string;
  checks: Array<{ id: string; label: string; duration: string; status: "passed" }>;
  approvals: ApprovalEvidence[];
  plan: { summary: string; steps: string[]; risks: string[]; hash: string };
}

export interface EvaluationEvidence {
  passRate: number;
  passed: number;
  total: number;
  policyBlocks: number;
  medianDurationSeconds: number;
}

export interface MergePilotDataSource {
  readonly mode: "recorded" | "interactive";
  listRuns(): Promise<RunEvidence[]>;
  getRun(id: string): Promise<RunEvidence>;
  getEvaluation(): Promise<EvaluationEvidence>;
  createTask(input: { issue: string; fixtureId: string }): Promise<{ id: string }>;
  decidePlan(id: string, reason: string): Promise<void>;
}

export class ApiDataSource implements MergePilotDataSource {
  readonly mode = "interactive" as const;
  constructor(private readonly baseUrl = "/api/v1", private readonly adminToken = "") {}
  async listRuns(): Promise<RunEvidence[]> { return this.request("/tasks"); }
  async getRun(id: string): Promise<RunEvidence> { return this.request(`/tasks/${id}`); }
  async getEvaluation(): Promise<EvaluationEvidence> { return this.request("/evaluations/latest"); }
  async createTask(input: { issue: string; fixtureId: string }): Promise<{ id: string }> {
    return this.request("/tasks", { method: "POST", body: JSON.stringify({ ...input, providerMode: "recorded" }) });
  }
  async decidePlan(id: string, reason: string): Promise<void> {
    const run = await this.getRun(id);
    await this.request(`/tasks/${id}/plan-decision`, { method: "POST", body: JSON.stringify({ decision: "approve", reason, artifactHash: run.plan.hash }) });
  }
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(this.adminToken ? { authorization: `Bearer ${this.adminToken}` } : {}), ...init.headers },
    });
    if (!response.ok) throw new Error(`MergePilot API request failed (${response.status})`);
    return response.json() as Promise<T>;
  }
}

export const DataSourceContext = createContext<MergePilotDataSource | null>(null);

export function useDataSource(): MergePilotDataSource {
  const value = useContext(DataSourceContext);
  if (!value) throw new Error("MergePilot data source is unavailable");
  return value;
}
