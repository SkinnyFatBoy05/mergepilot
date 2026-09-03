import type { AuditEvent } from "@mergepilot/contracts";

export function encodeSse(events: readonly AuditEvent[]): string {
  return events.map((event) => [
    `id: ${event.sequence}`,
    `event: ${event.type}`,
    `data: ${JSON.stringify(event)}`,
    "",
  ].join("\n")).join("\n");
}
