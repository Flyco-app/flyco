import { describe, expect, it } from 'vitest';
import {
  messageSchema,
  reportSchema,
  reportReasonSchema,
} from '@/modules/messaging/validation';

const id = '11111111-1111-4111-8111-111111111111';
describe('messaging boundaries', () => {
  it('accepts plain text and preserves script-like input as text data', () => {
    expect(
      messageSchema.parse({
        conversationId: id,
        body: '<script>alert(1)</script>',
      }).body,
    ).toBe('<script>alert(1)</script>');
  });
  it('rejects empty and oversized messages', () => {
    expect(
      messageSchema.safeParse({ conversationId: id, body: '   ' }).success,
    ).toBe(false);
    expect(
      messageSchema.safeParse({ conversationId: id, body: 'x'.repeat(2001) })
        .success,
    ).toBe(false);
  });
  it('uses normalized report reasons and meaningful evidence notes', () => {
    expect(reportReasonSchema.safeParse('harassment').success).toBe(true);
    expect(reportReasonSchema.safeParse('custom').success).toBe(false);
    expect(
      reportSchema.safeParse({
        bookingId: id,
        conversationId: id,
        reportedUserId: id,
        reportedMessageId: '',
        reason: 'other',
        description: 'too short',
      }).success,
    ).toBe(false);
  });
});
