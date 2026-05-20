"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

/**
 * Apply theme to <html> and persist user choice.
 *
 * SSOT for runtime theme switching. Must produce DOM state identical to
 * `public/theme-init.js` (anti-FOUC inline script). Keep both in sync —
 * if you change attribute name, storage key, or selector here, update the
 * inline script too.
 *
 * Pure side-effects only: writes localStorage, sets/removes
 * `data-theme="dark"` on document.documentElement. No React state.
 */
export function applyTheme(mode: ThemeMode): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage may be blocked (incognito, ITP) — ignore, DOM state still applies
  }

  const root = document.documentElement;
  if (mode === "dark") {
    root.setAttribute("data-theme", "dark");
  } else if (mode === "light") {
    root.removeAttribute("data-theme");
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
  }
}

/**
 * Read current user choice from localStorage. Returns "system" if not set
 * or unreadable. Safe on SSR (returns "system").
 */
export function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // ignore
  }
  return "system";
}

/**
 * React hook for theme switching.
 *
 * - Initial render returns "system" (SSR-safe — no localStorage access).
 * - After mount, reads stored choice and exposes `mounted` flag so UI can
 *   render without hydration mismatch.
 * - `setMode` applies the choice immediately to DOM + storage.
 * - While in "system" mode, subscribes to `prefers-color-scheme` changes
 *   and updates the DOM live.
 */
export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMode(readStoredMode());
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    applyTheme(next);
  }, []);

  return { mode, setMode, mounted };
}
