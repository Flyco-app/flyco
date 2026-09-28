import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy } from '@/lib/security/csp';

describe('content security policy', () => {
  it('allows browser Auth calls only to the configured Supabase origin', () => {
    const policy = buildContentSecurityPolicy({
      appEnv: 'staging',
      nonce: 'test-nonce',
      supabaseUrl: 'https://staging-project.supabase.co/rest/v1',
    });

    expect(policy).toContain(
      "connect-src 'self' https://staging-project.supabase.co",
    );
    expect(policy).toContain(
      "img-src 'self' data: https://staging-project.supabase.co",
    );
    expect(policy).not.toContain('/rest/v1');
    expect(policy).not.toContain('https://example.com');
  });

  it('keeps the browser connection policy same-origin without Supabase', () => {
    const policy = buildContentSecurityPolicy({
      appEnv: 'local',
      nonce: 'test-nonce',
      supabaseUrl: undefined,
    });

    expect(policy).toContain("connect-src 'self'");
    expect(policy).not.toMatch(/connect-src 'self' https?:\/\//);
  });
});
