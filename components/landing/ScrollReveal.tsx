"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
}

export function ScrollReveal({ children, className = "", as: tag = "div" }: ScrollRevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const combinedClassName = `reveal ${className}`.trim();

  const callbackRef = (node: HTMLElement | null) => {
    ref.current = node;
  };

  if (tag === "section") {
    return <section ref={callbackRef} className={combinedClassName}>{children}</section>;
  }

  return <div ref={callbackRef} className={combinedClassName}>{children}</div>;
}
