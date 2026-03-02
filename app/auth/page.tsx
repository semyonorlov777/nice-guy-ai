"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

const D = "var(--font-display)";
const DEFAULT_REDIRECT = "/program/nice-guy/chat";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"form" | "sent">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [countdown, setCountdown] = useState(0);

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

  const handlePasswordLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setLoading(false);

      if (error) {
        setError(error.message);
        return;
      }

      router.push(redirectTo);
    },
    [email, password, redirectTo, router],
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

  const btnStyle = {
    width: "100%",
    padding: "14px",
    borderRadius: 10,
    border: "none",
    background: "#c9a84c",
    color: "#0f1114",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
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
            ...btnStyle,
            opacity: countdown > 0 || loading ? 0.5 : 1,
            cursor: countdown > 0 || loading ? "default" : "pointer",
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
      <div style={{ textAlign: "center", marginBottom: 32 }}>
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
          Ссылка истекла или недействительна. Попробуй ещё раз.
        </div>
      )}

      {/* Magic Link form */}
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

        {error && !showPasswordLogin && (
          <p style={{ fontSize: 13, color: "#ef4444", marginBottom: 12 }}>{error}</p>
        )}

        <button type="submit" disabled={loading} style={{ ...btnStyle, opacity: loading ? 0.6 : 1, marginBottom: 12 }}>
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
            "Продолжить"
          )}
        </button>

        <p style={{ fontSize: 12, color: "#555", textAlign: "center", lineHeight: 1.5 }}>
          Без пароля. Мы пришлём ссылку для входа на почту.
        </p>
      </form>

      {/* Password fallback */}
      <div style={{ marginTop: 28, borderTop: "1px solid #2a2d35", paddingTop: 20 }}>
        {!showPasswordLogin ? (
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: 13, color: "#555" }}>Уже есть пароль? </span>
            <button
              onClick={() => setShowPasswordLogin(true)}
              style={{
                background: "none",
                border: "none",
                color: "#c9a84c",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Войти по паролю
            </button>
          </div>
        ) : (
          <form onSubmit={handlePasswordLogin}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{ ...inputStyle, marginBottom: 10 }}
            />
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{ ...inputStyle, marginBottom: 12 }}
            />

            {error && showPasswordLogin && (
              <p style={{ fontSize: 13, color: "#ef4444", marginBottom: 12 }}>{error}</p>
            )}

            <button type="submit" disabled={loading} style={{ ...btnStyle, opacity: loading ? 0.6 : 1, background: "transparent", border: "1.5px solid #c9a84c", color: "#c9a84c" }}>
              {loading ? "Вход..." : "Войти"}
            </button>
          </form>
        )}
      </div>

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
