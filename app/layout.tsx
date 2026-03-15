import type { Metadata } from "next";
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
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=localStorage.getItem('theme');if(s==='dark'){document.documentElement.setAttribute('data-theme','dark')}else if(s!=='light'){if(window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches){document.documentElement.setAttribute('data-theme','dark')}}}catch(e){}`,
          }}
        />
      </head>
      <body className={`${onest.variable} ${cormorant.variable}`}>
        {children}
        {/* Яндекс Метрика */}
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r)return}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(107079376,"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});`}
        </Script>
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
