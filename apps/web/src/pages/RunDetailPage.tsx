import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AuditTimeline } from "../components/AuditTimeline.js";
import { DecisionPanel } from "../components/DecisionPanel.js";
import { DiffViewer } from "../components/DiffViewer.js";
import { StatusPill } from "../components/StatusPill.js";
import { useDataSource, type RunEvidence } from "../lib/api.js";

type Tab = "activity" | "diff" | "verification";

export function RunDetailPage() {
  const { id = "demo-run" } = useParams();
  const dataSource = useDataSource();
  const [run, setRun] = useState<RunEvidence | null>(null);
  const [tab, setTab] = useState<Tab>("activity");
  useEffect(() => { let active = true; void dataSource.getRun(id).then((value) => { if (active) setRun(value); }); return () => { active = false; }; }, [dataSource, id]);
  if (!run) return <main className="loading" aria-live="polite">Loading run evidence…</main>;
  return <main className="run-page">
    <header className="run-header">
      <div><h1>{run.issue}</h1><div className="run-meta"><span>{run.createdAt}</span><span>{run.branch}</span><code>{run.commit}</code><span>{run.duration}</span></div></div>
      <div className="run-header__status"><StatusPill>{run.mode === "recorded" ? "Recorded demo" : "Interactive local run"}</StatusPill><StatusPill tone="success">{run.status}</StatusPill></div>
    </header>
    <ol className="phase-rail" aria-label="Delivery phases; scroll horizontally for all phases" tabIndex={0}>{run.phases.map((phase, index) => <li key={phase}><span>{index + 1}</span>{phase}</li>)}</ol>
    <div className="run-grid">
      <section className="workspace" aria-label="Run evidence">
        <div className="tabs" role="tablist" aria-label="Evidence views">
          {(["activity", "diff", "verification"] as const).map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>{name[0]!.toUpperCase() + name.slice(1)}</button>)}
        </div>
        <div className="tab-panel" role="tabpanel">
          {tab === "activity" ? <><h2>Audit timeline</h2><AuditTimeline events={run.events} /><button className="verification-summary" type="button" onClick={() => setTab("verification")}><span aria-hidden="true">✓</span><span><small>Verification summary</small><strong>12 checks passed</strong></span><span>View verification details</span></button></> : null}
          {tab === "diff" ? <><div className="section-heading"><div><h2>Corrected patch</h2><p>4 additions · 1 deletion · 1 file</p></div><code>{run.commit}</code></div><DiffViewer diff={run.diff} /></> : null}
          {tab === "verification" ? <><div className="section-heading"><div><h2>12 checks passed</h2><p>Deterministic evidence captured before release approval.</p></div><StatusPill tone="success">All passed</StatusPill></div><ul className="checks">{run.checks.map((check) => <li key={check.id}><span aria-hidden="true">✓</span><strong>{check.label}</strong><time>{check.duration}</time><StatusPill tone="success">Passed</StatusPill></li>)}</ul></> : null}
        </div>
      </section>
      <DecisionPanel approvals={run.approvals} />
    </div>
    <footer className="evidence-footer"><Link to="/evaluation">Evaluation evidence <span aria-hidden="true">↗</span></Link></footer>
  </main>;
}
