import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Только в production
  enabled: process.env.NODE_ENV === "production",

  // 10% транзакций для мониторинга производительности
  tracesSampleRate: 0.1,

  // Replay — запись сессии пользователя при ошибке
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,

  integrations: [
    Sentry.replayIntegration({
      // Маскировать весь текст — privacy (психологический контент!)
      maskAllText: true,
      blockAllMedia: false,
    }),
  ],

  // Не отправлять PII
  sendDefaultPii: false,

  beforeSend(event) {
    // Игнорировать ошибки от расширений браузера
    if (
      event.exception?.values?.[0]?.stacktrace?.frames?.some((frame) =>
        frame.filename?.includes("chrome-extension://")
      )
    ) {
      return null;
    }
    return event;
  },
});
