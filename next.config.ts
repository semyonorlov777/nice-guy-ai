import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' oauth.telegram.org",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: *.yandex.ru *.yandex.net",
  "font-src 'self'",
  "connect-src 'self' *.supabase.co generativelanguage.googleapis.com oauth.telegram.org *.sentry.io",
  "frame-src oauth.telegram.org oauth.yandex.ru",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(self), geolocation=()",
        },
        { key: "X-DNS-Prefetch-Control", value: "on" },
        {
          key: "Content-Security-Policy",
          value: cspDirectives.join("; "),
        },
      ],
    },
  ],
};

export default withSentryConfig(nextConfig, {
  // Source maps для читаемых stack traces
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Не показывать Sentry banner в логах сборки
  silent: !process.env.CI,
});
