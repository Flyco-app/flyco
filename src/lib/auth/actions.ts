'use server';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getVerifiedIdentity, requireActiveAccount } from './session';
import { enforceAuthRateLimit } from './rate-limit';
import { assertTrustedServerActionOrigin } from './origin';
import {
  changePasswordSchema,
  emailSchema,
  loginSchema,
  profileSchema,
  resetRequestSchema,
  safeLocale,
  signUpSchema,
} from './validation';

function getFields(form: FormData) {
  return Object.fromEntries(
    ['email', 'password', 'displayName', 'locale'].map((key) => [
      key,
      form.get(key),
    ]),
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
  const { client, user } = await requireActiveAccount(locale);
  const { error } = await client
    .from('profiles')
    .update({
      display_name: parsed.data.displayName,
      locale: parsed.data.locale,
    })
    .eq('id', user.id);
  if (error) redirect(`/${locale}/settings?error=failed`);
  redirect(`/${parsed.data.locale}/settings?notice=saved`);
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
