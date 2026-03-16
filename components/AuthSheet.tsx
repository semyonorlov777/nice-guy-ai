"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Script from "next/script";
import { createClient } from "@/lib/supabase";

const TELEGRAM_BOT_ID = "8544302305";

declare global {
  interface Window {
    Telegram?: {
      Login: {
        auth: (
          options: { client_id: string; request_access?: string[] },
          callback: (result: { id_token?: string; error?: string }) => void,
        ) => void;
      };
    };
  }
}

interface AuthSheetProps {
  open: boolean;
  onClose: () => void;
  onAuthSuccess: () => void;
  context?: "test" | "chat" | "default";
}

const CONTEXT_TITLES: Record<string, { title: string; subtitle: string }> = {
  test: {
    title: "Сохрани свой результат",
    subtitle: "Войди, чтобы не потерять прогресс теста",
  },
  chat: {
    title: "Продолжим разговор?",
    subtitle: "Войди, чтобы сохранить переписку",
  },
  default: {
    title: "Войди в аккаунт",
    subtitle: "Без пароля. Вход в один клик.",
  },
};

function TelegramIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function YandexIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="12" fill="white" />
      <path
        d="M13.3 19V7.95h-1.07c-1.98 0-3.02 1.07-3.02 2.66 0 1.82.72 2.66 2.18 3.63l1.2.8L9.9 19H8l2.3-3.96c-1.74-1.23-2.65-2.38-2.65-4.25 0-2.42 1.67-4.04 4.58-4.04H15V19h-1.7z"
        fill="#FC3F1D"
      />
    </svg>
  );
}

export function AuthSheet({ open, onClose, onAuthSuccess, context = "default" }: AuthSheetProps) {
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);
  const [error, setError] = useState("");
  const [scriptReady, setScriptReady] = useState(false);

  const calledRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { title, subtitle } = CONTEXT_TITLES[context] || CONTEXT_TITLES.default;

  // Idempotent success handler
  const handleSuccess = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    onAuthSuccess();
  }, [onAuthSuccess]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      calledRef.current = false;
      setShowEmail(false);
      setEmailSent(false);
      setError("");
      setLoading(false);
      setTgLoading(false);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [open]);

  // Channel 1: postMessage from popup
  useEffect(() => {
    if (!open) return;

    function handler(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "auth-success") {
        handleSuccess();
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [open, handleSuccess]);

  // Channel 2: onAuthStateChange (cross-tab, magic link)
  useEffect(() => {
    if (!open) return;

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        handleSuccess();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [open, handleSuccess]);

  // Channel 3: polling fallback
  useEffect(() => {
    if (!open) return;

    pollRef.current = setInterval(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        handleSuccess();
      }
    }, 3000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [open, handleSuccess]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Telegram auth (inline, same tab)
  const handleTelegram = useCallback(() => {
    if (!window.Telegram?.Login?.auth) {
      setError("Telegram SDK ещё загружается...");
      return;
    }

    setError("");
    setTgLoading(true);

    window.Telegram.Login.auth(
      { client_id: TELEGRAM_BOT_ID, request_access: ["write"] },
      async (result) => {
        if (result.error || !result.id_token) {
          setTgLoading(false);
          setError("Не удалось войти через Telegram. Попробуй ещё раз.");
          return;
        }

        try {
          const res = await fetch("/api/auth/telegram/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_token: result.id_token }),
          });

          if (res.ok) {
            handleSuccess();
          } else {
            const data = await res.json().catch(() => ({}));
            setError(data.error || "Ошибка авторизации");
            setTgLoading(false);
          }
        } catch {
          setError("Ошибка сети. Попробуй ещё раз.");
          setTgLoading(false);
        }
      },
    );
  }, [handleSuccess]);

  // Yandex auth (popup)
  const handleYandex = useCallback(() => {
    const currentPath = window.location.pathname;
    const params = new URLSearchParams({
      popup: "true",
      redirect: currentPath,
    });

    const w = 500;
    const h = 600;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;

    window.open(
      `/api/auth/yandex?${params}`,
      "auth-popup",
      `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`,
    );
  }, []);

  // Magic Link
  const handleEmailSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      const supabase = createClient();
      const currentPath = window.location.pathname;
      const callbackUrl = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(currentPath)}`;

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl },
      });

      setLoading(false);

      if (otpError) {
        setError(otpError.message);
        return;
      }

      setEmailSent(true);
    },
    [email],
  );

  // Close on backdrop click
  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <>
      {/* Load Telegram SDK when sheet opens */}
      {open && (
        <Script
          src="https://telegram.org/js/telegram-widget.js"
          strategy="lazyOnload"
          onLoad={() => setScriptReady(true)}
        />
      )}

      {/* Backdrop */}
      <div
        className={`auth-sheet-backdrop ${open ? "open" : ""}`}
        onClick={handleBackdropClick}
      />

      {/* Sheet */}
      <div className={`auth-sheet ${open ? "open" : ""}`}>
        <div className="auth-sheet-handle" />
        <button className="auth-sheet-close" onClick={onClose} aria-label="Закрыть">
          &#x2715;
        </button>

        <div className="auth-sheet-header">
          <div className="auth-sheet-title">{title}</div>
          <div className="auth-sheet-subtitle">{subtitle}</div>
        </div>

        {error && <div className="auth-sheet-error">{error}</div>}

        {!emailSent ? (
          <>
            {/* Telegram */}
            <button
              className="auth-sheet-btn auth-sheet-btn-tg"
              onClick={handleTelegram}
              disabled={tgLoading || !scriptReady}
            >
              <TelegramIcon />
              {tgLoading ? "Подтверди вход в Telegram..." : "Войти через Telegram"}
            </button>

            {/* Yandex */}
            <button
              className="auth-sheet-btn auth-sheet-btn-ya"
              onClick={handleYandex}
            >
              <YandexIcon />
              Войти через Яндекс
            </button>

            {/* Divider */}
            <div className="auth-sheet-divider">
              <div className="auth-sheet-divider-line" />
              <span className="auth-sheet-divider-text">или</span>
              <div className="auth-sheet-divider-line" />
            </div>

            {/* Email */}
            {!showEmail ? (
              <button
                className="auth-sheet-email-toggle"
                onClick={() => setShowEmail(true)}
              >
                Войти по email
              </button>
            ) : (
              <form onSubmit={handleEmailSubmit}>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="auth-sheet-email-input"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="auth-sheet-btn auth-sheet-btn-submit"
                >
                  {loading ? "Отправляем..." : "Получить ссылку"}
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="auth-sheet-sent">
            <div className="auth-sheet-sent-icon">&#9993;&#65039;</div>
            <div>
              Ссылка отправлена на{" "}
              <span className="auth-sheet-sent-email">{email}</span>
            </div>
            <div className="auth-sheet-sent-hint">
              Проверь почту и кликни по ссылке. Мы подхватим автоматически.
            </div>
          </div>
        )}

        <div className="auth-sheet-footer">
          Без пароля &bull; Вход за 10 секунд
        </div>
      </div>
    </>
  );
}
