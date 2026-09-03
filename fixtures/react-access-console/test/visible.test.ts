import { expect, it } from "vitest";
import { acceptResponse } from "../src/access-model.js";
it("ignores stale responses", () => { expect(acceptResponse(2, { id: 1, subject: "Ada", enabled: true })).toBeUndefined(); });
