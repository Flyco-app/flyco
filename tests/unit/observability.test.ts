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

it('drops alternate telemetry channels and stack-local secrets', () => {
  const clean = scrubEvent({
    event_id: 'a'.repeat(32),
    timestamp: 123,
    environment: 'staging',
    tags: { secret: 'fixture-secret' },
    transaction: '/reset?token=fixture-secret',
    fingerprint: ['fixture-secret'],
    logentry: { message: 'fixture-secret' },
    exception: {
      values: [
        {
          type: 'fixture-secret',
          value: 'fixture-secret',
          mechanism: {
            type: 'fixture-secret',
            data: { secret: 'fixture-secret' },
          },
          stacktrace: {
            frames: [
              {
                filename: 'fixture-secret',
                function: 'fixture-secret',
                vars: { secret: 'fixture-secret' },
                context_line: 'fixture-secret',
                lineno: 2,
                colno: 3,
                in_app: true,
              },
            ],
          },
        },
      ],
    },
  });
  expect(JSON.stringify(clean)).not.toContain('fixture-secret');
  expect(clean.event_id).toBe('a'.repeat(32));
  expect(clean.timestamp).toBe(123);
  expect(clean.environment).toBe('staging');
  expect(clean.exception?.values?.[0]?.stacktrace?.frames?.[0]).toEqual({
    lineno: 2,
    colno: 3,
    in_app: true,
  });
});
it('omits invalid metadata and handles exceptions without frames', () => {
  expect(
    scrubEvent({
      event_id: 'secret',
      timestamp: NaN,
      environment: 'secret',
      exception: { values: [{ value: 'secret' }] },
    }),
  ).toEqual({
    exception: { values: [{ type: 'Error', value: '[redacted]' }] },
  });
});
