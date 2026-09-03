import pino, { type Logger } from "pino";

export function createLogger(): Logger {
  return pino({
    level: process.env.LOG_LEVEL ?? "info",
    redact: { paths: ["apiKey", "authorization", "password", "secret", "token", "req.headers.authorization"], censor: "[REDACTED]" },
    base: { service: "mergepilot-api" },
  });
}
