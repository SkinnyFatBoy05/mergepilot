import type { FixtureId } from "@mergepilot/contracts";

export interface TrustedCheck {
  readonly executable: string;
  readonly args: readonly string[];
  readonly timeoutMs: number;
}

export interface CapabilityManifest {
  readonly schemaVersion: 1;
  readonly fixtureId: FixtureId;
  readonly writablePrefixes: readonly string[];
  readonly protectedPrefixes: readonly string[];
  readonly checks: Readonly<Record<string, TrustedCheck>>;
  readonly limits: {
    readonly maxFiles: number;
    readonly maxPatchBytes: number;
    readonly maxChangedLines: number;
  };
}

export class PolicyError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PolicyError";
    this.code = code;
  }
}

export function resolveTrustedCheck(
  checkId: string,
  manifest: CapabilityManifest,
): TrustedCheck {
  const check = manifest.checks[checkId];
  if (!check) throw new PolicyError("unknown-check", `Unknown check identifier: ${checkId}`);
  return { executable: check.executable, args: [...check.args], timeoutMs: check.timeoutMs };
}
