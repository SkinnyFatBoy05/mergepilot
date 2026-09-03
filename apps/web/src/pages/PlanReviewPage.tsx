import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDataSource, type RunEvidence } from "../lib/api.js";
import { ReadOnlyReplayError } from "../lib/replay.js";

export function PlanReviewPage() {
  const { id = "demo-run" } = useParams(); const source = useDataSource(); const [run, setRun] = useState<RunEvidence | null>(null); const [message, setMessage] = useState("");
  useEffect(() => { void source.getRun(id).then(setRun); }, [id, source]);
  if (!run) return <main className="loading">Loading plan…</main>;
  return <main className="content-page"><header className="page-heading"><div><h1>Plan review</h1><p>{run.issue}</p></div><Link to={`/runs/${id}`}>View evidence</Link></header><div className="review-grid"><section className="plan-copy"><h2>{run.plan.summary}</h2><h3>Execution steps</h3><ol>{run.plan.steps.map((step) => <li key={step}>{step}</li>)}</ol><h3>Risks</h3><ul>{run.plan.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul></section><form className="decision-form" onSubmit={async (event) => { event.preventDefault(); const reason = String(new FormData(event.currentTarget).get("reason")); try { await source.decidePlan(id, reason); setMessage("Plan approved. Execution can begin."); } catch (error) { setMessage(error instanceof ReadOnlyReplayError ? "Read-only recorded demo — decisions are evidence only." : "Decision failed safely."); } }}><h2>Approve exact plan</h2><p>Artifact <code>{run.plan.hash.slice(0, 12)}</code></p><label htmlFor="decision-reason">Decision reason</label><textarea id="decision-reason" name="reason" required minLength={3} /><button className="button" type="submit">Approve {run.plan.hash.slice(0, 8)}</button><p role="status" aria-live="polite">{message}</p></form></div></main>;
}
