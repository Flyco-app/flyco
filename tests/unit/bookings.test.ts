import { describe, expect, it } from 'vitest';
import {
  bookingCancellationSchema,
  bookingCommandSchema,
  proposalSchema,
} from '@/modules/bookings/validation';
import { bookingStatusLabel } from '@/modules/bookings/copy';

describe('booking boundary', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  it('accepts UUID-backed proposal and transition commands', () => {
    expect(
      proposalSchema.safeParse({ matchId: id, idempotencyKey: id }).success,
    ).toBe(true);
    expect(
      bookingCommandSchema.safeParse({
        bookingId: id,
        expectedVersion: '2',
        idempotencyKey: id,
      }).success,
    ).toBe(true);
  });
  it('rejects weak cancellation reasons and invalid versions', () => {
    expect(
      bookingCancellationSchema.safeParse({
        bookingId: id,
        expectedVersion: 0,
        idempotencyKey: id,
        reason: 'x',
      }).success,
    ).toBe(false);
  });
  it('provides localized status labels', () => {
    expect(bookingStatusLabel('fr', 'accepted')).toBe('Acceptée');
    expect(bookingStatusLabel('ar', 'cancelled')).toBe('ملغى');
  });
});
