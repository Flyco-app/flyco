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
          Invalid or expired confirmation
        </h1>
        <Link href="/fr/login">Return to sign in</Link>
      </main>
    );
  const destination = confirmationDestination(
    parsed.data.type,
    parsed.data.next,
  );
  return (
    <main className="mx-auto max-w-lg space-y-5 p-8">
      <h1 className="text-2xl font-semibold">Continue with Flyco</h1>
      <p>Confirm this single-use authentication request.</p>
      <form action={confirmEmailToken}>
        <input type="hidden" name="token_hash" value={parsed.data.token_hash} />
        <input type="hidden" name="type" value={parsed.data.type} />
        <input type="hidden" name="next" value={destination.path} />
        <button className="button" type="submit">
          Continue securely
        </button>
      </form>
    </main>
  );
}
