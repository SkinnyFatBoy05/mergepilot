import { parsePatch } from "diff";
import type { CapabilityManifest } from "./check-policy.js";

export interface PatchDecision {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
  readonly changedPaths: readonly string[];
  readonly addedLines: number;
  readonly deletedLines: number;
}

function normalizeDiffPath(value: string | undefined): string | null {
  if (!value || value === "/dev/null") return null;
  const normalized = value.replaceAll("\\", "/").replace(/^[ab]\//, "");
  if (normalized.startsWith("/") || normalized.split("/").includes("..")) return null;
  return normalized;
}

function startsWithPrefix(filePath: string, prefix: string): boolean {
  const normalizedPrefix = prefix.replaceAll("\\", "/");
  return filePath === normalizedPrefix.replace(/\/$/, "") || filePath.startsWith(normalizedPrefix);
}

export function inspectPatch(
  patchText: string,
  manifest: CapabilityManifest,
): PatchDecision {
  const reasons: string[] = [];
  if (Buffer.byteLength(patchText, "utf8") > manifest.limits.maxPatchBytes) {
    reasons.push("Patch exceeds byte limit");
  }
  if (/GIT binary patch|Binary files .* differ/.test(patchText)) reasons.push("Binary patches are not permitted");

  let parsed: ReturnType<typeof parsePatch>;
  try {
    parsed = parsePatch(patchText);
  } catch {
    return { allowed: false, reasons: ["Patch is not valid unified diff"], changedPaths: [], addedLines: 0, deletedLines: 0 };
  }
  if (parsed.length === 0) reasons.push("Patch does not contain a file change");

  const changedPaths: string[] = [];
  let addedLines = 0;
  let deletedLines = 0;
  for (const file of parsed) {
    const oldPath = normalizeDiffPath(file.oldFileName);
    const newPath = normalizeDiffPath(file.newFileName);
    const changedPath = newPath ?? oldPath;
    if (!changedPath) {
      reasons.push("Patch path is invalid");
      continue;
    }
    if (oldPath && newPath && oldPath !== newPath) reasons.push(`Renames are not permitted: ${oldPath}`);
    if (!manifest.writablePrefixes.some((prefix) => startsWithPrefix(changedPath, prefix))) {
      reasons.push(`Path is outside writable prefixes: ${changedPath}`);
    }
    if (manifest.protectedPrefixes.some((prefix) => startsWithPrefix(changedPath, prefix))) {
      reasons.push(`Protected path cannot be changed: ${changedPath}`);
    }
    changedPaths.push(changedPath);
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.startsWith("+") && !line.startsWith("+++")) addedLines += 1;
        if (line.startsWith("-") && !line.startsWith("---")) deletedLines += 1;
      }
    }
  }

  const uniquePaths = [...new Set(changedPaths)];
  if (uniquePaths.length > manifest.limits.maxFiles) reasons.push("Patch changes too many files");
  if (addedLines + deletedLines > manifest.limits.maxChangedLines) reasons.push("Patch changes too many lines");

  return { allowed: reasons.length === 0, reasons, changedPaths: uniquePaths, addedLines, deletedLines };
}
