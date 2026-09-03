import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
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
    ],
  },
});
