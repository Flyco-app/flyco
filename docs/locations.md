# Locations

Phase 1B uses `public.locations` as the canonical, provider-neutral location catalog. Marketplace records will reference `locations.id`; they will not copy uncontrolled origin or destination strings. A location stores its kind, ISO country code, country/city/region labels, stable city slug, canonical display name, decimal coordinates and IANA timezone. The schema supports several transport-place kinds, while Phase 1B seeds only the initial France/Morocco cities.

Everyone may read active catalog rows. Members cannot mutate them. Profile input accepts only an existing active UUID, and the server validates the row before mutation. Provider identifiers live separately in `private.location_provider_references`, so changing geocoders does not change Flyco identifiers.

`GeocodingProvider` returns a Zod-validated `NormalizedLocation`. The default adapter fails explicitly because no paid provider is configured. A future adapter should cache successful resolutions by provider/place ID and search query with bounded TTLs, and distinguish unavailable, rate-limited, invalid and no-result errors without exposing keys.
