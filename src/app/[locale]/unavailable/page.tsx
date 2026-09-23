import { uiCopy } from '@/lib/ui/copy';
import { SubmitButton } from '@/components/ui/submit-button';
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
      <p role="alert">{uiCopy[locale].unavailable}</p>
      <form action={logOut}>
        <input type="hidden" name="locale" value={locale} />
        <SubmitButton locale={locale} type="submit">
          {d.logout}
        </SubmitButton>
      </form>
    </section>
  );
}
