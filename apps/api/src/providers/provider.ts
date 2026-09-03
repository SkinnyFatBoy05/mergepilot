import type {
  AgentAction,
  CheckResult,
  FixtureId,
  ModelCritique,
  Plan,
  ProviderUsage,
} from "@mergepilot/contracts";

export interface PlanProviderInput {
  readonly issue: string;
  readonly fixtureId: FixtureId;
  readonly repositorySummary: string;
}

export interface ActionProviderInput {
  readonly taskId: string;
  readonly plan: Plan;
  readonly ordinal: number;
  readonly observations: readonly string[];
}

export interface CritiqueProviderInput {
  readonly plan: Plan;
  readonly diff: string;
  readonly checks: readonly CheckResult[];
}

export interface ProviderResult<T> {
  readonly value: T;
  readonly usage: ProviderUsage;
  readonly metadata: {
    readonly mode: "recorded" | "openai";
    readonly recordingId?: string;
  };
}

export interface AgentProvider {
  readonly mode: "recorded" | "openai";
  createPlan(input: PlanProviderInput): Promise<ProviderResult<Plan>>;
  nextAction(input: ActionProviderInput): Promise<ProviderResult<AgentAction>>;
  critique(input: CritiqueProviderInput): Promise<ProviderResult<ModelCritique>>;
}
