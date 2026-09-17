import type { ErrorEvent, Event } from '@sentry/nextjs';

// Construct an allowlist: new SDK fields must not silently become exportable.
// No URL, path, function name, source context, local variable or free-form tag.
export function scrubEvent(event: Event): ErrorEvent {
  const clean: ErrorEvent = { type: undefined };
  if (event.event_id && /^[a-f0-9]{32}$/.test(event.event_id))
    clean.event_id = event.event_id;
  if (typeof event.timestamp === 'number' && Number.isFinite(event.timestamp))
    clean.timestamp = event.timestamp;
  if (
    event.environment &&
    ['local', 'preview', 'staging', 'production'].includes(event.environment)
  )
    clean.environment = event.environment;
  if (event.exception?.values) {
    clean.exception = {
      values: event.exception.values.map((exception) => ({
        type: 'Error',
        value: '[redacted]',
        ...(exception.stacktrace?.frames
          ? {
              stacktrace: {
                frames: exception.stacktrace.frames.map((frame) => ({
                  ...(typeof frame.lineno === 'number'
                    ? { lineno: frame.lineno }
                    : {}),
                  ...(typeof frame.colno === 'number'
                    ? { colno: frame.colno }
                    : {}),
                  ...(typeof frame.in_app === 'boolean'
                    ? { in_app: frame.in_app }
                    : {}),
                })),
              },
            }
          : {}),
      })),
    };
  }
  return clean;
}
