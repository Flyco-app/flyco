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
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{d.signup}</h1>
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
            minLength={12}
            required
            autoComplete="new-password"
          />
        </label>
        <button className="button" type="submit">
          {d.signup}
        </button>
      </form>
    </section>
  );
}
