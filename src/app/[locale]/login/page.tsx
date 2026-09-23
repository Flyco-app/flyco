import { uiCopy } from '@/lib/ui/copy';
import { SubmitButton } from '@/components/ui/submit-button';
import Link from 'next/link';
import { logIn } from '@/lib/auth/actions';
import { dictionaries } from '@/lib/auth/dictionaries';
import { safeLocale } from '@/lib/auth/validation';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const locale = safeLocale((await params).locale);
  const d = dictionaries[locale];
  const { error, notice } = await searchParams;
  return (
    <section className="auth-panel space-y-5">
      <p className="auth-kicker">{uiCopy[locale].authIntro}</p>
      <h1 className="text-2xl font-semibold">{d.login}</h1>
      <p>{uiCopy[locale].loginHint}</p>
      {error && <p role="alert">{d.genericError}</p>}
      {notice && <p role="status">{d.checkEmail}</p>}
      <form action={logIn} className="grid gap-4">
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
        <label>
          {d.password}
          <input
            className="field"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        <SubmitButton locale={locale} className="button" type="submit">
          {d.login}
        </SubmitButton>
      </form>
      <Link href={`/${locale}/reset-password`}>{d.reset}</Link>
      <p className="auth-switch">
        {uiCopy[locale].newMember}{' '}
        <Link href={`/${locale}/signup`}>{d.signup}</Link>
      </p>
    </section>
  );
}
