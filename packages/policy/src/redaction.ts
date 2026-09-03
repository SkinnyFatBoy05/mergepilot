const ASSIGNMENT_PATTERN = /\b(api[_-]?key|authorization|password|secret|token)\s*[:=]\s*([^\s,;]+)/gi;

export function redactOutput(
  text: string,
  secrets: readonly string[],
  maxBytes: number,
): string {
  let redacted = text;
  for (const secret of secrets.filter(Boolean)) redacted = redacted.replaceAll(secret, "[REDACTED]");
  redacted = redacted.replace(ASSIGNMENT_PATTERN, "$1=[REDACTED]");

  const bytes = Buffer.from(redacted, "utf8");
  if (bytes.length <= maxBytes) return redacted;
  return `${new TextDecoder().decode(bytes.subarray(0, maxBytes))}\n...[truncated]`;
}
