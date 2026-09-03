import { expect, it } from "vitest";
import { summarizeDurations } from "../scripts/run-benchmark.js";
it("summarizes bounded local timings", () => { expect(summarizeDurations([1, 2, 3, 4, 100])).toEqual({ samples: 5, medianMs: 3, p95Ms: 100 }); });
