import { z } from 'zod';

export const bookingIdSchema = z.uuid();
export const bookingVersionSchema = z.coerce.number().int().positive();
export const idempotencyKeySchema = z.uuid();

export const bookingCommandSchema = z.object({
  bookingId: bookingIdSchema,
  expectedVersion: bookingVersionSchema,
  idempotencyKey: idempotencyKeySchema,
});

export const bookingCancellationSchema = bookingCommandSchema.extend({
  reason: z.string().trim().min(3).max(240),
});

export const proposalSchema = z.object({
  matchId: z.uuid(),
  idempotencyKey: idempotencyKeySchema,
});
