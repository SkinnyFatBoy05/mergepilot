# ADR 003: Recorded and OpenAI providers

Status: accepted.

One provider interface supports checked-in deterministic transcripts and schema-constrained OpenAI responses. Recorded mode powers CI, evaluation, and the public replay without credentials; OpenAI mode proves the real integration on a trusted host. Recorded results do not stand in for live-model quality.
