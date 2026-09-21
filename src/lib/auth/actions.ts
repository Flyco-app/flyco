'use server';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getVerifiedIdentity, requireActiveAccount } from './session';
import { enforceAuthRateLimit } from './rate-limit';
import { assertTrustedServerActionOrigin } from './origin';
import { hasValidAvatarSignature, validateAvatar } from '@/lib/profile/avatar';
import { randomUUID } from 'node:crypto';
import {
  changePasswordSchema,
  emailSchema,
  loginSchema,
  profileSchema,
  phoneMatchesCountry,
  resetRequestSchema,
  safeLocale,
  signUpSchema,
} from './validation';

function getFields(form: FormData) {
  return Object.fromEntries(
    [
      'email',
      'password',
      'displayName',
      'locale',
      'firstName',
      'lastName',
      'phone',
      'bio',
      'residenceLocationId',
    ].map((key) => [key, form.get(key)]),
  );
}
export async function signUp(form: FormData) {
  await assertTrustedServerActionOrigin();
  const parsed = signUpSchema.safeParse(getFields(form));
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  if (!parsed.success) redirect(`/${locale}/signup?error=invalid`);
  const { email, password, displayName } = parsed.data;
  try {
    await enforceAuthRateLimit('signup', { kind: 'account', value: email });
  } catch {
    redirect(`/${locale}/signup?error=failed`);
  }
  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, locale },
    },
  });
  if (error) redirect(`/${locale}/signup?error=failed`);
  redirect(`/${locale}/check-email`);
}

export async function logIn(form: FormData) {
  await assertTrustedServerActionOrigin();
  const parsed = loginSchema.safeParse(getFields(form));
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  if (!parsed.success) redirect(`/${locale}/login?error=failed`);
  try {
    await enforceAuthRateLimit('login', {
      kind: 'account',
      value: parsed.data.email,
    });
  } catch {
    redirect(`/${locale}/login?error=failed`);
  }
  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) redirect(`/${locale}/login?error=failed`);
  redirect(`/${locale}/profile`);
}

export async function logOut(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signOut({ scope: 'global' });
  if (error) redirect(`/${locale}/settings?error=failed`);
  redirect(`/${locale}/login`);
}

export async function requestPasswordReset(form: FormData) {
  await assertTrustedServerActionOrigin();
  const parsed = resetRequestSchema.safeParse(getFields(form));
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  if (parsed.success) {
    try {
      await enforceAuthRateLimit('recovery', {
        kind: 'account',
        value: parsed.data.email,
      });
      const client = await createSupabaseServerClient();
      const { error } = await client.auth.resetPasswordForEmail(
        parsed.data.email,
      );
      if (error) console.error('auth.reset.request_failed', error.code);
    } catch {
      // Keep the response identical for unknown, rejected and rate-limited accounts.
    }
  }
  // Uniform response for existing and unknown addresses.
  redirect(`/${locale}/check-email`);
}

export async function changePassword(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const parsed = changePasswordSchema.safeParse(getFields(form));
  if (!parsed.success) redirect(`/${locale}/new-password?error=invalid`);
  const identity = await getVerifiedIdentity();
  if (!identity) redirect(`/${locale}/login`);
  const { error } = await identity.client.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) redirect(`/${locale}/new-password?error=failed`);
  const { error: signOutError } = await identity.client.auth.signOut({
    scope: 'global',
  });
  if (signOutError) {
    console.error('auth.recovery.signout_failed', signOutError.code);
    redirect(`/${locale}/new-password?error=failed`);
  }
  redirect(`/${locale}/login?notice=password-updated`);
}

export async function updateProfile(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const parsed = profileSchema.safeParse(getFields(form));
  if (!parsed.success) redirect(`/${locale}/settings?error=invalid`);
  const { client } = await requireActiveAccount(locale);
  let residenceCountry: string | null = null;
  if (parsed.data.residenceLocationId) {
    const location = await client
      .from('locations')
      .select('country_code')
      .eq('id', parsed.data.residenceLocationId)
      .eq('active', true)
      .maybeSingle();
    if (location.error || !location.data)
      redirect(`/${locale}/settings?error=invalid`);
    residenceCountry = location.data.country_code;
  }
  if (!phoneMatchesCountry(parsed.data.phone, residenceCountry))
    redirect(`/${locale}/settings?error=invalid`);
  const { error } = await client.rpc('update_own_profile', {
    new_display_name: parsed.data.displayName,
    new_first_name: parsed.data.firstName,
    new_last_name: parsed.data.lastName,
    new_locale: parsed.data.locale,
    new_phone_e164: parsed.data.phone,
    new_bio: parsed.data.bio,
    new_residence_location_id: parsed.data.residenceLocationId,
  });
  if (error) redirect(`/${locale}/settings?error=failed`);
  redirect(`/${parsed.data.locale}/settings?notice=saved`);
}

