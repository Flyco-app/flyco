import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export function trustedClientIp(input: {
  appEnv: string;
  forwardedFor: string | null;
  localTestIp?: string | null;
}): string | null {
  if (input.appEnv === 'local') {
    const candidate = input.localTestIp ?? '127.0.0.1';
    return isIP(candidate) ? candidate : null;
  }
  const candidate = input.forwardedFor?.trim() ?? '';
  return isIP(candidate) ? candidate : null;
}

export function authFingerprint(
  secret: string,
  kind: 'ip' | 'account' | 'token',
  value: string,
): string {
  return createHmac('sha256', secret).update(`${kind}:${value}`).digest('hex');
}
