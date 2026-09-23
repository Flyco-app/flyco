'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/lib/auth/validation';
import { uiCopy } from '@/lib/ui/copy';
import { Icon, type IconName } from './ui/icon';
export function Navigation({ locale }: { locale: Locale }) {
  const path = usePathname();
  const d = uiCopy[locale];
  const links: { path: string; label: string; icon: IconName }[] = [
    { path: `/${locale}`, label: d.home, icon: 'home' },
    { path: `/${locale}/delivery-requests`, label: d.requests, icon: 'parcel' },
    { path: `/${locale}/trips`, label: d.trips, icon: 'plane' },
    { path: `/${locale}/bookings`, label: d.bookings, icon: 'booking' },
    { path: `/${locale}/profile`, label: d.account, icon: 'user' },
  ];
  return (
    <nav className="app-navigation" aria-label={d.navigation}>
      {links.map((link, i) => (
        <Link
          key={link.path}
          href={link.path}
          aria-current={
            (
              i === 0
                ? path === link.path
                : path.startsWith(link.path) ||
                  (i === 4 && path === `/${locale}/settings`)
            )
              ? 'page'
              : undefined
          }
        >
          <Icon name={link.icon} />
          <span>{link.label}</span>
        </Link>
      ))}
    </nav>
  );
}
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const path = usePathname();
  return (
    <nav className="language-switcher" aria-label={uiCopy[locale].language}>
      {(['fr', 'en', 'ar'] as const).map((language) => (
        <Link
          key={language}
          lang={language}
          href={path.replace(/^\/(fr|en|ar)(?=\/|$)/, `/${language}`)}
          aria-current={locale === language ? 'true' : undefined}
        >
          {language === 'ar' ? 'ع' : language.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
