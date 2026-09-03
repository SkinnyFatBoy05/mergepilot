import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "unit",
      environment: "node",
      include: ["**/*.{test,spec}.{ts,tsx}"],
      exclude: ["**/*.integration.{test,spec}.{ts,tsx}", "**/e2e/**", "**/node_modules/**"],
    },
  },
  {
    test: {
      name: "integration",
      environment: "node",
      include: ["**/*.integration.{test,spec}.{ts,tsx}"],
      exclude: ["**/node_modules/**"],
    },
  },
]);
