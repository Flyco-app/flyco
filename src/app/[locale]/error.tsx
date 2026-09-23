'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { safeLocale } from '@/lib/auth/validation';
import { uiCopy } from '@/lib/ui/copy';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const rawLocale = useParams().locale;
  const locale = safeLocale(typeof rawLocale === 'string' ? rawLocale : 'fr');
  const d = uiCopy[locale];
  return (
    <section className="empty-state">
      <h1>{d.errorTitle}</h1>
      <p role="alert">{d.errorBody}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button className="button" onClick={reset}>
          {d.retry}
        </button>
        <Link className="button button-secondary" href={`/${locale}`}>
          {d.home}
        </Link>
      </div>
    </section>
  );
}
