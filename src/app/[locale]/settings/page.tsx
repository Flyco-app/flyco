import Link from 'next/link';
import { changeEmail, logOut, updateProfile } from '@/lib/auth/actions';
import { requireActiveAccount } from '@/lib/auth/session';
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
  const { profile, user } = await requireActiveAccount(locale);
  const d = dictionaries[locale];
  const { error, notice } = await searchParams;
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">{d.settings}</h1>
      {error && <p role="alert">{d.genericError}</p>}
      {notice && <p role="status">{d.save}</p>}
      <p>{user.email}</p>
      <form action={updateProfile} className="grid gap-4">
        <label>
          {d.name}
          <input
            className="field"
            name="displayName"
            defaultValue={profile.display_name}
            minLength={2}
            maxLength={80}
            required
          />
        </label>
        <label>
          {d.language}
          <select className="field" name="locale" defaultValue={profile.locale}>
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>
        <button className="button" type="submit">
          {d.save}
        </button>
      </form>
      <form action={changeEmail} className="grid gap-4">
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
        <button className="button" type="submit">
          {d.email}
        </button>
      </form>
      <Link href={`/${locale}/reset-password`}>{d.reset}</Link>
      <form action={logOut}>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit">{d.logout}</button>
      </form>
    </section>
  );
}
