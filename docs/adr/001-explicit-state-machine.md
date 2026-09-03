# ADR 001: Explicit workflow state machine

Status: accepted.

MergePilot represents delivery as versioned states rather than inferring progress from messages. Legal transitions are centralized and repository mutations require the expected version. This makes stale approvals and unsafe recovery rejectable. The cost is more transition code and migrations when workflow phases change.
