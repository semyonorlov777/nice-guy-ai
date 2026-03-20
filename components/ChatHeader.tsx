"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useModes } from "@/contexts/ModesContext";
import { getModeIcon } from "@/components/hub/mode-icons";

interface ChatHeaderProps {
  programTitle: string;
  coverUrl: string;
  currentMode: string;
  currentModeKey?: string;
  balance?: number;
  onBack: () => void;
  slug?: string;
}

export function ChatHeader({
  programTitle,
  coverUrl,
  currentMode,
  currentModeKey,
  balance,
  onBack,
  slug,
}: ChatHeaderProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const router = useRouter();
  const { modes } = useModes();

  const handleModeClick = (routeSuffix: string) => {
    if (!slug) return;
    setIsPanelOpen(false);
    router.push(`/program/${slug}${routeSuffix}`);
  };

  return (
    <div className="chat-header">
      <button className="chat-header-back" onClick={onBack}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <div className="chat-header-cover">
        <img src={coverUrl} alt="" />
      </div>

      <div className="chat-header-info">
        <div className="chat-header-mode">{currentMode}</div>
        <div className="chat-header-book">{programTitle}</div>
      </div>

      <button
        className={`chat-header-switcher ${isPanelOpen ? "active" : ""}`}
        onClick={() => setIsPanelOpen(!isPanelOpen)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </button>

      {balance !== undefined && (
        <div className="chat-header-balance">&#9889; {balance}</div>
      )}

      {isPanelOpen && (
        <>
          <div className="mode-panel-scrim" onClick={() => setIsPanelOpen(false)} />
          <div className="mode-panel">
            <div className="mode-panel-title">Режимы работы</div>
            <div className="mode-panel-list">
              {modes.map((mode) => {
                const isCurrent = currentModeKey
                  ? mode.key === currentModeKey
                  : mode.name === currentMode;
                const isComingSoon = !!mode.config?.coming_soon;
                const iconColorClass = mode.access_type === "paid" ? "accent" : "green";

                return (
                  <div
                    key={mode.key}
                    className={`mode-panel-item ${isCurrent ? "current" : ""} ${isComingSoon ? "coming-soon" : ""}`}
                    onClick={() => {
                      if (!isComingSoon) handleModeClick(mode.route_suffix);
                    }}
                  >
                    <div className={`mode-panel-icon ${iconColorClass}`}>
                      {getModeIcon(mode.icon)}
                    </div>
                    <div className="mode-panel-body">
                      <div className="mode-panel-name">{mode.name}</div>
                      {mode.description && (
                        <div className="mode-panel-desc">{mode.description}</div>
                      )}
                    </div>
                    {mode.access_type === "paid" && !isComingSoon && (
                      <span className="mode-panel-badge">&#10022;</span>
                    )}
                    {isComingSoon && (
                      <span className="mode-panel-badge coming-soon">Скоро</span>
                    )}
                    {isCurrent ? (
                      <div className="mode-panel-check">&#10003;</div>
                    ) : !isComingSoon ? (
                      <div className="mode-panel-arrow">&#8250;</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {slug && (
              <div
                className="mode-panel-hub-link"
                onClick={() => {
                  setIsPanelOpen(false);
                  router.push(`/program/${slug}/hub`);
                }}
              >
                Все режимы и прогресс
                <span className="mode-panel-hub-arrow">&#8250;</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
