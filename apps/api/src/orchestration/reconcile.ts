import type { Actor } from "@mergepilot/contracts";
import type { MergePilotRepository } from "../db/repository.js";

const systemActor: Actor = { id: "restart-reconciler", displayName: "Restart reconciler", type: "system" };

export async function reconcileInterruptedRuns(repository: MergePilotRepository, now = new Date()): Promise<number> {
  let reconciled = 0;
  for (const task of await repository.listTasks()) {
    if (["completed", "failed_terminal", "cancelled"].includes(task.status)) continue;
    const active = (await repository.listRuns(task.id)).filter(({ status }) => status === "active");
    for (const run of active) {
      await repository.updateRun({ ...run, status: "interrupted", outcome: "interrupted", finishedAt: now.toISOString() }, systemActor);
      if (["executing", "reviewing"].includes(task.status)) await repository.transitionTask(task.id, task.version, "failed_recoverable", systemActor);
      reconciled += 1;
    }
  }
  return reconciled;
}
