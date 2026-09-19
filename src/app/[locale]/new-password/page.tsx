import { changePassword } from '@/lib/auth/actions';
import { getVerifiedIdentity } from '@/lib/auth/session';
import { dictionaries } from '@/lib/auth/dictionaries';
import { safeLocale } from '@/lib/auth/validation';
import { redirect } from 'next/navigation';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const locale = safeLocale((await params).locale);
  const d = dictionaries[locale];
  if (!(await getVerifiedIdentity())) redirect(`/${locale}/login`);
  const { error } = await searchParams;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{d.newPassword}</h1>
      {error && <p role="alert">{d.genericError}</p>}
      <form action={changePassword} className="grid gap-4">
        <input type="hidden" name="locale" value={locale} />
        <label>
          {d.newPassword}
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
          {d.save}
        </button>
      </form>
    </section>
  );
}
