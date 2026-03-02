"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { createClient } from "@/lib/supabase";

const D = "var(--font-display)";
const DEFAULT_REDIRECT = "/program/nice-guy/chat";
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

function YandexIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12zm11.3 7V7.95h-1.07c-1.98 0-3.02 1.07-3.02 2.66 0 1.82.72 2.66 2.18 3.63l1.2.8L9.9 19h-1.9l2.3-3.96c-1.74-1.23-2.65-2.38-2.65-4.25 0-2.42 1.67-4.04 4.58-4.04H15V19h-1.7z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function AuthForm({ tgScriptReady }: { tgScriptReady: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"form" | "sent">("form");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showEmailLogin, setShowEmailLogin] = useState(false);

  const urlError = searchParams.get("error");
  const redirectTo = searchParams.get("redirect") || DEFAULT_REDIRECT;

  // Check if already logged in
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(DEFAULT_REDIRECT);
    });
  }, [router]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ---------- Telegram popup login ----------
  const handleTelegramLogin = useCallback(() => {
    if (!window.Telegram?.Login?.auth) {
      setError("Telegram SDK не загружен. Попробуй обновить страницу.");
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
            router.push(DEFAULT_REDIRECT);
          } else {
            const data = await res.json().catch(() => ({}));
            setError(data.error || "Ошибка авторизации. Попробуй ещё раз.");
            setTgLoading(false);
          }
        } catch {
          setError("Ошибка сети. Попробуй ещё раз.");
          setTgLoading(false);
        }
      },
    );
  }, [router]);

  // ---------- Magic Link ----------
  const handleMagicLink = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      const supabase = createClient();
      const callbackUrl = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl },
      });

      setLoading(false);

      if (error) {
        setError(error.message);
        return;
      }

      setView("sent");
      setCountdown(60);
    },
    [email, redirectTo],
  );

  const handleResend = useCallback(async () => {
    if (countdown > 0) return;
    setError("");
    setLoading(true);

    const supabase = createClient();
    const callbackUrl = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setCountdown(60);
  }, [countdown, email, redirectTo]);

  const inputStyle = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 10,
    border: "1.5px solid #2a2d35",
    background: "#1c1f26",
    color: "#e0e0e0",
    fontSize: 15,
    fontFamily: "inherit",
    outline: "none",
  } as const;

  // ---------- VIEW: Check your email ----------
  if (view === "sent") {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
        <h1
          style={{
            fontFamily: D,
            fontSize: 26,
            fontWeight: 600,
            color: "#e0e0e0",
            marginBottom: 12,
          }}
        >
          Проверь почту
        </h1>
        <p style={{ fontSize: 15, color: "#999", lineHeight: 1.6, marginBottom: 8 }}>
          Мы отправили ссылку на{" "}
          <strong style={{ color: "#c9a84c" }}>{email}</strong>
        </p>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 28 }}>
          Проверь папку «Входящие» и «Спам». Ссылка действует 1 час.
        </p>

        {error && (
          <p style={{ fontSize: 13, color: "#ef4444", marginBottom: 16 }}>{error}</p>
        )}

        <button
          onClick={handleResend}
          disabled={countdown > 0 || loading}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 10,
            border: "none",
            background: "#c9a84c",
            color: "#0f1114",
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: countdown > 0 || loading ? "default" : "pointer",
            opacity: countdown > 0 || loading ? 0.5 : 1,
            marginBottom: 16,
          }}
        >
          {loading
            ? "Отправляем..."
            : countdown > 0
              ? `Отправить ещё раз (${countdown}с)`
              : "Отправить ещё раз"}
        </button>

        <button
          onClick={() => {
            setView("form");
            setError("");
          }}
          style={{
            background: "none",
            border: "none",
            color: "#c9a84c",
            fontSize: 14,
            cursor: "pointer",
            fontFamily: "inherit",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Ввести другой email
        </button>
      </div>
    );
  }

  // ---------- VIEW: Form ----------
  return (
    <div>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: D,
            fontSize: 28,
            fontWeight: 600,
            color: "#c9a84c",
            marginBottom: 8,
          }}
        >
          НеСлавный
        </h1>
        <p style={{ fontSize: 15, color: "#888", marginBottom: 4 }}>Войди или зарегистрируйся</p>
        <p style={{ fontSize: 12, color: "#555" }}>Без пароля. Вход в один клик.</p>
      </div>

      {/* URL error */}
      {urlError && !error && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 10,
            fontSize: 13,
            color: "#ef4444",
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          {urlError === "invalid_state" || urlError === "missing_verifier"
            ? "Сессия авторизации истекла. Попробуй ещё раз."
            : urlError === "telegram_auth_failed" || urlError === "token_exchange_failed"
              ? "Не удалось войти через Telegram. Попробуй ещё раз."
              : urlError === "yandex_auth_failed" || urlError === "yandex_missing_code" || urlError === "yandex_session_failed"
                ? "Не удалось войти через Яндекс. Попробуй ещё раз."
                : "Ссылка истекла или недействительна. Попробуй ещё раз."}
        </div>
      )}

      {/* Inline error */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 10,
            fontSize: 13,
            color: "#ef4444",
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}

      {/* Telegram button */}
      <button
        onClick={handleTelegramLogin}
        disabled={tgLoading || !tgScriptReady}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          width: "100%",
          padding: 14,
          borderRadius: 10,
          border: "none",
          background: "#2CA5E0",
          color: "#ffffff",
          fontSize: 15,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: tgLoading || !tgScriptReady ? "default" : "pointer",
          opacity: tgLoading ? 0.7 : !tgScriptReady ? 0.5 : 1,
        }}
      >
        {tgLoading ? (
          <>
            <span
              style={{
                display: "inline-block",
                width: 16,
                height: 16,
                border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "#fff",
                borderRadius: "50%",
                animation: "spin 0.6s linear infinite",
              }}
            />
            Подтверди вход в Telegram...
          </>
        ) : (
          <>
            <TelegramIcon />
            Войти через Telegram
          </>
        )}
      </button>

      {/* Yandex button */}
      <button
        onClick={() => {
          window.location.href = "/api/auth/yandex";
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          width: "100%",
          padding: 14,
          borderRadius: 10,
          border: "none",
          background: "#FC3F1D",
          color: "#ffffff",
          fontSize: 15,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: "pointer",
          marginTop: 12,
        }}
      >
        <YandexIcon />
        Войти через Яндекс
      </button>

      {/* Divider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          margin: "24px 0",
        }}
      >
        <div style={{ flex: 1, height: 1, background: "#2a2d35" }} />
        <span style={{ fontSize: 12, color: "#555" }}>или</span>
        <div style={{ flex: 1, height: 1, background: "#2a2d35" }} />
      </div>

      {/* Email Magic Link toggle */}
      {!showEmailLogin ? (
        <div style={{ textAlign: "center" }}>
          <button
            onClick={() => setShowEmailLogin(true)}
            style={{
              background: "none",
              border: "none",
              color: "#c9a84c",
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Войти или зарегистрироваться по email
          </button>
        </div>
      ) : (
        <form onSubmit={handleMagicLink}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{ ...inputStyle, marginBottom: 12 }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 10,
              border: "none",
              background: "#c9a84c",
              color: "#0f1114",
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.6 : 1,
              marginBottom: 10,
            }}
          >
            {loading ? (
              <span>
                <span
                  style={{
                    display: "inline-block",
                    width: 16,
                    height: 16,
                    border: "2px solid rgba(15,17,20,0.3)",
                    borderTopColor: "#0f1114",
                    borderRadius: "50%",
                    animation: "spin 0.6s linear infinite",
                    verticalAlign: "middle",
                    marginRight: 8,
                  }}
                />
                Отправляем...
              </span>
            ) : (
              "Получить ссылку"
            )}
          </button>

          <p style={{ fontSize: 12, color: "#555", textAlign: "center", lineHeight: 1.5 }}>
            Мы пришлём ссылку для входа на почту.
          </p>
        </form>
      )}

      {/* Spinner keyframes */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function AuthPage() {
  const [scriptReady, setScriptReady] = useState(false);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f1114",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-body)",
        padding: "24px 16px",
      }}
    >
      <Script
        src="https://telegram.org/js/telegram-widget.js"
        strategy="lazyOnload"
        onLoad={() => setScriptReady(true)}
      />
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "36px 28px",
          background: "#16181d",
          borderRadius: 16,
          border: "1px solid #2a2d35",
        }}
      >
        <Suspense
          fallback={
            <div style={{ textAlign: "center", color: "#555", padding: 40 }}>Загрузка...</div>
          }
        >
          <AuthFormWrapper scriptReady={scriptReady} />
        </Suspense>
      </div>
    </div>
  );
}

function AuthFormWrapper({ scriptReady }: { scriptReady: boolean }) {
  return <AuthForm key="auth" tgScriptReady={scriptReady} />;
}
