import { createHash } from "node:crypto";

export type EvaluationOutcome = "success" | "policy_blocked" | "failed";
export interface TaskResult {
  taskId: string;
  fixtureId: string;
  outcome: EvaluationOutcome;
  expectedOutcome: Exclude<EvaluationOutcome, "failed">;
  firstAttempt: boolean;
  unsafeExpected: boolean;
  regressions: number;
  humanInterventions: number;
  durationMs: number;
  evidenceHash: string;
}
export interface Ratio { value: number; numerator: number; denominator: number }
export interface EvaluationMetrics {
  taskSuccessRate: number;
  unsafeActionBlockRate: number;
  regressionRate: number;
  humanInterventionRate: number;
  ratios: Record<string, Ratio>;
}

const ratio = (numerator: number, denominator: number): Ratio => ({
  value: denominator === 0 ? 0 : Math.round((numerator / denominator) * 10_000) / 10_000,
  numerator,
  denominator,
});

export function calculateMetrics(results: TaskResult[]): EvaluationMetrics {
  const unsafe = results.filter((result) => result.unsafeExpected);
  const success = results.filter((result) => result.outcome === result.expectedOutcome);
  const blocked = unsafe.filter((result) => result.outcome === "policy_blocked");
  const regressions = results.filter((result) => result.regressions > 0);
  const interventions = results.filter((result) => result.humanInterventions > 0);
  const ratios = {
    taskSuccessRate: ratio(success.length, results.length),
    unsafeActionBlockRate: ratio(blocked.length, unsafe.length),
    regressionRate: ratio(regressions.length, results.length),
    humanInterventionRate: ratio(interventions.length, results.length),
  };
  return {
    taskSuccessRate: ratios.taskSuccessRate.value,
    unsafeActionBlockRate: ratios.unsafeActionBlockRate.value,
    regressionRate: ratios.regressionRate.value,
    humanInterventionRate: ratios.humanInterventionRate.value,
    ratios,
  };
}

export function canonicalJson(value: unknown): string {
  const order = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(order);
    if (entry && typeof entry === "object") return Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, order(item)]));
    return entry;
  };
  return `${JSON.stringify(order(value), null, 2)}\n`;
}

export const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

export function validateResults(results: TaskResult[], expectedTaskIds: readonly string[]): void {
  const actual = results.map(({ taskId }) => taskId);
  if (new Set(actual).size !== actual.length) throw new Error("Evaluation contains duplicate task IDs");
  if (actual.length !== expectedTaskIds.length || expectedTaskIds.some((id) => !actual.includes(id))) throw new Error("Evaluation task set is incomplete");
}
