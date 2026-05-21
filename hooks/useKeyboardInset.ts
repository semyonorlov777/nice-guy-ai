"use client";

import { useEffect } from "react";

/**
 * Обновляет CSS-переменную --kb-inset на <html> в зависимости от высоты
 * виртуальной клавиатуры. Нужен для iOS Safari, где `meta interactive-widget`
 * не поддерживается (WebKit/standards-positions#65) и единственный способ
 * получить размер клавиатуры — слушать window.visualViewport.
 *
 * На Chromium и Firefox 132+ роль клавиатуры берёт на себя
 * `interactive-widget=resizes-content` в `<meta viewport>` — там --kb-inset
 * останется 0, и это нормально.
 *
 * Использование в CSS:
 *   .composer { padding-bottom: max(env(safe-area-inset-bottom), var(--kb-inset, 0px)) }
 */
export function useKeyboardInset() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--kb-inset", `${inset}px`);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.documentElement.style.removeProperty("--kb-inset");
    };
  }, []);
}
