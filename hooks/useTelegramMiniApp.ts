"use client";

import { useEffect, type RefObject } from "react";

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  disableVerticalSwipes?: () => void;
  isVerticalSwipesEnabled?: boolean;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

/**
 * Инициализация Telegram Mini App для чат-страниц.
 *
 * Без disableVerticalSwipes() (Bot API 7.7+, июль 2024) свайп вниз внутри
 * любого скролл-контейнера будет закрывать приложение в Telegram-клиенте.
 * После перехода на контейнерный скролл (sticky композер + spacer-паттерн)
 * без этой обвязки начинаются регрессии — см. bugs.telegram.org/c/36664.
 *
 * Паттерн swipe-y-off/swipe-y-on (root + scroll-контейнер) — на случай
 * клиентов где disableVerticalSwipes ещё не поддержан: CSS-классы дают
 * `overscroll-behavior-y: contain` на ровно одном узле и блокируют bubble.
 *
 * @param scrollContainerRef ref на скролл-контейнер чата
 */
export function useTelegramMiniApp(
  scrollContainerRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    try {
      tg.ready();
      tg.expand?.();
      tg.disableVerticalSwipes?.();
    } catch {
      // старые клиенты без новых методов — fallback на CSS-классы
    }

    document.documentElement.classList.add("swipe-y-off");
    const scrollEl = scrollContainerRef?.current;
    scrollEl?.classList.add("swipe-y-on");

    return () => {
      document.documentElement.classList.remove("swipe-y-off");
      scrollEl?.classList.remove("swipe-y-on");
    };
  }, [scrollContainerRef]);
}
