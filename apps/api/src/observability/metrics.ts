import { Counter, Histogram, Registry } from "prom-client";

export function createMetrics() {
  const registry = new Registry();
  const transitions = new Counter({ name: "mergepilot_transitions_total", help: "Workflow transitions", labelNames: ["from", "to"] as const, registers: [registry] });
  const runs = new Counter({ name: "mergepilot_runs_total", help: "Run outcomes", labelNames: ["mode", "outcome"] as const, registers: [registry] });
  const policy = new Counter({ name: "mergepilot_policy_decisions_total", help: "Tool policy decisions", labelNames: ["tool", "decision"] as const, registers: [registry] });
  const checkDuration = new Histogram({ name: "mergepilot_check_duration_seconds", help: "Trusted check duration", labelNames: ["check"] as const, buckets: [0.1, 0.5, 1, 5, 15, 60], registers: [registry] });
  return { registry, transitions, runs, policy, checkDuration };
}
