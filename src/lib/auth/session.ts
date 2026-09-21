import 'server-only';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { displayNameSchema, type Locale } from './validation';

export async function getVerifiedIdentity() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user || !user.email_confirmed_at) return null;
  return { client, user };
}

export async function ensureOwnProfile(
  identity: NonNullable<Awaited<ReturnType<typeof getVerifiedIdentity>>>,
) {
  const { client, user } = identity;
  const existing = await client
    .from('profiles')
    .select(
      'id, display_name, locale, account_status, first_name, last_name, phone_e164, phone_verified_at, created_at, updated_at',
    )
    .eq('id', user.id)
    .maybeSingle();
  if (existing.error) throw new Error('Unable to load profile.');
  if (existing.data) return existing.data;
  const suggestedName = displayNameSchema
    .catch('Flyco member')
    .parse(user.user_metadata?.display_name);
  const locale = user.user_metadata?.locale;
  const safeLocale = locale === 'en' || locale === 'ar' ? locale : 'fr';
  const inserted = await client
    .from('profiles')
    .insert({ id: user.id, display_name: suggestedName, locale: safeLocale })
    .select(
      'id, display_name, locale, account_status, first_name, last_name, phone_e164, phone_verified_at, created_at, updated_at',
    )
    .single();
  if (inserted.error) {
    // A second request may have created the row concurrently; never overwrite it.
    const retry = await client
      .from('profiles')
      .select(
        'id, display_name, locale, account_status, first_name, last_name, phone_e164, phone_verified_at, created_at, updated_at',
      )
      .eq('id', user.id)
      .single();
    if (retry.error) throw new Error('Unable to create profile.');
    return retry.data;
  }
  return inserted.data;
}

export async function requireActiveAccount(locale: Locale) {
  const identity = await getVerifiedIdentity();
  if (!identity) redirect(`/${locale}/login`);
  const profile = await ensureOwnProfile(identity);
  if (profile.account_status !== 'active') redirect(`/${locale}/unavailable`);
  const syncedTrust = await identity.client.rpc('sync_own_auth_trust');
  if (syncedTrust.error) throw new Error('Unable to refresh account trust.');
  const [publicProfile, trust, verification] = await Promise.all([
    identity.client
      .from('member_profiles')
      .select(
        'id, display_name, avatar_path, bio, residence_location_id, created_at, updated_at',
      )
      .eq('id', identity.user.id)
      .single(),
    identity.client
      .from('profile_trust')
      .select(
        'email_verified, phone_verified, identity_verified, completed_deliveries, completed_traveler_jobs, completed_sender_jobs, review_count, rating_sum, cancellation_count, dispute_count',
      )
      .eq('profile_id', identity.user.id)
      .single(),
    identity.client
      .from('identity_verifications')
      .select('id, state, version, created_at, expires_at')
      .eq('user_id', identity.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (publicProfile.error || trust.error || verification.error)
    throw new Error('Unable to load account profile.');
  return {
    ...identity,
    profile,
    publicProfile: publicProfile.data,
    trust: trust.data,
    verification: verification.data,
  };
}
