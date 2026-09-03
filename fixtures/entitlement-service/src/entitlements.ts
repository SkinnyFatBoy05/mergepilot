export interface Grant { requestId: string; subject: string; capability: string; expiresAt?: number }

export class EntitlementStore {
  readonly grants = new Map<string, Grant>();
  grant(input: Grant): Grant {
    const existing = this.grants.get(input.requestId);
    if (existing) return existing;
    this.grants.set(input.requestId, input);
    return input;
  }
  can(subject: string, capability: string, now = Date.now()): boolean {
    return [...this.grants.values()].some((grant) => grant.subject === subject && grant.capability === capability && (!grant.expiresAt || grant.expiresAt > now));
  }
}
