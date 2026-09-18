import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env/server';
import { safeReturnPath } from '@/lib/auth/validation';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const appOrigin = getServerEnv().APP_URL;
  if (!appOrigin) throw new Error('APP_URL is required for authentication.');
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next');
  const locale = next?.match(/^\/(fr|en|ar)\//)?.[1] ?? 'fr';
  const destination = next?.match(/^\/(fr|en|ar)\/new-password$/)
    ? next
    : safeReturnPath(next, locale as 'fr' | 'en' | 'ar');
  if (!code || code.length > 2048)
    return NextResponse.redirect(
      new URL(`/${locale}/login?error=failed`, appOrigin),
    );
  const client = await createSupabaseServerClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error)
    return NextResponse.redirect(
      new URL(`/${locale}/login?error=failed`, appOrigin),
    );
  return NextResponse.redirect(new URL(destination, appOrigin));
}
