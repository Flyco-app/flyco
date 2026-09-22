import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import { phoneMatchesCountry, profileSchema } from '@/lib/auth/validation';
import {
  avatarMaxBytes,
  hasValidAvatarSignature,
  validateAvatar,
} from '@/lib/profile/avatar';
import {
  normalizedLocationSchema,
  UnconfiguredGeocodingProvider,
} from '@/lib/locations/provider';

describe('Phase 1B profile boundaries', () => {
  it('normalizes optional profile fields and accepts a canonical location id', () => {
    expect(
      profileSchema.parse({
        displayName: '  Member  ',
        locale: 'fr',
        firstName: '',
        lastName: 'Doe',
        phone: '+33612345678',
        bio: '  Hello  ',
        residenceLocationId: '20000000-0000-4000-8000-000000000001',
      }),
    ).toMatchObject({
      displayName: 'Member',
      firstName: null,
      lastName: 'Doe',
      bio: 'Hello',
    });
  });

  it('rejects invalid location and phone payloads', () => {
    expect(
      profileSchema.safeParse({
        displayName: 'Member',
        locale: 'fr',
        firstName: '',
        lastName: '',
        phone: '0612345678',
        bio: '',
        residenceLocationId: 'Paris',
      }).success,
    ).toBe(false);
    expect(phoneMatchesCountry('+212612345678', 'FR')).toBe(false);
    expect(phoneMatchesCountry('+33612345678', 'FR')).toBe(true);
  });

  it('validates size, MIME and magic bytes rather than filenames', async () => {
    const signature = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ]);
    const png = new File([signature], 'payload.exe', { type: 'image/png' });
    const metadata = validateAvatar(png);
    expect(metadata).toEqual({ mime: 'image/png', extension: 'png' });
    expect(await hasValidAvatarSignature(png, 'image/png')).toBe(true);
    expect(
      validateAvatar(new File(['x'], 'x.svg', { type: 'image/svg+xml' })),
    ).toBeNull();

    const atLimit = new File(
      [signature, new Uint8Array(avatarMaxBytes - signature.byteLength)],
      'at-limit.png',
      { type: 'image/png' },
    );
    const overLimit = new File(
      [signature, new Uint8Array(avatarMaxBytes + 1 - signature.byteLength)],
      'over-limit.png',
      { type: 'image/png' },
    );
    expect(validateAvatar(atLimit)).toEqual({
      mime: 'image/png',
      extension: 'png',
    });
    expect(validateAvatar(overLimit)).toBeNull();
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe(
      avatarMaxBytes + 128 * 1024,
    );
  });

  it('validates provider-neutral locations and fails explicitly without a provider', async () => {
    expect(
      normalizedLocationSchema.safeParse({
        provider: 'local',
        providerPlaceId: 'paris',
        kind: 'city',
        countryCode: 'FR',
        countryName: 'France',
        administrativeRegion: null,
        cityName: 'Paris',
        citySlug: 'paris',
        canonicalName: 'Paris, France',
        latitude: 48.8,
        longitude: 2.3,
        timezone: 'Europe/Paris',
      }).success,
    ).toBe(true);
    await expect(
      new UnconfiguredGeocodingProvider().search('Paris'),
    ).rejects.toThrow('not configured');
  });
});
