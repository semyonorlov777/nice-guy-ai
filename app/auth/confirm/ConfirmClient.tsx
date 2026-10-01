"use client";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DEFAULT_REDIRECT, isAllowedRedirect } from "@/lib/constants";

interface ConfirmClientProps {
  /** Программа со своим брендом (практикум): тексты на «вы». */
  formal?: boolean;
}

export function ConfirmClient({ formal = false }: ConfirmClientProps) {
  return (
    <Suspense fallback={<div className="auth-success-page" />}>
      <ConfirmContent formal={formal} />
    </Suspense>
  );
}

function ConfirmContent({ formal }: { formal: boolean }) {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const rawRedirect = searchParams.get("redirect");
  const redirect = isAllowedRedirect(rawRedirect) ? rawRedirect : DEFAULT_REDIRECT;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onConfirm = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, redirect }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setLoading(false);
        setError(
          formal
            ? "Ссылка устарела или уже использована. Запросите новую — мы пришлём свежее письмо."
            : "Ссылка устарела или уже использована. Запроси новую — мы пришлём свежее письмо.",
        );
        return;
      }

      window.location.href = data.redirect || DEFAULT_REDIRECT;
    } catch {
      setLoading(false);
      setError(
        formal
          ? "Не удалось завершить вход. Проверьте интернет и попробуйте ещё раз."
          : "Не удалось завершить вход. Проверь интернет и попробуй ещё раз.",
      );
    }
  }, [code, redirect, formal]);

  if (!code) {
    return (
      <div className="auth-success-page">
        <div className="auth-success-card">
          <h1 className="auth-success-title">Ссылка повреждена</h1>
          <p className="auth-success-text">
            В адресе нет кода входа. {formal ? "Запросите" : "Запроси"} новое письмо на странице входа.
          </p>
          <a
            href={formal ? `/auth?redirect=${encodeURIComponent(redirect)}` : "/auth"}
            className="auth-success-btn"
          >
            На страницу входа
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-success-page">
      <div className="auth-success-card">
        {formal ? (
          <>
            <h1 className="auth-success-title">Подтвердите вход</h1>
            <p className="auth-success-text">
              Нажмите кнопку, чтобы войти в аккаунт. Это нужно, чтобы автоматические
              почтовые проверки не использовали ссылку раньше вас.
            </p>
          </>
        ) : (
          <>
            <h1 className="auth-success-title">Подтверди вход</h1>
            <p className="auth-success-text">
              Нажми кнопку, чтобы войти в аккаунт. Это нужно, чтобы автоматические
              почтовые проверки не &laquo;съели&raquo; ссылку до тебя.
            </p>
          </>
        )}
        {error && (
          <p className="auth-success-text" style={{ color: "#e57373" }}>
            {error}
          </p>
        )}
        <button
          onClick={onConfirm}
          disabled={loading}
          className="auth-success-btn"
        >
          {loading ? "Входим…" : "Войти"}
        </button>
      </div>
    </div>
  );
}
