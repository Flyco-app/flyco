import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { dictionaries } from '@/lib/auth/dictionaries';
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
  if (profile.error || trust.error || !profile.data || !trust.data) notFound();
  const d = dictionaries[locale];
  const { SUPABASE_URL } = getServerEnv();
  const avatarUrl =
    profile.data.avatar_path && SUPABASE_URL
      ? `${SUPABASE_URL}/storage/v1/object/public/avatars/${profile.data.avatar_path}`
      : null;
  const average = trust.data.review_count
    ? (trust.data.rating_sum / trust.data.review_count / 100).toFixed(1)
    : null;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{profile.data.display_name}</h1>
      {avatarUrl && (
        <AvatarImage src={avatarUrl} alt={profile.data.display_name} />
      )}
      {profile.data.bio && <p>{profile.data.bio}</p>}
      <dl className="grid gap-2 rounded-xl border p-4">
        <dt className="font-semibold">{d.trust}</dt>
        <dd>
          {d.emailVerified}: {trust.data.email_verified ? '✓' : '—'}
        </dd>
        <dd>
          {d.phoneVerified}: {trust.data.phone_verified ? '✓' : '—'}
        </dd>
        <dd>
          {d.identityVerified}: {trust.data.identity_verified ? '✓' : '—'}
        </dd>
        <dd>
          {d.completed}: {trust.data.completed_deliveries}
        </dd>
        <dd>
          {d.reviews}: {trust.data.review_count}
          {average ? ` · ${average}/5` : ''}
        </dd>
      </dl>
    </section>
  );
}
