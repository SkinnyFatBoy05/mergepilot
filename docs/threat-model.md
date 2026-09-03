# Threat model

| Threat | Control | Residual risk |
| --- | --- | --- |
| Prompt injection in issue/source | Provider output is untrusted; only typed actions cross the policy boundary | A permitted patch may still be logically wrong; tests and human review remain required |
| Tool escalation | Fixed six-tool MCP surface and independent capability manifest | Docker/kernel vulnerabilities are outside this lab |
| Traversal or absolute paths | Canonical containment plus prefix checks; traversal tests | Platform-specific filesystem edge cases require continued testing |
| Symlink escape | Workspace path resolution rejects escape and runner filesystem is bounded | Host filesystem implementations vary |
| Arbitrary command execution | Provider selects only trusted check IDs; executable/arguments come from the manifest | Trusted check definitions themselves require review |
| Secret exposure | No secrets enter task containers; bounded redaction removes credentials/prompts from replay and logs | Source repositories may contain unknown secret formats |
| Malicious patches | Protected prefixes, patch budgets, deterministic checks, hidden oracle, release approval | Reviewers can still approve a harmful but policy-compliant change |
| Denial of service | Time, byte, file, process, CPU, and memory limits | Control-plane request-rate limiting is not implemented |
| Stale approval | Optimistic version and artifact hash binding | Compromised reviewer identity is out of scope |
| Audit tampering | SHA-256 previous-hash chain and sequence validation | A database administrator could rewrite the entire chain and anchor |
| Unsafe retry after restart | Active attempt becomes interrupted; a new attempt gets a new workspace and idempotency key | External side effects are intentionally absent from fixtures |
| Evaluator leakage | Oracles are excluded from the runner, evaluator has no provider/MCP/network connection | Container root isolation depends on the host runtime |
