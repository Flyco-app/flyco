import { getServerEnv } from '@/lib/env/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dictionaries } from '@/lib/auth/dictionaries';
import { getVerifiedIdentity } from '@/lib/auth/session';
import { localeSchema } from '@/lib/auth/validation';
import { uiCopy } from '@/lib/ui/copy';
import { LanguageSwitcher, Navigation } from '@/components/navigation';
import { Icon } from '@/components/ui/icon';
import { PolicyLinks } from '@/components/policy-page';
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const parsed = localeSchema.safeParse((await params).locale);
  if (!parsed.success) notFound();
  const locale = parsed.data;
  const configured = Boolean(getServerEnv().SUPABASE_URL);
  const authenticated = configured && Boolean(await getVerifiedIdentity());
  const d = uiCopy[locale];
  return (
    <div
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={authenticated ? 'app-shell is-authenticated' : 'app-shell'}
    >
      <a className="skip-link" href="#main-content">
        {d.skip}
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href={`/${locale}`} aria-label="Flyco">
            <span className="brand-mark">
              <Icon name="plane" />
            </span>
            flyco<span className="brand-dot">.</span>
          </Link>
          {authenticated && <Navigation locale={locale} />}
          <div className="header-tools">
            <LanguageSwitcher locale={locale} />
            {!authenticated && (
              <Link
                className="button button-secondary"
                href={`/${locale}/login`}
              >
                {dictionaries[locale].login}
              </Link>
            )}
          </div>
        </div>
      </header>
      <main id="main-content" className="page-container" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <Link className="brand" href={`/${locale}`}>
          flyco.
        </Link>
        <p>{d.footer}</p>
        <PolicyLinks locale={locale} />
        <p className="preview-note">{d.stage}</p>
      </footer>
    </div>
  );
}
