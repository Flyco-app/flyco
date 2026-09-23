import Link from 'next/link';
import { headers } from 'next/headers';
import { safeLocale } from '@/lib/auth/validation';
import { uiCopy } from '@/lib/ui/copy';
export default async function NotFound() {
  const locale = safeLocale((await headers()).get('x-flyco-locale') ?? 'fr');
  const d = uiCopy[locale];
  return (
    <main className="page-container">
      <section className="empty-state">
        <p className="eyebrow">Flyco · 404</p>
        <h1>{d.notFound}</h1>
        <p>{d.notFoundBody}</p>
        <Link className="button" href={`/${locale}`}>
          {d.home}
        </Link>
      </section>
    </main>
  );
}
