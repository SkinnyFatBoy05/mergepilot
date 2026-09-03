import { expect, it } from "vitest";
import { EntitlementStore } from "../src/entitlements.js";
it("keeps one grant per stable request", () => { const store = new EntitlementStore(); store.grant({ requestId: "r1", subject: "u1", capability: "read" }); store.grant({ requestId: "r1", subject: "u1", capability: "read" }); expect(store.grants.size).toBe(1); });
