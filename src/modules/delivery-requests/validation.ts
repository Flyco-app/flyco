import { z } from 'zod';

export const deliveryRequestIdSchema = z.uuid();
export const itemPhotoIdSchema = z.uuid();
export const deliveryRequestVersionSchema = z.coerce.number().int().positive();
const locationIdSchema = z.uuid();
const categoryCodeSchema = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/);
const localDateTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

function decimalToInteger(value: string, scale: number): number {
  const [whole, fraction = ''] = value.split('.');
  return (
    Number(whole) * scale + Number(fraction.padEnd(Math.log10(scale), '0'))
  );
}

export const weightKgSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d?)(?:\.\d{1,3})?$/)
  .transform((value) => decimalToInteger(value, 1000))
  .pipe(z.number().int().min(1).max(50_000));

const dimensionCmSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d{0,2})(?:\.\d)?$/)
  .transform((value) => decimalToInteger(value, 10))
  .pipe(z.number().int().min(1).max(2000));

const optionalDimension = z.union([z.literal(''), dimensionCmSchema]);

export const deliveryRequestFormSchema = z
  .object({
    originLocationId: locationIdSchema,
    destinationLocationId: locationIdSchema,
    earliestDepartureLocal: localDateTimeSchema,
    latestDeliveryLocal: localDateTimeSchema,
    categoryCode: categoryCodeSchema,
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(20).max(2000),
    declaredContents: z
      .string()
      .trim()
      .min(10)
      .max(1000)
      .refine(
        (value) =>
          !/^(?:stuff|things|package|parcel|misc|divers|colis)$/i.test(value),
      ),
    weightKg: weightKgSchema,
    lengthCm: optionalDimension,
    widthCm: optionalDimension,
    heightCm: optionalDimension,
    quantity: z.coerce.number().int().min(1).max(100),
    fragile: z.boolean(),
    handlingNotes: z.string().trim().min(3).max(1000).or(z.literal('')),
  })
  .refine((value) => value.originLocationId !== value.destinationLocationId, {
    path: ['destinationLocationId'],
  })
  .refine(
    (value) => {
      const dimensions = [value.lengthCm, value.widthCm, value.heightCm];
      return (
        dimensions.every((part) => part === '') ||
        dimensions.every((part) => part !== '')
      );
    },
    { path: ['lengthCm'] },
  );

export const deliveryRequestTransitionSchema = z.object({
  requestId: deliveryRequestIdSchema,
  expectedVersion: deliveryRequestVersionSchema,
});

export const deliveryRequestCancellationSchema =
  deliveryRequestTransitionSchema.extend({
    reason: z.string().trim().min(3).max(500),
  });

export const itemPhotoMutationSchema = deliveryRequestTransitionSchema.extend({
  photoId: itemPhotoIdSchema,
});

export function formatWeight(grams: number, locale: string): string {
  if (grams < 1000) return `${new Intl.NumberFormat(locale).format(grams)} g`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(grams / 1000)} kg`;
}

export function formatDimension(millimeters: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(millimeters / 10)} cm`;
}

export function formDimensionToMillimeters(value: number | ''): number | null {
  return value === '' ? null : value;
}
