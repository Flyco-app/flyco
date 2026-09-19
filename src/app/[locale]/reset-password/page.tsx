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
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{d.reset}</h1>
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
        <button className="button" type="submit">
          {d.reset}
        </button>
      </form>
    </section>
  );
}
