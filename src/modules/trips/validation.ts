import { z } from 'zod';

export const tripIdSchema = z.uuid();
export const tripVersionSchema = z.coerce.number().int().positive();
export const locationIdSchema = z.uuid();
export const categoryCodeSchema = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/);
export const localDateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

export const capacityKgSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d?)(?:\.\d{1,3})?$/)
  .transform(capacityKgToGrams)
  .pipe(z.number().int().min(1).max(50_000));

export const tripFormSchema = z
  .object({
    originLocationId: locationIdSchema,
    destinationLocationId: locationIdSchema,
    departureLocal: localDateTimeSchema,
    arrivalLocal: localDateTimeSchema,
    capacityKg: capacityKgSchema,
    categoryCodes: z
      .array(categoryCodeSchema)
      .min(1)
      .max(10)
      .refine((codes) => new Set(codes).size === codes.length),
  })
  .refine(
    ({ originLocationId, destinationLocationId }) =>
      originLocationId !== destinationLocationId,
    { path: ['destinationLocationId'] },
  );

export const cancellationSchema = z.object({
  tripId: tripIdSchema,
  expectedVersion: tripVersionSchema,
  reason: z.string().trim().min(3).max(500),
});

export const transitionSchema = z.object({
  tripId: tripIdSchema,
  expectedVersion: tripVersionSchema,
});

export function capacityKgToGrams(value: string): number {
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
}

export function formatCapacity(grams: number, locale: string): string {
  if (grams < 1000) return `${new Intl.NumberFormat(locale).format(grams)} g`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(grams / 1000)} kg`;
}
