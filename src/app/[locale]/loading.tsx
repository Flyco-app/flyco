import { headers } from 'next/headers';
import { safeLocale } from '@/lib/auth/validation';
import { uiCopy } from '@/lib/ui/copy';
export default async function Loading() {
  const locale = safeLocale((await headers()).get('x-flyco-locale') ?? 'fr');
  return (
    <section role="status" aria-busy="true" className="space-y-5">
      <span className="sr-only">{uiCopy[locale].loading}</span>
      <div aria-hidden="true" className="skeleton h-10 w-2/3" />
      <div aria-hidden="true" className="skeleton h-48" />
      <div aria-hidden="true" className="skeleton h-48" />
    </section>
  );
}
