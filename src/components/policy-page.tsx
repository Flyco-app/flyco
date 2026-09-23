import Link from 'next/link';
import type { Locale } from '@/lib/auth/validation';
import { policyCopy, prohibitedItemConcepts } from '@/modules/policy/config';

export function DraftNotice({ locale }: { locale: Locale }) {
  return (
    <p
      role="note"
      className="rounded-xl border border-warning/40 bg-warning/10 p-4"
    >
      {policyCopy[locale].draft}
    </p>
  );
}

export function SafetyContent({ locale }: { locale: Locale }) {
  const d = policyCopy[locale];
  return (
    <>
      <p>{d.safetyIntro}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {prohibitedItemConcepts.map((item) => (
          <li key={item.code} className="rounded-xl border p-3">
            {d[item.code]}
          </li>
        ))}
      </ul>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{d.customsTitle}</h2>
        <p>{d.customs}</p>
      </section>
    </>
  );
}

export function PolicyLinks({ locale }: { locale: Locale }) {
  const d = policyCopy[locale];
  return (
    <nav aria-label={d.help} className="flex flex-wrap gap-4">
      <Link href={`/${locale}/help`}>{d.help}</Link>
      <Link href={`/${locale}/safety`}>{d.safety}</Link>
      <Link href={`/${locale}/terms`}>{d.terms}</Link>
      <Link href={`/${locale}/privacy`}>{d.privacy}</Link>
    </nav>
  );
}
