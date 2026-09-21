import { z } from 'zod';

export const normalizedLocationSchema = z.object({
  provider: z.string().regex(/^[a-z][a-z0-9_-]{1,39}$/),
  providerPlaceId: z.string().min(1).max(255),
  kind: z.enum([
    'city',
    'airport',
    'train_station',
    'port',
    'neighborhood',
    'pickup_point',
  ]),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  countryName: z.string().min(2).max(100),
  administrativeRegion: z.string().max(120).nullable(),
  cityName: z.string().min(1).max(120),
  citySlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  canonicalName: z.string().min(2).max(180),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().regex(/^[A-Za-z_]+(?:\/[A-Za-z_+-]+)+$/),
});
export type NormalizedLocation = z.infer<typeof normalizedLocationSchema>;

export interface GeocodingProvider {
  readonly name: string;
  search(
    query: string,
    countryCodes?: readonly string[],
  ): Promise<readonly NormalizedLocation[]>;
  resolve(placeId: string): Promise<NormalizedLocation | null>;
}

export class UnconfiguredGeocodingProvider implements GeocodingProvider {
  readonly name = 'unconfigured';
  async search(
    query: string,
    countryCodes?: readonly string[],
  ): Promise<readonly NormalizedLocation[]> {
    void query;
    void countryCodes;
    throw new Error('Geocoding provider is not configured.');
  }
  async resolve(placeId: string): Promise<NormalizedLocation | null> {
    void placeId;
    throw new Error('Geocoding provider is not configured.');
  }
}
