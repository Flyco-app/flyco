import type { Locale } from '@/lib/auth/validation';
import { uiCopy } from './copy';
export function verificationLabel(locale: Locale, state: unknown): string {
  const d = uiCopy[locale];
  switch (state) {
    case 'pending':
      return d.pendingVerification;
    case 'requires_input':
      return d.requires_input;
    case 'under_review':
      return d.under_review;
    case 'verified':
      return d.verified;
    case 'rejected':
      return d.rejected;
    case 'expired':
      return d.expired;
    case 'revoked':
      return d.revoked;
    case 'cancelled':
      return d.cancelled;
    default:
      return d.not_started;
  }
}
