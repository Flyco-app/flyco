import { describe, expect, it } from 'vitest';
import {
  capacityKgToGrams,
  formatCapacity,
  tripFormSchema,
} from '@/modules/trips/validation';
import {
  localDateTimeToUtc,
  utcToLocalDateTime,
} from '@/modules/trips/timezone';

const paris = '20000000-0000-4000-8000-000000000001';
const casablanca = '20000000-0000-4000-8000-000000000004';

describe('trip input validation', () => {
  it('converts decimal kilogram strings to integer grams', () => {
    expect(capacityKgToGrams('5')).toBe(5000);
    expect(capacityKgToGrams('0.125')).toBe(125);
    expect(formatCapacity(5000, 'en')).toBe('5 kg');
    expect(formatCapacity(750, 'fr')).toBe('750 g');
  });

  it('accepts normalized locations and unique stable category codes', () => {
    expect(
      tripFormSchema.safeParse({
        originLocationId: paris,
        destinationLocationId: casablanca,
        departureLocal: '2026-11-10T09:30',
        arrivalLocal: '2026-11-10T13:30',
        capacityKg: '5.250',
        categoryCodes: ['documents', 'clothing'],
      }).success,
    ).toBe(true);
  });

  it('rejects identical endpoints, duplicate categories and invalid capacity', () => {
    const base = {
      originLocationId: paris,
      destinationLocationId: paris,
      departureLocal: '2026-11-10T09:30',
      arrivalLocal: '2026-11-10T13:30',
      capacityKg: '50.001',
      categoryCodes: ['documents', 'documents'],
    };
    expect(tripFormSchema.safeParse(base).success).toBe(false);
  });
});

describe('trip timezone conversion', () => {
  it('converts a city-local time to UTC and back', () => {
    const utc = localDateTimeToUtc('2026-07-15T14:30', 'Europe/Paris');
    expect(utc).toBe('2026-07-15T12:30:00.000Z');
    expect(utcToLocalDateTime(utc, 'Europe/Paris')).toBe('2026-07-15T14:30');
  });

  it('rejects missing and ambiguous DST wall times', () => {
    expect(() =>
      localDateTimeToUtc('2026-03-29T02:30', 'Europe/Paris'),
    ).toThrow(/missing or ambiguous/);
    expect(() =>
      localDateTimeToUtc('2026-10-25T02:30', 'Europe/Paris'),
    ).toThrow(/missing or ambiguous/);
  });
});
