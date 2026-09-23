import { describe, expect, it } from 'vitest';
import { uiCopy } from '@/lib/ui/copy';
import { verificationLabel } from '@/lib/ui/status';
describe('product localization', () => {
  it('provides every product string in French, English and Arabic', () => {
    for (const locale of ['fr', 'en', 'ar'] as const) {
      expect(Object.keys(uiCopy[locale]).sort()).toEqual(
        Object.keys(uiCopy.en).sort(),
      );
      expect(
        Object.values(uiCopy[locale]).every((value) => value.trim().length > 0),
      ).toBe(true);
    }
  });
  it('renders verification states without leaking raw unknown values', () => {
    for (const locale of ['fr', 'en', 'ar'] as const) {
      for (const state of [
        'pending',
        'requires_input',
        'under_review',
        'verified',
        'rejected',
        'expired',
        'revoked',
        'cancelled',
      ]) {
        expect(verificationLabel(locale, state)).toBeTruthy();
      }
      expect(verificationLabel(locale, 'internal_provider_error')).toBe(
        uiCopy[locale].not_started,
      );
    }
  });
});
