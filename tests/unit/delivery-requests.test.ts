import { describe, expect, it } from 'vitest';
import {
  deliveryRequestFormSchema,
  formDimensionToMillimeters,
  formatDimension,
  formatWeight,
} from '@/modules/delivery-requests/validation';
import { validateItemPhoto } from '@/modules/delivery-requests/photo-validation';

const paris = '20000000-0000-4000-8000-000000000001';
const casablanca = '20000000-0000-4000-8000-000000000004';

const valid = {
  originLocationId: paris,
  destinationLocationId: casablanca,
  earliestDepartureLocal: '2026-11-10T09:30',
  latestDeliveryLocal: '2026-11-14T13:30',
  categoryCode: 'documents',
  title: 'Signed documents',
  description: 'A sealed envelope containing signed contracts.',
  declaredContents: 'Two signed paper contracts',
  weightKg: '1.250',
  lengthCm: '25.5',
  widthCm: '18',
  heightCm: '2.5',
  quantity: '1',
  fragile: false,
  handlingNotes: '',
};

describe('delivery request validation', () => {
  it('converts presentation units to exact integer persistence units', () => {
    const parsed = deliveryRequestFormSchema.parse(valid);
    expect(parsed.weightKg).toBe(1250);
    expect(parsed.lengthCm).toBe(255);
    expect(formDimensionToMillimeters(parsed.lengthCm)).toBe(255);
    expect(formatWeight(1250, 'en')).toBe('1.25 kg');
    expect(formatDimension(255, 'en')).toBe('25.5 cm');
  });

  it('accepts omitted dimensions only when all three are omitted', () => {
    expect(
      deliveryRequestFormSchema.safeParse({
        ...valid,
        lengthCm: '',
        widthCm: '',
        heightCm: '',
      }).success,
    ).toBe(true);
    expect(
      deliveryRequestFormSchema.safeParse({ ...valid, heightCm: '' }).success,
    ).toBe(false);
  });

  it('rejects identical locations, generic declarations and invalid measurements', () => {
    expect(
      deliveryRequestFormSchema.safeParse({
        ...valid,
        destinationLocationId: paris,
        declaredContents: 'package',
        weightKg: '50.001',
      }).success,
    ).toBe(false);
  });
});

describe('item photo validation', () => {
  it('accepts a matching allowlisted image signature', async () => {
    const file = new File(
      [Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])],
      'ignored-name.jpg',
      { type: 'image/jpeg' },
    );
    await expect(validateItemPhoto(file)).resolves.toBe(true);
  });

  it('rejects MIME spoofing and unsafe formats', async () => {
    const spoofed = new File([new TextEncoder().encode('<script>')], 'x.jpg', {
      type: 'image/jpeg',
    });
    const svg = new File([new TextEncoder().encode('<svg/>')], 'x.svg', {
      type: 'image/svg+xml',
    });
    await expect(validateItemPhoto(spoofed)).resolves.toBe(false);
    await expect(validateItemPhoto(svg)).resolves.toBe(false);
  });
});