export async function uploadAvatar(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const file = form.get('avatar');
  if (!(file instanceof File)) redirect(`/${locale}/settings?error=invalid`);
  const avatar = validateAvatar(file);
  if (!avatar || !(await hasValidAvatarSignature(file, avatar.mime)))
    redirect(`/${locale}/settings?error=invalid`);
  const { client, user } = await requireActiveAccount(locale);
  const existing = await client
    .from('member_profiles')
    .select('avatar_path')
    .eq('id', user.id)
    .single();
  if (existing.error) redirect(`/${locale}/settings?error=failed`);
  const path = `${user.id}/${randomUUID()}.${avatar.extension}`;
  const uploaded = await client.storage.from('avatars').upload(path, file, {
    contentType: avatar.mime,
    cacheControl: '3600',
    upsert: false,
  });
  if (uploaded.error) redirect(`/${locale}/settings?error=failed`);
  const updated = await client
    .from('member_profiles')
    .update({ avatar_path: path })
    .eq('id', user.id);
  if (updated.error) {
    await client.storage.from('avatars').remove([path]);
    redirect(`/${locale}/settings?error=failed`);
  }
  if (existing.data.avatar_path) {
    const cleanup = await client.storage
      .from('avatars')
      .remove([existing.data.avatar_path]);
    if (cleanup.error) console.error('profile.avatar.cleanup_failed');
  }
  redirect(`/${locale}/settings?notice=avatar-saved`);
}

export async function removeAvatar(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const { client, user } = await requireActiveAccount(locale);
  const profile = await client
    .from('member_profiles')
    .select('avatar_path')
    .eq('id', user.id)
    .single();
  if (profile.error) redirect(`/${locale}/settings?error=failed`);
  if (!profile.data.avatar_path) redirect(`/${locale}/settings`);
  const updated = await client
    .from('member_profiles')
    .update({ avatar_path: null })
    .eq('id', user.id);
  if (updated.error) redirect(`/${locale}/settings?error=failed`);
  const removed = await client.storage
    .from('avatars')
    .remove([profile.data.avatar_path]);
  if (removed.error) console.error('profile.avatar.remove_failed');
  redirect(`/${locale}/settings?notice=avatar-removed`);
}

export async function startIdentityVerification(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const { client, user } = await requireActiveAccount(locale);
  const { error } = await client
    .from('identity_verifications')
    .insert({ user_id: user.id });
  if (error) redirect(`/${locale}/settings?error=failed`);
  redirect(`/${locale}/settings?notice=verification-started`);
}

export async function cancelIdentityVerification(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const id = String(form.get('verificationId') ?? '');
  const version = Number(form.get('version'));
  if (!/^[0-9a-f-]{36}$/.test(id) || !Number.isInteger(version) || version < 1)
    redirect(`/${locale}/settings?error=invalid`);
  const { client, user } = await requireActiveAccount(locale);
  const cancelled = await client
    .from('identity_verifications')
    .update({
      state: 'cancelled',
      cancelled_at: new Date().toISOString(),
      version: version + 1,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('version', version)
    .select('id')
    .maybeSingle();
  if (cancelled.error || !cancelled.data)
    redirect(`/${locale}/settings?error=failed`);
  redirect(`/${locale}/settings?notice=verification-cancelled`);
}

export async function changeEmail(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const parsed = emailSchema.safeParse(form.get('email'));
  if (!parsed.success) redirect(`/${locale}/settings?error=invalid`);
  const { client } = await requireActiveAccount(locale);
  try {
    await enforceAuthRateLimit('email_change', {
      kind: 'account',
      value: parsed.data,
    });
  } catch {
    redirect(`/${locale}/settings?error=failed`);
  }
  const { error } = await client.auth.updateUser({ email: parsed.data });
  if (error) redirect(`/${locale}/settings?error=failed`);
  redirect(`/${locale}/check-email`);
}
