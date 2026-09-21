import { z } from 'zod';

export const locales = ['fr', 'en', 'ar'] as const;
export const localeSchema = z.enum(locales);
export type Locale = z.infer<typeof localeSchema>;
export const emailSchema = z
  .email()
  .max(254)
  .transform((s) => s.trim().toLowerCase());
export const passwordSchema = z.string().min(12).max(128);
export const displayNameSchema = z.string().trim().min(2).max(80);
const optionalNameSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().min(1).max(80).nullable().default(null),
);
const optionalBioSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().max(500).nullable().default(null),
);
const phoneSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/)
    .nullable()
    .default(null),
);
const locationIdSchema = z.preprocess(
  (value) => (typeof value === 'string' && value === '' ? null : value),
  z.uuid().nullable().default(null),
);
export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  locale: localeSchema,
});
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  locale: localeSchema,
});
export const profileSchema = z.object({
  displayName: displayNameSchema,
  locale: localeSchema,
  firstName: optionalNameSchema,
  lastName: optionalNameSchema,
  phone: phoneSchema,
  bio: optionalBioSchema,
  residenceLocationId: locationIdSchema,
});

export function phoneMatchesCountry(
  phone: string | null,
  countryCode: string | null,
): boolean {
  if (!phone || !countryCode) return true;
  return (
    (countryCode === 'FR' && phone.startsWith('+33')) ||
    (countryCode === 'MA' && phone.startsWith('+212'))
  );
}
export const resetRequestSchema = z.object({
  email: emailSchema,
  locale: localeSchema,
});
export const changePasswordSchema = z.object({
  password: passwordSchema,
  locale: localeSchema,
});
export function safeLocale(input: string): Locale {
  return localeSchema.catch('fr').parse(input);
}
export function safeReturnPath(value: string | null, locale: Locale): string {
  if (!value || !/^\/(fr|en|ar)\/(profile|settings)$/.test(value))
    return `/${locale}/profile`;
  return value;
}
