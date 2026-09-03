import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  server: { port: 4173 },
  preview: { port: 4173 },
  test: { environment: "jsdom", setupFiles: "./src/test-setup.ts" },
});
