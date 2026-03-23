import type { Metadata, Viewport } from "next";
import { Onest, Cormorant_Garamond } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const onest = Onest({
  subsets: ["latin", "cyrillic"],
  variable: "--font-onest",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
});

const BUILD_TIME = new Date().toISOString();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "AI-тренажёры по книгам",
  description: "Платформа AI-тренажёров для работы над собой",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#FAFAF5" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0b0c0e" media="(prefers-color-scheme: dark)" />
      </head>
      <body className={`${onest.variable} ${cormorant.variable}`}>
        <Script
          id="theme-init"
          src="/theme-init.js"
          strategy="beforeInteractive"
        />
        {children}
        {/* Яндекс Метрика */}
        <Script id="yandex-metrika" src="/ym-init.js" strategy="afterInteractive" />
        <noscript>
          <div><img src="https://mc.yandex.ru/watch/107079376" style={{position:"absolute",left:"-9999px"}} alt="" /></div>
        </noscript>
        <div suppressHydrationWarning style={{ textAlign: "center", padding: "8px 0", fontSize: 10, opacity: 0.3, color: "inherit" }}>
          build: {BUILD_TIME}
        </div>
      </body>
    </html>
  );
}
