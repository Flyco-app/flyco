import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getServerEnv } from '@/lib/env/server';

export async function createSupabaseServerClient() {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, APP_ENV } = getServerEnv();
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY)
    throw new Error('Supabase Auth is not configured.');
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: APP_ENV !== 'local',
      path: '/',
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        for (const { name, value, options } of items)
          cookieStore.set(name, value, options);
      },
    },
  });
}
