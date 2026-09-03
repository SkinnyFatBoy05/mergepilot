import { createHash } from "node:crypto";
import type { AuditEvent, AuditEventInput } from "@mergepilot/contracts";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function normalize(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON requires finite numbers");
    return value;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const result: Record<string, JsonValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry === undefined) throw new TypeError("Canonical JSON does not permit undefined");
      result[key] = normalize(entry);
    }
    return result;
  }
  throw new TypeError(`Unsupported canonical JSON value: ${typeof value}`);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export function appendAuditEvent(
  previousHash: string | null,
  input: AuditEventInput,
): AuditEvent {
  const content = { ...input, previousHash };
  return { ...content, hash: sha256(content) };
}

export function verifyAuditChain(
  events: readonly AuditEvent[],
): { valid: true } | { valid: false; index: number; reason: string } {
  let previousHash: string | null = null;
  for (const [index, event] of events.entries()) {
    if (event.previousHash !== previousHash) {
      return { valid: false, index, reason: "Previous hash does not match" };
    }
    const { hash, ...content } = event;
    if (sha256(content) !== hash) {
      return { valid: false, index, reason: "Event hash does not match content" };
    }
    if (event.sequence !== index + 1) {
      return { valid: false, index, reason: "Event sequence is not contiguous" };
    }
    previousHash = hash;
  }
  return { valid: true };
}
