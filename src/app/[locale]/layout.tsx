import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dictionaries } from '@/lib/auth/dictionaries';
import { getVerifiedIdentity } from '@/lib/auth/session';
import { localeSchema } from '@/lib/auth/validation';
import { tripCopy } from '@/modules/trips/copy';
import { requestCopy } from '@/modules/delivery-requests/copy';
import { bookingCopy } from '@/modules/bookings/copy';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!localeSchema.safeParse(locale).success) notFound();
  const d = dictionaries[locale as keyof typeof dictionaries];
  const isAuthenticated = Boolean(await getVerifiedIdentity());
  const homeHref = isAuthenticated ? `/${locale}/profile` : `/${locale}`;
  return (
    <div
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="mx-auto min-h-svh max-w-lg space-y-5 px-6 py-12"
    >
      <nav className="flex flex-wrap items-center justify-between gap-3">
        <Link className="font-semibold" href={homeHref}>
          Flyco
        </Link>
        {isAuthenticated && (
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link href={`/${locale}/profile`}>{d.profile}</Link>
            <Link href={`/${locale}/settings`}>{d.settings}</Link>
            <Link href={`/${locale}/trips`}>
              {tripCopy[locale as keyof typeof tripCopy].myTrips}
            </Link>
            <Link href={`/${locale}/delivery-requests`}>
              {requestCopy[locale as keyof typeof requestCopy].myRequests}
            </Link>
            <Link href={`/${locale}/bookings`}>
              {bookingCopy[locale as keyof typeof bookingCopy].bookings}
            </Link>
          </span>
        )}
        <span className="flex gap-3 text-sm">
          <Link href="/fr">FR</Link>
          <Link href="/en">EN</Link>
          <Link href="/ar">AR</Link>
        </span>
      </nav>
      <main>{children}</main>
      <footer className="text-sm text-muted-foreground">{d.welcome}</footer>
    </div>
  );
}
