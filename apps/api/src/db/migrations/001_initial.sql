create table if not exists tasks (
  id uuid primary key,
  version integer not null,
  status text not null,
  payload jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists plans (
  task_id uuid primary key references tasks(id) on delete cascade,
  artifact_hash char(64) not null check (artifact_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null
);

create table if not exists approvals (
  id uuid primary key,
  task_id uuid not null references tasks(id) on delete cascade,
  phase text not null,
  artifact_hash char(64) not null check (artifact_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null,
  unique (task_id, phase, artifact_hash, id)
);

create table if not exists runs (
  id uuid primary key,
  task_id uuid not null references tasks(id) on delete cascade,
  idempotency_key text not null unique,
  payload jsonb not null
);

create table if not exists tool_calls (
  id uuid primary key,
  run_id uuid not null references runs(id) on delete cascade,
  ordinal integer not null,
  payload jsonb not null,
  unique (run_id, ordinal)
);

create table if not exists patches (
  run_id uuid primary key references runs(id) on delete cascade,
  artifact_hash char(64) not null check (artifact_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null
);

create table if not exists check_results (
  id uuid primary key,
  run_id uuid not null references runs(id) on delete cascade,
  check_id text not null,
  payload jsonb not null,
  unique (run_id, check_id)
);

create table if not exists reviews (
  id uuid primary key,
  run_id uuid not null unique references runs(id) on delete cascade,
  evidence_hash char(64) not null check (evidence_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null
);

create table if not exists release_bundles (
  id uuid primary key,
  task_id uuid not null references tasks(id),
  run_id uuid not null references runs(id),
  plan_approval_id uuid not null references approvals(id),
  release_approval_id uuid not null references approvals(id),
  payload jsonb not null
);

create table if not exists audit_events (
  id uuid primary key,
  task_id uuid not null references tasks(id) on delete cascade,
  sequence integer not null,
  previous_hash char(64) check (previous_hash is null or previous_hash ~ '^[a-f0-9]{64}$'),
  payload_hash char(64) not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  hash char(64) not null check (hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null,
  unique (task_id, sequence)
);
