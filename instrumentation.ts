/**
 * Next.js instrumentation hook.
 * To enable Sentry: install @sentry/nextjs (peer: Next 13/14/15), set NEXT_PUBLIC_SENTRY_DSN,
 * and add here: const Sentry = await import('@sentry/nextjs'); Sentry.init({ dsn, ... });
 * With Next.js 16, @sentry/nextjs is not yet supported; this no-op avoids "Module not found".
 */
export async function register() {
  // Optional: Sentry init when package is installed and NEXT_PUBLIC_SENTRY_DSN is set
}
