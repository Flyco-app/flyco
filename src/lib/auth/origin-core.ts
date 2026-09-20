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
