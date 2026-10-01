import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

function voiceRelaySources(): string {
  const out = ["https://*.run.app", "wss://*.run.app", "https://*.fly.dev", "wss://*.fly.dev"];
  const url = process.env.NEXT_PUBLIC_VOICE_RELAY_URL;
  if (url) {
    const host = url.replace(/^(wss?|https?):\/\//, "").replace(/\/.*$/, "");
    out.push(`https://${host}`, `wss://${host}`);
  }
  if (process.env.NODE_ENV !== "production") out.push("http://localhost:8787", "ws://localhost:8787");
  return out.join(" ");
}

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' telegram.org oauth.telegram.org",
  "style-src 'self' 'unsafe-inline'",
  // Author photos are hosted locally in /public/authors/ (see book-to-modes skill); external photo-hosts removed.
  // Remaining: 'self' + data/blob (local); cdn.litres.ru (main book covers); imo10.labirint.ru (100-notes cover only — TODO mirror to cdn.litres.ru); OAuth avatar CDNs (Yandex/Google/Telegram).
  "img-src 'self' data: blob: *.yandex.ru *.yandex.net cdn.litres.ru imo10.labirint.ru lh3.googleusercontent.com *.googleusercontent.com *.cdn-telegram.org",
  "font-src 'self'",
  "worker-src 'self' blob:",
  // Ретранслятор голосового практикума (relay/): адрес из NEXT_PUBLIC_VOICE_RELAY_URL + площадки-кандидаты для пробы связи.
  `connect-src 'self' *.supabase.co generativelanguage.googleapis.com oauth.telegram.org *.sentry.io ${voiceRelaySources()}`,
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

// Карты исходников Sentry выгружаются только на боевых сборках (ветка main).
// На превью-сборках выгрузка пропускается — экономит 1–2 минуты на каждый деплой.
const isProductionDeploy = process.env.VERCEL_ENV === "production";

export default withSentryConfig(nextConfig, {
  sourcemaps: {
    disable: !isProductionDeploy,
    deleteSourcemapsAfterUpload: true,
  },

  // Не показывать Sentry banner в логах сборки
  silent: !process.env.CI,
});
