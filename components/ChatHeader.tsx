"use client";

import { useState } from "react";

interface ChatHeaderProps {
  programTitle: string;
  coverUrl: string;
  currentMode: string;
  balance?: number;
  onBack: () => void;
}

const MODES = [
  { icon: "pen", name: "Упражнения с психологом", desc: "AI проведёт через упражнения", premium: true },
  { icon: "clock", name: "Самостоятельная работа", desc: "Методист даст обратную связь", premium: true },
  { icon: "check", name: "Тест ИССП", desc: "35 вопросов · Узнай профиль", premium: false, color: "green" as const },
  { icon: "book", name: "Разговор с автором", desc: "AI в стиле Гловера", premium: true },
  { icon: "chat", name: "Свободный чат", desc: "Просто поговори", premium: false, color: "green" as const },
];

function ModeIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "pen":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
    case "check":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "book":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case "chat":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    default:
      return null;
  }
}

export function ChatHeader({ programTitle, coverUrl, currentMode, balance, onBack }: ChatHeaderProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedModeIndex, setSelectedModeIndex] = useState(() => {
    const idx = MODES.findIndex((m) => m.name === currentMode);
    return idx >= 0 ? idx : MODES.length - 1; // default to last (Свободный чат)
  });

  const displayMode = MODES[selectedModeIndex]?.name || currentMode;

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
        <div className="chat-header-mode">{displayMode}</div>
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
              {MODES.map((mode, i) => (
                <div
                  key={i}
                  className={`mode-panel-item ${i === selectedModeIndex ? "current" : ""}`}
                  onClick={() => {
                    setSelectedModeIndex(i);
                    setIsPanelOpen(false);
                  }}
                >
                  <div className={`mode-panel-icon ${mode.color === "green" ? "green" : "accent"}`}>
                    <ModeIcon icon={mode.icon} />
                  </div>
                  <div className="mode-panel-body">
                    <div className="mode-panel-name">{mode.name}</div>
                    <div className="mode-panel-desc">{mode.desc}</div>
                  </div>
                  {mode.premium && <span className="mode-panel-badge">&#10022;</span>}
                  {i === selectedModeIndex ? (
                    <div className="mode-panel-check">&#10003;</div>
                  ) : (
                    <div className="mode-panel-arrow">&#8250;</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
