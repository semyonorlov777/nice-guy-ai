import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@mini/project-plan/styles.css";

export const metadata: Metadata = {
  title: "План",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function ProjectPlanLayout({ children }: { children: ReactNode }) {
  return children;
}
