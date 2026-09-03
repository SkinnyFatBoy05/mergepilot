import { z } from "zod";
import { actorSchema, schemaVersionSchema, sha256Schema, timestampSchema, uuidSchema } from "./domain.js";

export const auditEventInputSchema = z.object({
  schemaVersion: schemaVersionSchema,
  id: uuidSchema,
  taskId: uuidSchema,
  sequence: z.number().int().positive(),
  taskVersion: z.number().int().nonnegative(),
  type: z.string().regex(/^[a-z]+(?:\.[a-z]+)+$/),
  actor: actorSchema,
  payloadHash: sha256Schema,
  createdAt: timestampSchema,
});
export type AuditEventInput = z.infer<typeof auditEventInputSchema>;

export const auditEventSchema = auditEventInputSchema.extend({
  previousHash: sha256Schema.nullable(),
  hash: sha256Schema,
});
export type AuditEvent = z.infer<typeof auditEventSchema>;
