import { z } from 'zod';

export const conversationIdSchema = z.uuid();
export const messageSchema = z.object({
  conversationId: conversationIdSchema,
  body: z.string().trim().min(1).max(2000),
});
export const reportReasonSchema = z.enum([
  'harassment',
  'suspicious_behavior',
  'prohibited_item',
  'scam_fraud',
  'unsafe_conduct',
  'inappropriate_content',
  'other',
]);
export const reportSchema = z.object({
  bookingId: z.uuid(),
  conversationId: conversationIdSchema,
  reportedUserId: z.uuid(),
  reportedMessageId: z
    .union([z.uuid(), z.literal('')])
    .transform((v) => v || null),
  reason: reportReasonSchema,
  description: z.string().trim().min(10).max(2000),
});
