import { expect, it, vi } from "vitest";
import { nextDelivery } from "../src/delivery.js";
it("honors Retry-After", () => { vi.spyOn(Date, "now").mockReturnValue(1_000); expect(nextDelivery({ id: "d1", attempt: 1, nextAt: 0 }, 10).nextAt).toBe(11_000); });
