"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { AuthSheet } from "@/components/AuthSheet";
import { DEFAULT_REDIRECT } from "@/lib/constants";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Сессия авторизации истекла. Попробуй ещё раз.",
  missing_verifier: "Сессия авторизации истекла. Попробуй ещё раз.",
  telegram_auth_failed: "Не удалось войти через Telegram. Попробуй ещё раз.",
  token_exchange_failed: "Не удалось войти через Telegram. Попробуй ещё раз.",
  yandex_auth_failed: "Не удалось войти через Яндекс. Попробуй ещё раз.",
  yandex_missing_code: "Не удалось войти через Яндекс. Попробуй ещё раз.",
  yandex_session_failed: "Не удалось войти через Яндекс. Попробуй ещё раз.",
};

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="auth-sheet-fullscreen-wrap" />}>
      <AuthPageContent />
    </Suspense>
  );
}

function AuthPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectTo = searchParams.get("redirect") || DEFAULT_REDIRECT;
  const isPopup = searchParams.get("popup") === "true";
  const provider = searchParams.get("provider");
  const urlError = searchParams.get("error");

  const [checked, setChecked] = useState(false);

  // Уже авторизован → redirect (popup или обычный)
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        if (isPopup) {
          window.location.href = "/auth/popup-success";
        } else {
          router.replace(redirectTo);
        }
      } else {
        setChecked(true);
      }
    });
  }, [isPopup, router, redirectTo]);

  // Provider auto-redirect (Яндекс в popup)
  useEffect(() => {
    if (provider === "yandex" && isPopup) {
      window.location.href = `/api/auth/yandex?popup=true&redirect=${encodeURIComponent(redirectTo)}`;
    }
  }, [provider, isPopup, redirectTo]);

  // Popup mode или проверка auth — пустой экран пока идёт redirect
  if (isPopup || !checked) {
    return <div className="auth-sheet-fullscreen-wrap" />;
  }

  const errorMessage = urlError
    ? ERROR_MESSAGES[urlError] || "Ссылка истекла или недействительна. Попробуй ещё раз."
    : undefined;

  return (
    <AuthSheet
      mode="fullscreen"
      context="default"
      open={true}
      onSuccess={() => router.push(redirectTo)}
      redirectTo={redirectTo}
      initialError={errorMessage}
    />
  );
}
