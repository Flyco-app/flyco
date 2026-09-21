import { describe, expect, it } from 'vitest';
import {
  emailSchema,
  profileSchema,
  safeLocale,
  safeReturnPath,
  signUpSchema,
} from '@/lib/auth/validation';

describe('Auth boundary validation', () => {
  it('normalizes email and rejects weak credentials', () => {
    expect(emailSchema.parse('USER@EXAMPLE.COM')).toBe('user@example.com');
    expect(
      signUpSchema.safeParse({
        email: 'a@example.com',
        password: 'short',
        displayName: 'Alice',
        locale: 'fr',
      }).success,
    ).toBe(false);
  });
  it('uses a safe default locale for untrusted route input', () => {
    expect(safeLocale('ar')).toBe('ar');
    expect(safeLocale('unexpected')).toBe('fr');
  });
  it('only accepts allowed same-origin return routes', () => {
    expect(safeReturnPath('/en/settings', 'en')).toBe('/en/settings');
    for (const value of [
      '//evil.test',
      '/%5c/evil.test',
      'https://evil.test',
      '/admin',
      '/fr/profile?next=//evil.test',
    ])
      expect(safeReturnPath(value, 'fr')).toBe('/fr/profile');
  });
  it('cannot edit account status or id via profile validation', () => {
    expect(
      profileSchema.parse({
        displayName: ' Alice ',
        locale: 'ar',
        account_status: 'active',
        id: 'forged',
      }),
    ).toEqual({
      displayName: 'Alice',
      locale: 'ar',
      firstName: null,
      lastName: null,
      phone: null,
      bio: null,
      residenceLocationId: null,
    });
  });
});
