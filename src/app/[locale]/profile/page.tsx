import Link from 'next/link';
import { requireActiveAccount } from '@/lib/auth/session';
import { dictionaries } from '@/lib/auth/dictionaries';
import { safeLocale } from '@/lib/auth/validation';
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = safeLocale((await params).locale);
  const { profile, publicProfile, trust } = await requireActiveAccount(locale);
  const d = dictionaries[locale];
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{d.profile}</h1>
      <p className="text-lg font-medium">{publicProfile.display_name}</p>
      {publicProfile.bio && <p>{publicProfile.bio}</p>}
      <dl className="grid gap-2 rounded-xl border p-4">
        <dt className="font-semibold">{d.trust}</dt>
        <dd>
          {d.emailVerified}: {trust.email_verified ? '✓' : '—'}
        </dd>
        <dd>
          {d.phoneVerified}: {profile.phone_verified_at ? '✓' : '—'}
        </dd>
        <dd>
          {d.identityVerified}: {trust.identity_verified ? '✓' : '—'}
        </dd>
        <dd>
          {d.completed}: {trust.completed_deliveries}
        </dd>
        <dd>
          {d.reviews}: {trust.review_count}
        </dd>
      </dl>
      <Link href={`/${locale}/settings`}>{d.settings}</Link>
    </section>
  );
}
