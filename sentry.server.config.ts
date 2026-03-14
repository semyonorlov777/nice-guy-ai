import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Только в production
  enabled: process.env.NODE_ENV === "production",

  tracesSampleRate: 0.1,

  // Не логировать PII
  sendDefaultPii: false,

  beforeSend(event) {
    const message = event.exception?.values?.[0]?.value || "";

    // Rate limit — нормальное поведение
    if (message.includes("429") || message.includes("rate limit")) {
      return null;
    }

    // AUTH_REQUIRED — нормальный flow анонимного чата
    if (message.includes("AUTH_REQUIRED")) {
      return null;
    }

    return event;
  },
});
