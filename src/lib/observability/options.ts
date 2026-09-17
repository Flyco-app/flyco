import type { Event } from '@sentry/nextjs';

export function scrubEvent<T extends Event>(event: T): T {
  // Foundation telemetry keeps stack diagnostics but no arbitrary user context.
  delete event.user;
  delete event.request;
  delete event.breadcrumbs;
  delete event.extra;
  delete event.contexts;
  delete event.message;
  if (event.exception?.values) {
    for (const exception of event.exception.values)
      exception.value = '[redacted]';
  }
  return event;
}
