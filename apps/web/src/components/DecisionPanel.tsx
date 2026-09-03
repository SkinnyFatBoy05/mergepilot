import type { ApprovalEvidence } from "../lib/api.js";

export function DecisionPanel({ approvals }: { approvals: ApprovalEvidence[] }) {
  return <aside className="decision-rail" aria-labelledby="human-decisions">
    <h2 id="human-decisions">Human decisions</h2>
    {approvals.map((approval) => <article className="approval" key={approval.phase}>
      <h3><span aria-hidden="true">✓</span> {approval.label}</h3>
      <dl>
        <div><dt>Approved by</dt><dd>{approval.reviewer}</dd></div>
        <div><dt>Time</dt><dd>{approval.time}</dd></div>
        <div><dt>{approval.phase} artifact</dt><dd><code>{approval.artifactHash.slice(0, 12)}</code></dd></div>
        <div><dt>Reason</dt><dd>{approval.reason}</dd></div>
      </dl>
    </article>)}
    <p className="decision-rail__seal">Human release gate satisfied</p>
  </aside>;
}
