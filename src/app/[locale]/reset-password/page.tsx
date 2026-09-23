import Link from 'next/link';
import { uiCopy } from '@/lib/ui/copy';
import { SubmitButton } from '@/components/ui/submit-button';
import { requestPasswordReset } from '@/lib/auth/actions';
import { dictionaries } from '@/lib/auth/dictionaries';
import { safeLocale } from '@/lib/auth/validation';
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = safeLocale((await params).locale);
  const d = dictionaries[locale];
  return (
    <section className="auth-panel space-y-5">
      <p className="auth-kicker">{uiCopy[locale].authIntro}</p>
      <h1 className="text-2xl font-semibold">{d.reset}</h1>
      <p>{uiCopy[locale].resetHint}</p>
      <form action={requestPasswordReset} className="grid gap-4">
        <input type="hidden" name="locale" value={locale} />
        <label>
          {d.email}
          <input
            className="field"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </label>
        <SubmitButton locale={locale} className="button" type="submit">
          {d.reset}
        </SubmitButton>
      </form>
      <p className="auth-switch">
        {uiCopy[locale].backLogin}{' '}
        <Link href={`/${locale}/login`}>{d.login}</Link>
      </p>
    </section>
  );
}
