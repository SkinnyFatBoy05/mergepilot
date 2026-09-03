const api = process.env.MERGEPILOT_API_URL ?? "http://127.0.0.1:8787";
const web = process.env.MERGEPILOT_WEB_URL ?? "http://127.0.0.1:4173";
async function expectOk(url: string) { const response = await fetch(url); if (!response.ok) throw new Error(`${url} returned ${response.status}`); return response; }
await expectOk(`${api}/health/ready`);
const evaluation = await (await expectOk(`${api}/api/v1/evaluations/latest`)).json() as { totals?: { tasks?: number } };
if (evaluation.totals?.tasks !== 12) throw new Error("Recorded API evaluation is incomplete");
const page = await (await expectOk(`${web}/runs/demo-run`)).text();
if (!page.includes("MergePilot")) throw new Error("Replay console did not render its application shell");
const mutation = await fetch(`${api}/api/v1/tasks`, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer compose-read-only" }, body: JSON.stringify({ issue: "This mutation must remain disabled", fixtureId: "entitlement-service", providerMode: "recorded" }) });
if (mutation.status !== 403) throw new Error(`Replay-only mutation returned ${mutation.status}`);
console.log("Compose smoke passed: health, evaluation, web shell, and replay-only boundary");
