import type { Metadata } from "next";
import { Onest } from "next/font/google";
import "./globals.css";

const onest = Onest({
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Nice Guy AI",
  description: "AI-тренажёры по книгам — практикуй навыки общения с ИИ-собеседниками",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${onest.className} antialiased bg-white text-gray-900`}>
        {children}
      </body>
    </html>
  );
}
