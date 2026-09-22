type OriginCheck = {
  expectedOrigin: string;
  host: string | null;
  origin: string | null;
};

export function isTrustedActionRequest(input: OriginCheck): boolean {
  try {
    const expected = new URL(input.expectedOrigin);
    const actual = input.origin ? new URL(input.origin) : null;
    const host = input.host?.trim().toLowerCase();
    return Boolean(
      actual &&
      actual.origin === expected.origin &&
      actual.pathname === '/' &&
      !actual.username &&
      !actual.password &&
      host &&
      !host.includes(',') &&
      host === expected.host.toLowerCase(),
    );
  } catch {
    return false;
  }
}

export function vercelPreviewOrigin(input: {
  vercel: string | undefined;
  environment: string | undefined;
  url: string | undefined;
}): string | null {
  if (input.vercel !== '1' || input.environment !== 'preview' || !input.url)
    return null;
  const hostname = input.url.toLowerCase();
  if (
    hostname !== input.url ||
    hostname.length > 253 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+vercel\.app$/.test(hostname)
  )
    return null;
  return `https://${hostname}`;
}
