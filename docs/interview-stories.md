# Interview stories

## Separating model autonomy from execution authority

The design problem was letting an agent contribute useful engineering work without treating model text as authority. I split planning from actions, validated both against schemas, and placed an independent policy layer in front of a six-tool MCP server. A recorded scenario demonstrates a protected-path proposal being blocked before mutation, followed by a safe replan.

## Making approvals auditable

A generic “approve” button is weak evidence. MergePilot hashes the plan and review bundle, binds each decision to the task version, actor, reason, and timestamp, and rejects stale or mismatched hashes. The UI keeps both decisions visible beside the technical evidence.

## Choosing honest evaluation

I created three small fictional repositories and 12 fixed tasks. Nine represent useful changes; three deliberately request unsafe behavior. Reports carry numerators, denominators, per-task evidence hashes, limitations, and task-set identity. This makes the portfolio claim reproducible without pretending a small recorded suite predicts production reliability.
