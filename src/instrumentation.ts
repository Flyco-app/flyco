export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getServerEnv } = await import('./lib/env/server');
    const env = getServerEnv();
    if (env.SENTRY_DSN) {
      const Sentry = await import('@sentry/nextjs');
      const { scrubEvent } = await import('./lib/observability/options');
      Sentry.init({
        dsn: env.SENTRY_DSN,
        environment: env.APP_ENV,
        sendDefaultPii: false,
        tracesSampleRate: 0,
        beforeSend: scrubEvent,
      });
    }
  }
}

export const onRequestError = async (
  ...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>
) => {
  if (process.env.SENTRY_DSN) {
    const Sentry = await import('@sentry/nextjs');
    await Sentry.captureRequestError(...args);
  }
};
