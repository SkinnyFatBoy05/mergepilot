import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReadOnlyReplayError } from "../lib/replay.js";
import { useDataSource } from "../lib/api.js";

export function NewTaskPage() {
  const source = useDataSource(); const navigate = useNavigate(); const [message, setMessage] = useState("");
  return <main className="content-page narrow"><h1>New delivery task</h1><p>Describe one bounded issue and choose a visible evaluation fixture.</p><form className="form" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { const task = await source.createTask({ issue: String(form.get("issue")), fixtureId: String(form.get("fixture")) }); navigate(`/runs/${task.id}/plan`); } catch (error) { setMessage(error instanceof ReadOnlyReplayError ? "Recorded demo is read-only. Start the local API for an interactive run." : "Task creation failed safely."); } }}>
    <label>Issue<textarea name="issue" required minLength={10} defaultValue="Prevent duplicate webhook deliveries after a worker restart." /></label>
    <label>Fixture<select name="fixture" defaultValue="webhook-worker"><option value="webhook-worker">Webhook worker</option><option value="entitlement-service">Entitlement service</option><option value="react-access-console">React access console</option></select></label>
    <button className="button" type="submit">Create and plan</button><p role="status" aria-live="polite">{message}</p>
  </form></main>;
}
