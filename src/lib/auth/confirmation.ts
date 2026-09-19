import { z } from 'zod';
import type { Locale } from './validation';

export const emailOtpTypeSchema = z.enum([
  'signup',
  'recovery',
  'email_change',
]);
export const tokenHashSchema = z.string().regex(/^[A-Za-z0-9_-]{20,512}$/);
export const confirmationSchema = z.object({
  token_hash: tokenHashSchema,
  type: emailOtpTypeSchema,
  next: z.string().max(128).optional(),
});

export function confirmationDestination(
  type: z.infer<typeof emailOtpTypeSchema>,
  next: string | undefined,
): { locale: Locale; path: string } {
  const locale = next?.match(/^\/(fr|en|ar)\//)?.[1] as Locale | undefined;
  const safeLocale = locale ?? 'fr';
  const defaults =
    type === 'recovery'
      ? `/${safeLocale}/new-password`
      : type === 'email_change'
        ? `/${safeLocale}/settings`
        : `/${safeLocale}/profile`;
  const allowed =
    type === 'recovery'
      ? /^\/(fr|en|ar)\/new-password$/
      : type === 'email_change'
        ? /^\/(fr|en|ar)\/settings$/
        : /^\/(fr|en|ar)\/profile$/;
  return {
    locale: safeLocale,
    path: next && allowed.test(next) ? next : defaults,
  };
}
