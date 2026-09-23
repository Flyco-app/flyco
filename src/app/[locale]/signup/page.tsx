import Link from 'next/link';
import { uiCopy } from '@/lib/ui/copy';
import { SubmitButton } from '@/components/ui/submit-button';
import { signUp } from '@/lib/auth/actions';
import { dictionaries } from '@/lib/auth/dictionaries';
import { safeLocale } from '@/lib/auth/validation';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const locale = safeLocale((await params).locale);
  const d = dictionaries[locale];
  const { error } = await searchParams;
  return (
    <section className="auth-panel space-y-5">
      <p className="auth-kicker">{uiCopy[locale].authIntro}</p>
      <h1 className="text-2xl font-semibold">{d.signup}</h1>
      <p>{uiCopy[locale].signupHint}</p>
      {error && <p role="alert">{d.genericError}</p>}
      <form action={signUp} className="grid gap-4">
        <input type="hidden" name="locale" value={locale} />
        <label>
          {d.name}
          <input
            className="field"
            name="displayName"
            minLength={2}
            maxLength={80}
            required
            autoComplete="name"
          />
        </label>
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
            aria-describedby="password-help"
            minLength={12}
            required
            autoComplete="new-password"
          />
        </label>
        <SubmitButton locale={locale} className="button" type="submit">
          {d.signup}
        </SubmitButton>
      </form>
      <p id="password-help" className="text-sm">
        {uiCopy[locale].passwordHint}
      </p>
      <p className="auth-switch">
        {uiCopy[locale].already}{' '}
        <Link href={`/${locale}/login`}>{d.login}</Link>
      </p>
    </section>
  );
}
