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
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{d.login}</h1>
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
        <button className="button" type="submit">
          {d.login}
        </button>
      </form>
      <Link href={`/${locale}/reset-password`}>{d.reset}</Link>
    </section>
  );
}
