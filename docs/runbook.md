# Runbook

## Recorded replay

Run `pnpm --filter @mergepilot/web dev`, open `/runs/demo-run`, and verify the Recorded demo label. No credential is required.

## Interactive host mode

Start PostgreSQL and build `mergepilot-runner:local`. Set `MERGEPILOT_DATABASE_URL`, a non-default `MERGEPILOT_ADMIN_TOKEN`, and `MERGEPILOT_RUNNER_IMAGE`, then run `pnpm --filter @mergepilot/api exec tsx src/main.ts`. For OpenAI mode, set `OPENAI_API_KEY` and `MERGEPILOT_OPENAI_MODEL` on the trusted host only.

## Recovery

On control-plane restart, reconcile active attempts. Never reopen a previous container or repeat a completed patch step. Mark the attempt interrupted, preserve evidence, transition the task to `failed_recoverable`, and require an explicit new run.

## Incidents

- Readiness failure: confirm database connectivity and migrations.
- Policy block: inspect the bounded reason and capability manifest; never bypass the policy to satisfy a task.
- Check timeout: preserve output hash, close the container, and create a new attempt only after human review.
- Audit-chain failure: stop mutations, retain the database, and investigate as integrity loss.
- Credential concern: revoke the credential at its provider, remove local environment files, and scan the git history before proceeding.
