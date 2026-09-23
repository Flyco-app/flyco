import { TrustPanel } from '@/components/ui/trust-panel';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { safeLocale } from '@/lib/auth/validation';
import { AvatarImage } from '@/lib/profile/avatar-image';
import { getServerEnv } from '@/lib/env/server';

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  const locale = safeLocale(rawLocale);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const client = await createSupabaseServerClient();
  const [profile, trust] = await Promise.all([
    client
      .from('member_profiles')
      .select(
        'id,display_name,avatar_path,bio,residence_location_id,created_at',
      )
      .eq('id', id)
      .maybeSingle(),
    client
      .from('profile_trust')
      .select(
        'email_verified,phone_verified,identity_verified,completed_deliveries,completed_traveler_jobs,completed_sender_jobs,review_count,rating_sum,cancellation_count',
      )
      .eq('profile_id', id)
      .maybeSingle(),
  ]);
  if (profile.error || trust.error || !profile.data || !trust.data) {
    console.error('public_profile.load_failed', {
      profileCode: profile.error?.code ?? null,
      trustCode: trust.error?.code ?? null,
      profileFound: Boolean(profile.data),
      trustFound: Boolean(trust.data),
    });
    notFound();
  }
  const { SUPABASE_URL } = getServerEnv();
  const avatarUrl =
    profile.data.avatar_path && SUPABASE_URL
      ? `${SUPABASE_URL}/storage/v1/object/public/avatars/${profile.data.avatar_path}`
      : null;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{profile.data.display_name}</h1>
      {avatarUrl && (
        <AvatarImage src={avatarUrl} alt={profile.data.display_name} />
      )}
      {profile.data.bio && <p>{profile.data.bio}</p>}
      <TrustPanel
        locale={locale}
        email={trust.data.email_verified}
        phone={trust.data.phone_verified}
        identity={trust.data.identity_verified}
        completed={trust.data.completed_deliveries}
        reviews={trust.data.review_count}
        memberSince={profile.data.created_at}
      />
    </section>
  );
}
