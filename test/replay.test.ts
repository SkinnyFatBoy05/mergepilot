import { expect, it } from "vitest";
import { buildPublicReplay } from "../scripts/build-replay.js";
it("removes prompts and secrets from public replay", () => { const replay = buildPublicReplay({ prompts: ["secret"], output: "api_key=sk-private" }); const text = JSON.stringify(replay); expect(text).not.toContain("sk-private"); expect(text).not.toContain("prompts"); });
