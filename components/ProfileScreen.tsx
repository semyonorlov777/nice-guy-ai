"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import {
  LightningIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  LogoutIcon,
  ArrowRightIcon,
  UserIcon,
} from "@/components/icons/hub-icons";

const GENITIVE_MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function formatPortraitDate(iso: string | null): string {
  if (!iso) return "Обновлён недавно";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Обновлён недавно";
  return `Обновлён ${d.getDate()} ${GENITIVE_MONTHS[d.getMonth()]}`;
}

export interface ProfileScreenProps {
  slug: string;
  isAuthed: boolean;
  name: string;
  avatarUrl: string | null;
  balance: number;
  planLabel: string;
  hasSubscription: boolean;
  hasPortrait: boolean;
  portraitUpdatedAt: string | null;
  debugState?: string | null;
}

export function ProfileScreen({
  slug,
  isAuthed,
  name,
  avatarUrl,
  balance,
  planLabel,
  hasSubscription,
  hasPortrait,
  portraitUpdatedAt,
  debugState,
}: ProfileScreenProps) {
  const router = useRouter();
  const debugMode = !!debugState;
  const [imgError, setImgError] = useState(false);
  const [mounted, setMounted] = useState(false);

  type ThemeMode = "light" | "dark" | "system";
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("theme") as ThemeMode | null;
    if (saved) setThemeMode(saved);
  }, []);

  const applyTheme = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem("theme", mode);
    if (mode === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else if (mode === "light") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    }
  }, []);

  // React to system theme changes in real time
  useEffect(() => {
    if (themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themeMode]);

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth");
  }, [router]);

  const initial = isAuthed ? (name || "П")[0].toUpperCase() : "Я";

  const themeOptions: { mode: ThemeMode; icon: typeof SunIcon; tooltip: string }[] = [
    { mode: "light", icon: SunIcon, tooltip: "Светлая" },
    { mode: "dark", icon: MoonIcon, tooltip: "Тёмная" },
    { mode: "system", icon: MonitorIcon, tooltip: "Как в системе" },
  ];

  const showAvatar = avatarUrl && !imgError;

  const debugStates = [
    { key: "auth", label: "Авторизован + портрет" },
    { key: "empty", label: "Авторизован, пусто" },
    { key: "anon", label: "Аноним" },
    { key: "sub", label: "С подпиской" },
  ];

  return (
    <div className="profile-screen">

      {/* ═══ DEBUG BAR ═══ */}
      {debugMode && (
        <div className="profile-debug-bar">
          <span className="profile-debug-label">СОСТОЯНИЕ:</span>
          {debugStates.map((s) => (
            <button
              key={s.key}
              className={`profile-debug-btn${debugState === s.key ? " on" : ""}`}
              onClick={() => router.push(`/program/${slug}/profile?state=${s.key}`)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* ═══ AVATAR + NAME + PLAN ═══ */}
      <div className="profile-header">
        <div className="profile-identity">
          {showAvatar ? (
            <div className="profile-avatar photo">
              <img
                src={avatarUrl}
                alt=""
                onError={() => setImgError(true)}
              />
            </div>
          ) : (
            <div className="profile-avatar neutral">{initial}</div>
          )}
          <div className="profile-info">
            <div className="profile-name">{name}</div>
            <div className="profile-plan">{planLabel}</div>
          </div>
        </div>

        {/* ═══ BALANCE CARD ═══ */}
        <div className="profile-balance-card">
          <div className="profile-balance-left">
            <div className="profile-balance-label">Баланс сообщений</div>
            <div className="profile-balance-value">
              <LightningIcon size={18} />
              {balance}
            </div>
          </div>
          {isAuthed && (
            <Link
              href={`/program/${slug}/balance`}
              className="profile-balance-btn"
            >
              {hasSubscription ? "Управление" : "Тарифы"}
            </Link>
          )}
        </div>
      </div>

      {/* ═══ SECTION GAP ═══ */}
      <div className="profile-section-gap" />

      {/* ═══ PORTRAIT CARD / AUTH CTA ═══ */}
      {isAuthed ? (
        <div className="profile-portrait-wrap">
          <Link
            href={`/program/${slug}/portrait`}
            className={`profile-portrait-card${hasPortrait ? "" : " empty"}`}
          >
            <div className={`profile-portrait-orb${hasPortrait ? "" : " empty"}`}>
              <UserIcon size={20} />
            </div>
            <div className="profile-portrait-body">
              <div className={`profile-portrait-title${hasPortrait ? "" : " muted"}`}>
                Мой портрет
              </div>
              <div className="profile-portrait-meta">
                {hasPortrait
                  ? formatPortraitDate(portraitUpdatedAt)
                  : "Появится после первого упражнения или теста"}
              </div>
            </div>
            <div className="profile-portrait-arrow">
              <ArrowRightIcon size={18} />
            </div>
          </Link>
        </div>
      ) : (
        <div className="profile-auth-cta">
          <div className="profile-auth-cta-title">
            Войдите, чтобы сохранить прогресс
          </div>
          <div className="profile-auth-cta-desc">
            Портрет, история чатов и баланс сохранятся после авторизации
          </div>
          <Link href="/auth" className="profile-auth-cta-btn">
            Войти
          </Link>
        </div>
      )}

      {/* ═══ SECTION GAP ═══ */}
      <div className="profile-section-gap" />

      {/* ═══ SETTINGS ═══ */}
      <div className="profile-settings">
        <div className="profile-settings-label">Настройки</div>

        <div className="profile-settings-row">
          <div className="profile-settings-icon">
            <SunIcon size={18} />
          </div>
          <div className="profile-settings-text">Тема</div>
          <div className="profile-theme-chips">
            {themeOptions.map(({ mode, icon: Icon, tooltip }) => (
              <button
                key={mode}
                className={`profile-theme-chip${mounted && themeMode === mode ? " active" : ""}`}
                title={tooltip}
                onClick={() => applyTheme(mode)}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>

        {isAuthed && (
          <div className="profile-logout-wrap">
            <button className="profile-logout-btn" onClick={handleSignOut}>
              <LogoutIcon size={18} />
              Выйти
            </button>
          </div>
        )}
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}
