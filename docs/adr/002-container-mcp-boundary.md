# ADR 002: Containerized MCP capability boundary

Status: accepted.

Agent actions cross a six-tool MCP surface inside a network-disabled, resource-bounded container. Tool names and schemas are narrower than a shell, and independent policy selects writable paths and trusted checks. This adds Docker overhead but provides a visible, testable authority boundary.
