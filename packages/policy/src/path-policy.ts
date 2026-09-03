import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { PolicyError } from "./check-policy.js";

function isAbsoluteOnAnyPlatform(value: string): boolean {
  return path.posix.isAbsolute(value) || path.win32.isAbsolute(value);
}

async function rejectExistingSymlinks(root: string, candidate: string): Promise<void> {
  const relative = path.relative(root, candidate);
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new PolicyError("symlink", "Symbolic links are not permitted in task paths");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }
}

export async function resolveInsideWorkspace(
  root: string,
  requestedPath: string,
): Promise<string> {
  if (
    requestedPath.includes("\0") ||
    isAbsoluteOnAnyPlatform(requestedPath) ||
    requestedPath.split(/[\\/]/).includes("..")
  ) {
    throw new PolicyError("path-escape", "Path must remain inside the task workspace");
  }

  const canonicalRoot = await realpath(root);
  const candidate = path.resolve(canonicalRoot, requestedPath);
  if (
    candidate !== canonicalRoot &&
    !candidate.startsWith(`${canonicalRoot}${path.sep}`)
  ) {
    throw new PolicyError("path-escape", "Path escaped the task workspace");
  }
  await rejectExistingSymlinks(canonicalRoot, candidate);
  return candidate;
}
