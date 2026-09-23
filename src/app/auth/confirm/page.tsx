import { uiCopy } from '@/lib/ui/copy';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  confirmationDestination,
  confirmationSchema,
} from '@/lib/auth/confirmation';
import Link from 'next/link';
import { confirmEmailToken } from './actions';
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const parsed = confirmationSchema.safeParse({
    token_hash: query.token_hash,
    type: query.type,
    next: query.next,
  });
  if (!parsed.success)
    return (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-2xl font-semibold">
          {uiCopy.fr.invalidConfirmation}
        </h1>
        <Link href="/fr/login">{uiCopy.fr.backLogin}</Link>
      </main>
    );
  const destination = confirmationDestination(
    parsed.data.type,
    parsed.data.next,
  );
  const locale = destination.locale;
  const d = uiCopy[locale];
  return (
    <main
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="auth-panel mx-auto my-12 space-y-5"
    >
      <h1 className="text-2xl font-semibold">{d.confirmTitle}</h1>
      <p>{d.confirmBody}</p>
      <form action={confirmEmailToken}>
        <input type="hidden" name="token_hash" value={parsed.data.token_hash} />
        <input type="hidden" name="type" value={parsed.data.type} />
        <input type="hidden" name="next" value={destination.path} />
        <SubmitButton locale={locale}>{d.confirmAction}</SubmitButton>
      </form>
    </main>
  );
}
