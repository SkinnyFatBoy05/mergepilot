import type { TaskStatus } from "@mergepilot/contracts";

const transitions: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  draft: ["planning", "cancelled"],
  planning: ["awaiting_plan_approval", "failed_recoverable", "failed_terminal", "cancelled"],
  awaiting_plan_approval: ["executing", "planning", "cancelled"],
  executing: ["reviewing", "failed_recoverable", "failed_terminal", "cancelled"],
  reviewing: ["awaiting_release_approval", "failed_recoverable", "failed_terminal"],
  awaiting_release_approval: ["completed", "executing", "cancelled"],
  completed: [],
  failed_recoverable: ["planning", "executing", "reviewing", "cancelled"],
  failed_terminal: [],
  cancelled: [],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal transition: ${from} -> ${to}`);
  }
}
