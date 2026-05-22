import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@mini/voice/styles.css";

export const metadata: Metadata = {
  title: "Голосовые заметки",
  description: "Запиши мысль голосом — получи готовый текст.",
  robots: { index: false, follow: false },
};

export default function VoiceLayout({ children }: { children: ReactNode }) {
  return <div className="voice-root">{children}</div>;
}
