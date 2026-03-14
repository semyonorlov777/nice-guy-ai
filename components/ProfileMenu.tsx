"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

interface ProfileMenuProps {
  user: {
    name: string;
    username: string | null;
    avatarUrl: string | null;
  } | null;
  collapsed?: boolean;
}

export function ProfileMenu({ user, collapsed }: ProfileMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  type ThemeMode = "light" | "dark" | "system";
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("theme") as ThemeMode) || "system";
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popupPos, setPopupPos] = useState<{ bottom: number; left: number } | null>(null);

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
    setOpen(false);
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

  const avatarSize = collapsed ? 36 : 28;

  const avatar = user?.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt=""
      style={{ width: avatarSize, height: avatarSize, borderRadius: "50%", flexShrink: 0, objectFit: "cover" }}
    />
  ) : (
    <div
      style={{
        width: avatarSize,
        height: avatarSize,
        borderRadius: "50%",
        background: "var(--accent-soft)",
        border: "1px solid var(--accent-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: collapsed ? 14 : 11,
        fontWeight: 600,
        color: "var(--accent)",
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );

  return (
    <div ref={menuRef} style={{ position: "relative", padding: collapsed ? 0 : 8, borderTop: collapsed ? "none" : "1px solid var(--border-light)" }}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        onClick={() => {
          if (!open && collapsed && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPopupPos({
              bottom: window.innerHeight - rect.top + 4,
              left: rect.right + 8,
            });
          }
          setOpen(!open);
        }}
        title={collapsed ? displayName : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : undefined,
          gap: collapsed ? 0 : 10,
          width: "100%",
          padding: collapsed ? "4px" : "10px 12px",
          borderRadius: "var(--radius-xs)",
          border: "none",
          background: open ? "var(--accent-soft)" : "none",
          cursor: "pointer",
          fontFamily: "var(--font-body)",
          transition: "background 0.12s",
        }}
      >
        {avatar}
        {!collapsed && (
          <>
            <span
              style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 13,
                color: "var(--text-secondary)",
                textAlign: "left",
              }}
            >
              {displayName}
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
              strokeLinecap="round"
              style={{
                flexShrink: 0,
                transition: "transform 0.15s",
                transform: open ? "rotate(180deg)" : undefined,
              }}
            >
              <path d="M4 10L8 6L12 10" />
            </svg>
          </>
        )}
      </button>

      {/* Popup */}
      {open && (
        <div
          style={{
            position: collapsed ? "fixed" : "absolute",
            ...(collapsed && popupPos
              ? { bottom: popupPos.bottom, left: popupPos.left }
              : { bottom: "calc(100% + 4px)", left: 8, right: 8 }),
            width: collapsed ? 200 : undefined,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 -4px 24px rgba(0,0,0,0.12), 0 -1px 4px rgba(0,0,0,0.06)",
            overflow: "hidden",
            zIndex: 100,
            animation: "profileMenuIn 0.15s ease-out",
          }}
        >
          <button
            onClick={() => { setOpen(false); router.push("/balance"); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "12px 16px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 13,
              color: "var(--text-primary)",
              fontFamily: "var(--font-body)",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            <span>Тариф и оплата</span>
          </button>

          <div style={{ height: 1, background: "var(--border-light)", margin: "0 12px" }} />

          <div style={{ padding: "8px 12px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontFamily: "var(--font-body)" }}>Тема</div>
            <div style={{ display: "flex", gap: 4 }}>
              {([
                { mode: "light" as ThemeMode, icon: "\u2600\uFE0F", label: "Светлая" },
                { mode: "dark" as ThemeMode, icon: "\u{1F319}", label: "Тёмная" },
                { mode: "system" as ThemeMode, icon: "\u{1F504}", label: "Система" },
              ]).map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  onClick={() => applyTheme(mode)}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    padding: "6px 4px",
                    border: "none",
                    borderRadius: 8,
                    background: themeMode === mode ? "var(--accent-soft)" : "none",
                    cursor: "pointer",
                    fontSize: 12,
                    color: themeMode === mode ? "var(--accent)" : "var(--text-secondary)",
                    fontFamily: "var(--font-body)",
                    fontWeight: themeMode === mode ? 600 : 400,
                    transition: "all 0.12s",
                  }}
                >
                  <span style={{ fontSize: 13 }}>{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: "var(--border-light)", margin: "0 12px" }} />

          <button
            onClick={handleSignOut}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "12px 16px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 13,
              color: "var(--text-primary)",
              fontFamily: "var(--font-body)",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Выйти</span>
          </button>
        </div>
      )}

      <style>{`@keyframes profileMenuIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
