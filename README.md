# MergePilot

MergePilot is a full-stack agentic software-delivery lab: an AI provider proposes a plan and bounded repository actions, an independent policy layer controls six MCP tools, humans approve the plan and release evidence, and every transition is hash-linked for review.

![MergePilot evidence console](docs/screenshots/desktop.png)

## Two-minute recruiter demo

1. Open the recorded run at `/runs/demo-run`.
2. Expand **Blocked: protected path** to see a rejected attempt before mutation.
3. Open **Diff** to inspect the corrected patch.
4. Open **Verification** to review 12 deterministic checks.
5. Read both artifact-bound human approvals, then open **Evaluation evidence**.

The checked-in replay is read-only and contains no API key. Its numbers come from [`evaluation/reports/latest.json`](evaluation/reports/latest.json), not marketing copy.

## Run locally

Requires Node.js 24 and pnpm 11.

```bash
pnpm install --frozen-lockfile
pnpm --filter @mergepilot/web dev
```

Visit `http://127.0.0.1:4173/runs/demo-run`. For the replay API, web console, and PostgreSQL together, start Docker Desktop and run:

```bash
docker compose up -d --build --wait
pnpm tsx scripts/smoke-compose.ts
```

The Compose API is deliberately replay-only. Host-launched interactive mode requires `MERGEPILOT_DATABASE_URL`, `MERGEPILOT_ADMIN_TOKEN`, and `MERGEPILOT_RUNNER_IMAGE`; OpenAI mode additionally requires `OPENAI_API_KEY` and `MERGEPILOT_OPENAI_MODEL`. The API never sends a key into the task container.

## Verify

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm evaluate -- --provider recorded --output evaluation/reports/latest.json
pnpm --filter @mergepilot/web build
pnpm test:e2e
pnpm tsx scripts/generate-sbom.ts
pnpm audit
```

The recorded suite has 12 fixed tasks across three fictional repositories: nine safe engineering tasks complete and three unsafe requests are blocked. This is 100% expected-outcome success and a 100% unsafe-action block rate for this deterministic task set. It is not a claim about arbitrary model behavior or production reliability.

## Architecture

```text
React evidence console ──HTTP/SSE──> Fastify control plane ──> state + hash-linked audit
                                            │
                          plan/release human approvals
                                            │
                   agent provider ──typed actions──> policy boundary
                                            │
                          six MCP tools in a networkless container
                                            │
                             separate hidden evaluator boundary
```

See [architecture](docs/architecture.md), [threat model](docs/threat-model.md), [runbook](docs/runbook.md), [claim evidence](docs/claim-evidence.md), and the [CycloneDX SBOM](sbom.cdx.json).

## Measured evidence and limits

- Recorded evaluation: 12/12 expected outcomes; 9 accepted changes and 3 policy blocks.
- Browser verification: desktop 1440×900 and mobile 390×844 recruiter flows, with zero tested axe WCAG A/AA violations.
- Local benchmark: 50 measured samples per operation after 10 warmups. It is a microbenchmark, not throughput, availability, or an SLA.
- PostgreSQL and hardened Docker paths are covered by integration tests designed for CI. Docker Desktop was unavailable during the local build, so local container execution is not represented as verified here.
- OpenAI structured-output provider passed one credentialed smoke test; the checked-in CI and replay remain deterministic and credential-free.

## License

MIT. All fixture organizations, people, data, identifiers, and incidents are fictional.
