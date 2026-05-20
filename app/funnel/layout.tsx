import type { Metadata } from "next";
import "@mini/funnel/funnel.css";

export const metadata: Metadata = {
  title: "Глубинный разбор — узнайте свой главный паттерн",
  description:
    "За 15–20 минут — персональный разбор по методике Волынского. Не диагноз, а узнавание себя.",
};

export default function FunnelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-theme="dark" className="funnel-root">
      {children}
    </div>
  );
}
