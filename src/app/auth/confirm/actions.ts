'use server';
import { redirect } from 'next/navigation';
import {
  confirmationDestination,
  confirmationSchema,
} from '@/lib/auth/confirmation';
import { enforceAuthRateLimit } from '@/lib/auth/rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function confirmEmailToken(form: FormData) {
  const parsed = confirmationSchema.safeParse({
    token_hash: form.get('token_hash'),
    type: form.get('type'),
    next: form.get('next'),
  });
  if (!parsed.success) redirect('/fr/login?error=confirmation-failed');
  const { token_hash, type, next } = parsed.data;
  const destination = confirmationDestination(type, next);
  try {
    await enforceAuthRateLimit('confirmation', {
      kind: 'token',
      value: token_hash,
    });
  } catch {
    redirect(`/${destination.locale}/login?error=confirmation-failed`);
  }
  const client = await createSupabaseServerClient();
  const { error } = await client.auth.verifyOtp({ token_hash, type });
  if (error) redirect(`/${destination.locale}/login?error=confirmation-failed`);
  redirect(destination.path);
}
