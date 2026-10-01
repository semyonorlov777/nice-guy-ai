"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { AuthSheet } from "@/components/AuthSheet";
import { DEFAULT_REDIRECT, isAllowedRedirect } from "@/lib/constants";
import type { AuthProvider } from "@/lib/queries/program-brand";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Сессия авторизации истекла. Попробуй ещё раз.",
  missing_verifier: "Сессия авторизации истекла. Попробуй ещё раз.",
  telegram_auth_failed: "Не удалось войти через Telegram. Попробуй ещё раз.",
  token_exchange_failed: "Не удалось войти через Telegram. Попробуй ещё раз.",
  yandex_auth_failed: "Не удалось войти через Яндекс. Попробуй ещё раз.",
  yandex_missing_code: "Не удалось войти через Яндекс. Попробуй ещё раз.",
  yandex_session_failed: "Не удалось войти через Яндекс. Попробуй ещё раз.",
};

// Тексты ошибок на «вы» — для программ со своим брендом.
const ERROR_MESSAGES_FORMAL: Record<string, string> = {
  invalid_state: "Время на вход истекло. Попробуйте ещё раз.",
  missing_verifier: "Время на вход истекло. Попробуйте ещё раз.",
  yandex_auth_failed: "Не удалось войти через Яндекс. Попробуйте ещё раз.",
  yandex_missing_code: "Не удалось войти через Яндекс. Попробуйте ещё раз.",
  yandex_session_failed: "Не удалось войти через Яндекс. Попробуйте ещё раз.",
};

interface AuthPageClientProps {
  /** Своё название программы вместо бренда платформы. */
  brandName?: string;
  /** Разрешённые способы входа; не задано — все. */
  providers?: AuthProvider[];
}

export function AuthPageClient(props: AuthPageClientProps) {
  return (
    <Suspense fallback={<div className="auth-sheet-fullscreen-wrap" />}>
      <AuthPageContent {...props} />
    </Suspense>
  );
}

function AuthPageContent({ brandName, providers }: AuthPageClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawRedirect = searchParams.get("redirect");
  const redirectTo = isAllowedRedirect(rawRedirect) ? rawRedirect : DEFAULT_REDIRECT;
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
          const popupUrl = redirectTo && redirectTo !== DEFAULT_REDIRECT
            ? `/auth/popup-success?redirect=${encodeURIComponent(redirectTo)}`
            : "/auth/popup-success";
          window.location.href = popupUrl;
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

  const errorMessage = !urlError
    ? undefined
    : brandName
      ? ERROR_MESSAGES_FORMAL[urlError] || "Ссылка устарела или недействительна. Попробуйте ещё раз."
      : ERROR_MESSAGES[urlError] || "Ссылка истекла или недействительна. Попробуй ещё раз.";

  return (
    <AuthSheet
      mode="fullscreen"
      context="default"
      open={true}
      onSuccess={() => router.push(redirectTo)}
      redirectTo={redirectTo}
      initialError={errorMessage}
      brandName={brandName}
      providers={providers}
    />
  );
}
