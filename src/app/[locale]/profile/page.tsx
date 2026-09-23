import { TrustPanel } from '@/components/ui/trust-panel';
import { AvatarImage } from '@/lib/profile/avatar-image';
import { getServerEnv } from '@/lib/env/server';
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
  const { SUPABASE_URL } = getServerEnv();
  const avatarUrl =
    publicProfile.avatar_path && SUPABASE_URL
      ? `${SUPABASE_URL}/storage/v1/object/public/avatars/${publicProfile.avatar_path}`
      : null;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{d.profile}</h1>
      <div className="profile-heading">
        {avatarUrl ? (
          <AvatarImage src={avatarUrl} alt={publicProfile.display_name} />
        ) : (
          <span className="avatar-placeholder" aria-hidden="true">
            {publicProfile.display_name.slice(0, 1)}
          </span>
        )}
        <p className="text-lg font-medium">{publicProfile.display_name}</p>
      </div>
      {publicProfile.bio && <p>{publicProfile.bio}</p>}
      <TrustPanel
        locale={locale}
        email={trust.email_verified}
        phone={Boolean(profile.phone_verified_at)}
        identity={trust.identity_verified}
        completed={trust.completed_deliveries}
        reviews={trust.review_count}
        memberSince={publicProfile.created_at}
      />
      <Link className="button button-secondary" href={`/${locale}/settings`}>
        {d.settings}
      </Link>
    </section>
  );
}
