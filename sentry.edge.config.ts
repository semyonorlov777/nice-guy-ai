import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Только в production
  enabled: process.env.NODE_ENV === "production",

  tracesSampleRate: 0.1,

  // Не логировать PII
  sendDefaultPii: false,
});
