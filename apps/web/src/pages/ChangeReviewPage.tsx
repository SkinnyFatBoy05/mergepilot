import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { DecisionPanel } from "../components/DecisionPanel.js";
import { DiffViewer } from "../components/DiffViewer.js";
import { useDataSource, type RunEvidence } from "../lib/api.js";

export function ChangeReviewPage() { const { id = "demo-run" } = useParams(); const source = useDataSource(); const [run, setRun] = useState<RunEvidence | null>(null); useEffect(() => { void source.getRun(id).then(setRun); }, [id, source]); if (!run) return <main className="loading">Loading change review…</main>; return <main className="content-page"><h1>Change review</h1><p>{run.issue}</p><div className="run-grid"><section className="workspace tab-panel"><h2>Corrected patch</h2><DiffViewer diff={run.diff} /></section><DecisionPanel approvals={run.approvals} /></div></main>; }
