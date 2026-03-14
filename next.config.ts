import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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
