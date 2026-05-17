"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnonymousChat } from "@/components/AnonymousChat";
import { ChatErrorBoundary } from "@/components/ChatErrorBoundary";
import { AuthSheet } from "@/components/AuthSheet";
import type { QuickReplyInput } from "@/lib/chat/normalize-quick-replies";

interface FullChatHeroProps {
  programSlug: string;
  programTitle: string;
  welcomeMessage: string;
  quickReplies: QuickReplyInput[];
  isLoggedIn: boolean;
  hubHref: string;
  chatHref: string;
  scrollTargetId: string;
}

export function FullChatHero({
  programSlug,
  programTitle,
  welcomeMessage,
  quickReplies,
  isLoggedIn,
  hubHref,
  chatHref,
  scrollTargetId,
}: FullChatHeroProps) {
  const [authOpen, setAuthOpen] = useState(false);
  const chatWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoggedIn) return;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (isMobile) return;
    const t = setTimeout(() => {
      const el = chatWrapRef.current?.querySelector<HTMLTextAreaElement>(".input-textarea");
      el?.focus({ preventScroll: true });
    }, 250);
    return () => clearTimeout(t);
  }, [isLoggedIn]);

  function handleScrollDown(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="nc-fullchat">
      <header className="nc-fullchat__bar">
        <Link href="/" className="nc-fullchat__brand">
          <span className="nc-fullchat__brand-mark">К</span>
          <span className="nc-fullchat__brand-text">
            Тренажёр по «{programTitle}»
          </span>
        </Link>
        <div className="nc-fullchat__bar-right">
          {isLoggedIn ? (
            <Link href={hubHref} className="nc-fullchat__login">
              В кабинет →
            </Link>
          ) : (
            <button
              type="button"
              className="nc-fullchat__login"
              onClick={() => setAuthOpen(true)}
            >
              Войти
            </button>
          )}
        </div>
      </header>

      <div className="nc-fullchat__main">
        <div className="nc-fullchat__chat-wrap" ref={chatWrapRef}>
          {isLoggedIn ? (
            <div className="nc-fullchat__continue">
              <div className="nc-fullchat__continue-eyebrow">
                Ты уже работаешь по программе
              </div>
              <h1 className="nc-fullchat__continue-title">
                Продолжить там, где остановился
              </h1>
              <p className="nc-fullchat__continue-sub">
                Все упражнения, чаты и портрет ждут тебя в кабинете.
              </p>
              <div className="nc-fullchat__continue-actions">
                <Link href={hubHref} className="nc-fullchat__primary">
                  В кабинет
                </Link>
                <Link href={chatHref} className="nc-fullchat__secondary">
                  Открыть чат
                </Link>
              </div>
            </div>
          ) : (
            <ChatErrorBoundary>
              <AnonymousChat
                programSlug={programSlug}
                welcomeMessage={welcomeMessage}
                quickReplies={quickReplies}
              />
            </ChatErrorBoundary>
          )}
        </div>

        <a
          href={`#${scrollTargetId}`}
          className="nc-fullchat__scroll-hint"
          onClick={handleScrollDown}
        >
          <span>Узнать о программе</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
        </a>
      </div>

      <AuthSheet
        mode="sheet"
        context="default"
        open={authOpen}
        onSuccess={() => {
          window.location.href = hubHref;
        }}
        onClose={() => setAuthOpen(false)}
      />
    </section>
  );
}
