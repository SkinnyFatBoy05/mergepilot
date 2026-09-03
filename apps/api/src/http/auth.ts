import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

function equalSecret(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function requireAdmin(adminToken: string) {
  if (!adminToken) throw new Error("MERGEPILOT_ADMIN_TOKEN must not be empty");
  return async function adminGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const expected = `Bearer ${adminToken}`;
    if (!request.headers.authorization || !equalSecret(request.headers.authorization, expected)) {
      await reply.code(401).type("application/problem+json").send({
        type: "https://mergepilot.dev/problems/unauthorized",
        title: "Authentication required",
        status: 401,
        detail: "A valid bearer token is required for mutations.",
      });
    }
  };
}
