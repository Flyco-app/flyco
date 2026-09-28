export function buildContentSecurityPolicy({
  appEnv,
  nonce,
  supabaseUrl,
}: {
  appEnv: 'local' | 'preview' | 'staging' | 'production';
  nonce: string;
  supabaseUrl: string | undefined;
}) {
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null;
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${appEnv === 'local' ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data:${supabaseOrigin ? ` ${supabaseOrigin}` : ''}`,
    `font-src 'self'`,
    `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ''}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
  ].join('; ');
}
