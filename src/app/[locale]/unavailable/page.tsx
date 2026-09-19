import { logOut } from '@/lib/auth/actions';
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
    <section className="space-y-4">
      <p role="alert">This account is unavailable. Contact support.</p>
      <form action={logOut}>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit">{d.logout}</button>
      </form>
    </section>
  );
}
