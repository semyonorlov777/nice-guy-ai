"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  CreditCardIcon,
  LightningIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  LogoutIcon,
} from "@/components/icons/hub-icons";

interface ProfileMenuProps {
  user: {
    name: string;
    username: string | null;
    avatarUrl: string | null;
  } | null;
  slug: string;
  collapsed?: boolean;
  balance?: number;
}

export function ProfileMenu({ user, slug, collapsed, balance }: ProfileMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  type ThemeMode = "light" | "dark" | "system";
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("theme") as ThemeMode | null;
    if (saved) setThemeMode(saved);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

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

  const displayName = user
    ? user.username ? `@${user.username}` : user.name || "Пользователь"
    : "Пользователь";

  const initial = (user?.name || "?")[0].toUpperCase();

  const themeOptions: { mode: ThemeMode; icon: typeof SunIcon; tooltip: string }[] = [
    { mode: "light", icon: SunIcon, tooltip: "Светлая" },
    { mode: "dark", icon: MoonIcon, tooltip: "Тёмная" },
    { mode: "system", icon: MonitorIcon, tooltip: "Как в системе" },
  ];

  return (
    <div ref={menuRef} className="sidebar-footer">
      {/* Trigger */}
      <button
        className={`sidebar-profile-btn${open ? " active" : ""}`}
        onClick={() => setOpen(!open)}
        title={collapsed ? displayName : undefined}
      >
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="sidebar-avatar" />
        ) : (
          <div className="sidebar-avatar sidebar-avatar-initial">{initial}</div>
        )}
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{displayName}</div>
          <div className="sidebar-user-plan">Свободный</div>
        </div>
        {balance !== undefined && (
          <span className="sidebar-balance"><LightningIcon size={14} /> {balance}</span>
        )}
      </button>

      {/* Dropdown */}
      <div className={`profile-dropdown${open ? " open" : ""}`}>
        <button
          className="pd-item"
          onClick={() => { setOpen(false); router.push(`/program/${slug}/balance`); }}
        >
          <span className="pd-item-icon"><CreditCardIcon size={16} /></span>
          Тариф и оплата
          {balance !== undefined && (
            <span className="pd-item-right"><LightningIcon size={14} /> {balance}</span>
          )}
        </button>

        <div className="pd-divider" />

        <div className="pd-theme-row">
          <span className="pd-theme-label">Тема</span>
          <div className="pd-theme-chips">
            {themeOptions.map(({ mode, icon: Icon, tooltip }) => (
              <button
                key={mode}
                className={`pd-theme-chip${mounted && themeMode === mode ? " active" : ""}`}
                data-tooltip={tooltip}
                onClick={() => applyTheme(mode)}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>

        <div className="pd-divider" />

        <button className="pd-item danger" onClick={handleSignOut}>
          <span className="pd-item-icon"><LogoutIcon size={16} /></span>
          Выйти
        </button>
      </div>
    </div>
  );
}
