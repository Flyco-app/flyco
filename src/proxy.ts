import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { parseServerEnv } from '@/lib/env/schema';

export async function proxy(request: NextRequest) {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, APP_ENV } = parseServerEnv(
    process.env,
  );
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${APP_ENV === 'local' ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
  ].join('; ');
  const headers = new Headers(request.headers);
  headers.set('Content-Security-Policy', csp);
  headers.set('x-nonce', nonce);
  const locale =
    request.nextUrl.pathname.match(/^\/(fr|en|ar)(?:\/|$)/)?.[1] ?? 'fr';
  headers.set('x-flyco-locale', locale);
  let response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return response;
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: APP_ENV !== 'local',
      path: '/',
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers } });
        response.headers.set('Content-Security-Policy', csp);
        for (const { name, value, options } of items)
          response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
