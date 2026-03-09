"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";

interface InChatAuthProps {
  onAuthSuccess: () => void;
}

function TelegramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function YandexIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12zm11.3 7V7.95h-1.07c-1.98 0-3.02 1.07-3.02 2.66 0 1.82.72 2.66 2.18 3.63l1.2.8L9.9 19h-1.9l2.3-3.96c-1.74-1.23-2.65-2.38-2.65-4.25 0-2.42 1.67-4.04 4.58-4.04H15V19h-1.7z" />
    </svg>
  );
}

export function InChatAuth({ onAuthSuccess }: InChatAuthProps) {
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const calledRef = useRef(false);

  const handleSuccess = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    if (pollRef.current) clearInterval(pollRef.current);
    onAuthSuccess();
  }, [onAuthSuccess]);

  // Listen for postMessage from popup
  useEffect(() => {
    function handler(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "auth-success") {
        handleSuccess();
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [handleSuccess]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function openPopup(provider?: string) {
    const w = 500;
    const h = 600;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const params = provider
      ? `popup=true&provider=${provider}`
      : "popup=true";
    window.open(
      `/auth?${params}`,
      "auth-popup",
      `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`
    );
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const callbackUrl = `${window.location.origin}/auth/callback`;

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

    // Start polling for session
    pollRef.current = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        handleSuccess();
      }
    }, 3000);
  }

  return (
    <div className="in-chat-auth">
      <div className="in-chat-auth-title">Сохрани разговор и продолжи</div>
      <div className="in-chat-auth-sub">
        Войди чтобы не потерять переписку. Это займёт 10 секунд.
      </div>

      {error && (
        <div className="in-chat-auth-error">{error}</div>
      )}

      {!emailSent ? (
        <>
          <div className="in-chat-auth-buttons">
            <button
              className="in-chat-auth-btn in-chat-auth-btn-tg"
              onClick={() => openPopup("telegram")}
            >
              <TelegramIcon />
              Telegram
            </button>
            <button
              className="in-chat-auth-btn in-chat-auth-btn-ya"
              onClick={() => openPopup("yandex")}
            >
              <YandexIcon />
              Яндекс
            </button>
          </div>

          {!showEmail ? (
            <button
              className="in-chat-auth-email-toggle"
              onClick={() => setShowEmail(true)}
            >
              Войти по email
            </button>
          ) : (
            <form onSubmit={handleEmailSubmit} className="in-chat-auth-email-form">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="in-chat-auth-email-input"
              />
              <button
                type="submit"
                disabled={loading}
                className="in-chat-auth-btn in-chat-auth-btn-email"
              >
                {loading ? "Отправляем..." : "Получить ссылку"}
              </button>
            </form>
          )}
        </>
      ) : (
        <div className="in-chat-auth-sent">
          <div style={{ fontSize: 28, marginBottom: 8 }}>✉️</div>
          <div>
            Ссылка отправлена на <strong>{email}</strong>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            Проверь почту и кликни по ссылке. Мы подхватим автоматически.
          </div>
        </div>
      )}

      <div className="in-chat-auth-footer">Разговор сохранится</div>
    </div>
  );
}
