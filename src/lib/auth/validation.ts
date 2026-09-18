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
});
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
