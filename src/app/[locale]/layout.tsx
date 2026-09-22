import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dictionaries } from '@/lib/auth/dictionaries';
import { localeSchema } from '@/lib/auth/validation';
import { tripCopy } from '@/modules/trips/copy';

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
  return (
    <div
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="mx-auto min-h-svh max-w-lg space-y-5 px-6 py-12"
    >
      <nav className="flex items-center justify-between">
        <Link className="font-semibold" href={`/${locale}`}>
          Flyco
        </Link>
        <Link href={`/${locale}/trips`}>
          {tripCopy[locale as keyof typeof tripCopy].myTrips}
        </Link>
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
