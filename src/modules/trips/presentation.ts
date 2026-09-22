import type { Locale } from '@/lib/auth/validation';

export function formatTripDate(
  value: string,
  timezone: string,
  locale: Locale,
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));
}
