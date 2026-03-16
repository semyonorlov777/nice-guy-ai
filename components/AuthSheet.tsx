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
  mode: "sheet" | "fullscreen";
  context?: "test" | "chat" | "default";
  open: boolean;
  onSuccess: () => void;
  onClose?: () => void;
  redirectTo?: string;
  initialError?: string;
}

const CONTEXT_TITLES: Record<string, { title: string; subtitle: string }> = {
  test: {
    title: 'Сохрани свой <em>результат</em>',
    subtitle: 'Остался 1 вопрос и твой персональный профиль готов. Авторизация займёт <span class="auth-sheet-time-hint">10 секунд</span>.',
  },
  chat: {
    title: 'Продолжим <em>разговор</em>?',
    subtitle: 'Чтобы сохранить историю и продолжить, войди в аккаунт.',
  },
  default: {
    title: 'Войти в <em>аккаунт</em>',
    subtitle: 'Чтобы продолжить работу с программой.',
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

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function TrustLine() {
  return (
    <div className="auth-sheet-trust">
      <LockIcon />
      <span>Мы не публикуем данные и не пишем от вашего имени</span>
    </div>
  );
}

export function AuthSheet({ mode, open, onSuccess, onClose, context = "default", initialError }: AuthSheetProps) {
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);
  const [error, setError] = useState(initialError || "");
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
    onSuccess();
  }, [onSuccess]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      calledRef.current = false;
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
      if (!email || !email.includes("@")) {
        setError("Введи корректный email");
        return;
      }
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

  // Close on Escape (sheet mode only)
  useEffect(() => {
    if (!open || mode !== "sheet" || !onClose) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose!();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, mode, onClose]);

  // Reset email form
  const resetEmailForm = useCallback(() => {
    setEmailSent(false);
    setEmail("");
    setError("");
  }, []);

  if (!open && mode === "sheet") return null;

  const cardContent = (
    <>
      {mode === "sheet" && <div className="auth-sheet-handle" />}

      {!emailSent ? (
        <div>
          <div className="auth-sheet-header">
            <h2
              className="auth-sheet-title"
              dangerouslySetInnerHTML={{ __html: title }}
            />
            <p
              className="auth-sheet-subtitle"
              dangerouslySetInnerHTML={{ __html: subtitle }}
            />
          </div>

          {error && <div className="auth-sheet-error">{error}</div>}

          <div className="auth-sheet-buttons">
            <button
              className="auth-sheet-btn tg"
              onClick={handleTelegram}
              disabled={tgLoading || !scriptReady}
            >
              <TelegramIcon />
              {tgLoading ? "Подтверди вход в Telegram..." : "Войти через Telegram"}
            </button>

            <button
              className="auth-sheet-btn ya"
              onClick={handleYandex}
            >
              <YandexIcon />
              Войти через Яндекс
            </button>
          </div>

          <div className="auth-sheet-divider">
            <span>или</span>
          </div>

          <form className="auth-sheet-email-form" onSubmit={handleEmailSubmit}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              autoComplete="email"
              className="auth-sheet-email-input"
            />
            <button
              type="submit"
              disabled={loading}
              className="auth-sheet-email-send"
              aria-label="Отправить ссылку"
            >
              {loading ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" opacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
                    <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
                  </path>
                </svg>
              ) : (
                <ArrowRightIcon />
              )}
            </button>
          </form>
          <div className="auth-sheet-email-hint">
            Пришлём ссылку для входа — никаких паролей
          </div>

          <TrustLine />
        </div>
      ) : (
        <div className="auth-sheet-sent">
          <div className="auth-sheet-check-circle">
            <CheckIcon />
          </div>
          <h3>Проверь почту</h3>
          <p>
            Мы отправили ссылку на<br />
            <strong>{email}</strong>
          </p>
          <p className="auth-sheet-sent-subhint">
            Проверь папку &laquo;Входящие&raquo; и &laquo;Спам&raquo;
          </p>
          <button
            className="auth-sheet-resend"
            onClick={resetEmailForm}
          >
            Отправить ещё раз
          </button>

          <TrustLine />
        </div>
      )}
    </>
  );

  if (mode === "fullscreen") {
    return (
      <>
        {open && (
          <Script
            src="https://telegram.org/js/telegram-widget.js"
            strategy="lazyOnload"
            onLoad={() => setScriptReady(true)}
          />
        )}
        <div className="auth-sheet-fullscreen-wrap">
          <div className="auth-sheet-logo">
            <div className="auth-sheet-logo-icon">Н</div>
            <div className="auth-sheet-logo-text">
              НеСлавный <span>AI</span>
            </div>
          </div>
          <div className="auth-sheet mode-full">
            {cardContent}
          </div>
        </div>
      </>
    );
  }

  // Sheet mode
  return (
    <>
      {open && (
        <Script
          src="https://telegram.org/js/telegram-widget.js"
          strategy="lazyOnload"
          onLoad={() => setScriptReady(true)}
        />
      )}

      {open && (
        <div
          className="auth-sheet-scrim"
          onClick={onClose}
        />
      )}

      <div className={`auth-sheet mode-sheet ${open ? "open" : ""}`}>
        {cardContent}
      </div>
    </>
  );
}
