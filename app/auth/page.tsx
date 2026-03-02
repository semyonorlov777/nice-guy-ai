"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

const D = "var(--font-display)";
const DEFAULT_REDIRECT = "/program/nice-guy/chat";

function TelegramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"form" | "sent">("form");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
        <p style={{ fontSize: 15, color: "#888" }}>Войди или зарегистрируйся</p>
      </div>

      {/* URL error */}
      {urlError && (
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
              : "Ссылка истекла или недействительна. Попробуй ещё раз."}
        </div>
      )}

      {/* Telegram button */}
      <a
        href="/api/auth/telegram"
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
          textDecoration: "none",
          cursor: "pointer",
        }}
      >
        <TelegramIcon />
        Войти через Telegram
      </a>
      <p
        style={{
          fontSize: 12,
          color: "#555",
          textAlign: "center",
          lineHeight: 1.5,
          marginTop: 10,
        }}
      >
        Без пароля. Подтверди вход в приложении Telegram.
      </p>

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
            Войти по email
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

          {error && (
            <p style={{ fontSize: 13, color: "#ef4444", marginBottom: 12 }}>{error}</p>
          )}

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
          <AuthForm />
        </Suspense>
      </div>
    </div>
  );
}
