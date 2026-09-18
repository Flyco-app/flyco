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
    .select('id, display_name, locale, account_status')
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
    .select('id, display_name, locale, account_status')
    .single();
  if (inserted.error) {
    // A second request may have created the row concurrently; never overwrite it.
    const retry = await client
      .from('profiles')
      .select('id, display_name, locale, account_status')
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
  return { ...identity, profile };
}
