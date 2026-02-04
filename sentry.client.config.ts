/**
 * Sentry client (browser) configuration.
 * Disabled: @sentry/nextjs supports Next 13–15 only. Re-enable when a version supports Next 16.
 * Until then, this file is a no-op so the build does not require the package.
 */
// When re-enabling: import * as Sentry from '@sentry/nextjs' and call Sentry.init({ dsn, ... }) when process.env.NEXT_PUBLIC_SENTRY_DSN is set.

export {}
