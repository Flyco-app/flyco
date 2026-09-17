import { expect, it } from 'vitest';
import { scrubEvent } from '@/lib/observability/options';

it('removes personal data, arbitrary context and exception text', () => {
  const result = scrubEvent({
    user: { email: 'fixture@example.invalid' },
    request: { url: 'https://example.invalid/private?token=fixture' },
    extra: { secret: 'fixture' },
    contexts: { arbitrary: { secret: 'fixture' } },
    breadcrumbs: [{ message: 'private content' }],
    message: 'private content',
    exception: {
      values: [
        {
          type: 'Error',
          value: 'private content',
          stacktrace: { frames: [{ filename: 'server.ts', lineno: 3 }] },
        },
      ],
    },
  });
  expect(JSON.stringify(result)).not.toMatch(/fixture|private content|token/);
  expect(result.exception?.values?.[0]?.stacktrace?.frames?.[0]?.lineno).toBe(
    3,
  );
});
it('handles events without exceptions', () => {
  expect(scrubEvent({})).toEqual({});
});
