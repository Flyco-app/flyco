import { DraftNotice } from '@/components/policy-page';
import { safeLocale } from '@/lib/auth/validation';
import { policyCopy } from '@/modules/policy/config';
export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = safeLocale((await params).locale);
  const d = policyCopy[locale];
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-semibold">{d.termsTitle}</h1>
      <DraftNotice locale={locale} />
      <p>{d.termsBody}</p>
    </article>
  );
}
