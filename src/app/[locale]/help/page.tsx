import Link from 'next/link';
import { SafetyContent } from '@/components/policy-page';
import { safeLocale } from '@/lib/auth/validation';
import { policyCopy } from '@/modules/policy/config';
export default async function HelpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = safeLocale((await params).locale);
  const d = policyCopy[locale];
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{d.helpTitle}</h1>
        <p>{d.helpIntro}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link className="rounded-xl border p-4" href={`/${locale}/settings`}>
          {d.accountHelp}
        </Link>
        <Link className="rounded-xl border p-4" href={`/${locale}/bookings`}>
          {d.bookingHelp}
        </Link>
      </div>
      <SafetyContent locale={locale} />
      <section className="space-y-2 rounded-xl border p-4">
        <h2 className="font-semibold">{d.contact}</h2>
        <p>{d.contactPending}</p>
      </section>
    </article>
  );
}
