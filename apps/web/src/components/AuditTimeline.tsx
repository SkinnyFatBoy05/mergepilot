import { useState } from "react";
import type { AuditItem } from "../lib/api.js";

export function AuditTimeline({ events }: { events: AuditItem[] }) {
  const [expanded, setExpanded] = useState<string | null>(events.find((event) => event.status === "blocked")?.id ?? null);
  return <ol className="timeline" aria-label="Audit timeline">
    {events.map((event) => <li className={`timeline__row timeline__row--${event.status}`} key={event.id}>
      <span className="timeline__marker" aria-hidden="true">{event.status === "blocked" ? "×" : "✓"}</span>
      <time>{event.time}</time>
      <code>{event.tool}</code>
      <div>
        {event.detail ? <button className="timeline__toggle" aria-expanded={expanded === event.id} onClick={() => setExpanded(expanded === event.id ? null : event.id)}>{event.summary}</button> : <strong>{event.summary}</strong>}
        {event.detail && expanded === event.id ? <p className="timeline__detail">{event.detail}</p> : null}
      </div>
      <span className="timeline__result">{event.status === "blocked" ? "Blocked" : "Success"}</span>
    </li>)}
  </ol>;
}
