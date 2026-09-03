import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StatusPill } from "../components/StatusPill.js";
import { useDataSource, type RunEvidence } from "../lib/api.js";

export function RunListPage() {
  const dataSource = useDataSource();
  const [runs, setRuns] = useState<RunEvidence[]>([]);
  useEffect(() => { void dataSource.listRuns().then(setRuns); }, [dataSource]);
  return <main className="content-page"><header className="page-heading"><div><h1>Delivery runs</h1><p>Plans, policy decisions, checks, and approvals in one audit trail.</p></div><Link className="button" to="/runs/new">New task</Link></header>
    <div className="run-table" role="table" aria-label="Delivery runs">{runs.map((run) => <Link role="row" to={`/runs/${run.id}`} key={run.id}><span><strong>{run.issue}</strong><small>{run.createdAt}</small></span><code>{run.commit}</code><StatusPill>{run.mode === "recorded" ? "Recorded demo" : "Interactive"}</StatusPill><StatusPill tone="success">{run.status}</StatusPill></Link>)}</div>
  </main>;
}
