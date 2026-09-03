import { BrowserRouter, Link, MemoryRouter, NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import type { MergePilotDataSource } from "./lib/api.js";
import { DataSourceContext } from "./lib/api.js";
import { recordedDataSource } from "./lib/replay.js";
import { ChangeReviewPage } from "./pages/ChangeReviewPage.js";
import { EvaluationPage } from "./pages/EvaluationPage.js";
import { NewTaskPage } from "./pages/NewTaskPage.js";
import { PlanReviewPage } from "./pages/PlanReviewPage.js";
import { RunDetailPage } from "./pages/RunDetailPage.js";
import { RunListPage } from "./pages/RunListPage.js";

function RailIcon({ kind }: { kind: "runs" | "new" | "evaluation" }) {
  if (kind === "new") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
  if (kind === "evaluation") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9m7 10V5m7 14v-7" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h9" /></svg>;
}

function Shell({ mode }: { mode: MergePilotDataSource["mode"] }) {
  return <div className="app-shell"><aside className="rail"><Link className="mark" to="/runs" aria-label="MergePilot home">M</Link><nav aria-label="Primary navigation"><NavLink to="/runs" aria-label="Delivery runs"><RailIcon kind="runs" /></NavLink><NavLink to="/runs/new" aria-label="New task"><RailIcon kind="new" /></NavLink><NavLink to="/evaluation" aria-label="Evaluation"><RailIcon kind="evaluation" /></NavLink></nav><span className="rail__mode" title={mode === "recorded" ? "Recorded demo" : "Interactive local run"}>{mode === "recorded" ? "R" : "L"}</span></aside><div className="app-content"><header className="brandbar"><Link to="/runs">MergePilot</Link><span>{mode === "recorded" ? "Recorded demo" : "Interactive local run"}</span></header><Outlet /></div></div>;
}

function AppRoutes({ mode }: { mode: MergePilotDataSource["mode"] }) {
  return <Routes><Route element={<Shell mode={mode} />}><Route index element={<Navigate to="/runs" replace />} /><Route path="runs" element={<RunListPage />} /><Route path="runs/new" element={<NewTaskPage />} /><Route path="runs/:id" element={<RunDetailPage />} /><Route path="runs/:id/plan" element={<PlanReviewPage />} /><Route path="runs/:id/review" element={<ChangeReviewPage />} /><Route path="evaluation" element={<EvaluationPage />} /><Route path="*" element={<Navigate to="/runs" replace />} /></Route></Routes>;
}

export function App({ dataSource = recordedDataSource(), initialPath }: { dataSource?: MergePilotDataSource; initialPath?: string }) {
  const content = <DataSourceContext.Provider value={dataSource}><AppRoutes mode={dataSource.mode} /></DataSourceContext.Provider>;
  return initialPath ? <MemoryRouter initialEntries={[initialPath]}>{content}</MemoryRouter> : <BrowserRouter>{content}</BrowserRouter>;
}
