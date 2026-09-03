import type {
  AgentAction,
  ModelCritique,
  Plan,
  ProviderUsage,
  RecordedProviderSequence,
} from "@mergepilot/contracts";
import type {
  ActionProviderInput,
  AgentProvider,
  CritiqueProviderInput,
  PlanProviderInput,
  ProviderResult,
} from "./provider.js";

export class RecordedSequenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecordedSequenceError";
  }
}

export class RecordedProvider implements AgentProvider {
  readonly mode = "recorded" as const;
  private phase: "plan" | "actions" | "critique" | "done" = "plan";
  private actionIndex = 0;

  constructor(private readonly sequence: Readonly<RecordedProviderSequence>) {}

  async createPlan(_input: PlanProviderInput): Promise<ProviderResult<Plan>> {
    if (this.phase !== "plan") throw new RecordedSequenceError(`Expected ${this.phase}, received plan`);
    this.phase = "actions";
    return this.result(structuredClone(this.sequence.plan));
  }

  async nextAction(input: ActionProviderInput): Promise<ProviderResult<AgentAction>> {
    if (this.phase !== "actions") throw new RecordedSequenceError(`Expected ${this.phase}, received action`);
    if (input.ordinal !== this.actionIndex + 1) throw new RecordedSequenceError(`Expected action ordinal ${this.actionIndex + 1}`);
    const action = this.sequence.actions[this.actionIndex];
    if (!action) throw new RecordedSequenceError("Recorded action sequence is exhausted");
    this.actionIndex += 1;
    if (this.actionIndex === this.sequence.actions.length) this.phase = "critique";
    return this.result(structuredClone(action));
  }

  async critique(_input: CritiqueProviderInput): Promise<ProviderResult<ModelCritique>> {
    if (this.phase !== "critique") throw new RecordedSequenceError(`Expected ${this.phase}, received critique`);
    this.phase = "done";
    return this.result(structuredClone(this.sequence.critique));
  }

  private result<T>(value: T): ProviderResult<T> {
    const usage: ProviderUsage = {
      schemaVersion: 1,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      model: `recorded:${this.sequence.recordingId}`,
      providerMode: "recorded",
    };
    return { value, usage, metadata: { mode: "recorded", recordingId: this.sequence.recordingId } };
  }
}
