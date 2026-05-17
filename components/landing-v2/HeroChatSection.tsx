"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnonymousChat } from "@/components/AnonymousChat";
import { ChatErrorBoundary } from "@/components/ChatErrorBoundary";
import { AuthSheet } from "@/components/AuthSheet";
import type { QuickReplyInput } from "@/lib/chat/normalize-quick-replies";

interface HeroChatSectionProps {
  programSlug: string;
  eyebrow: string;
  title: string;
  authorName: string;
  authorCredentials: string;
  bookCoverUrl: string;
  bookAlt: string;
  socialProofText?: string;
  ctaText: string;
  welcomeMessage: string;
  quickReplies: QuickReplyInput[];
  isLoggedIn: boolean;
  hubHref: string;
  chatHref: string;
}

export function HeroChatSection({
  programSlug,
  eyebrow,
  title,
  authorName,
  authorCredentials,
  bookCoverUrl,
  bookAlt,
  socialProofText,
  ctaText,
  welcomeMessage,
  quickReplies,
  isLoggedIn,
  hubHref,
  chatHref,
}: HeroChatSectionProps) {
  const [authOpen, setAuthOpen] = useState(false);
  const chatWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoggedIn) return;
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    if (isMobile) return;
    const t = setTimeout(() => {
      const el = chatWrapRef.current?.querySelector<HTMLTextAreaElement>(".input-textarea");
      el?.focus({ preventScroll: true });
    }, 250);
    return () => clearTimeout(t);
  }, [isLoggedIn]);

  function handleStartClick() {
    const wrap = chatWrapRef.current;
    if (!wrap) return;
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    if (isMobile) {
      wrap.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const textarea = wrap.querySelector<HTMLTextAreaElement>(".input-textarea");
    textarea?.focus({ preventScroll: isMobile });
    const inputContainer = wrap.querySelector(".input-container");
    if (inputContainer) {
      inputContainer.classList.remove("input-pulse");
      // reflow → перезапустит CSS-анимацию
      void (inputContainer as HTMLElement).offsetWidth;
      inputContainer.classList.add("input-pulse");
      setTimeout(() => inputContainer.classList.remove("input-pulse"), 1800);
    }
  }

  return (
    <section className="nc-hero2">
      <div className="nc-hero2__grid">
        <div className="nc-hero2__intro">
          <div className="nc-hero2__eyebrow">{eyebrow}</div>

          <h1
            className="nc-hero2__title"
            dangerouslySetInnerHTML={{ __html: title }}
          />

          <div className="nc-hero2__author-row">
            <div className="nc-hero2__cover">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bookCoverUrl} alt={bookAlt} />
            </div>
            <div className="nc-hero2__author-meta">
              <div className="nc-hero2__author-name">{authorName}</div>
              <div className="nc-hero2__author-creds">{authorCredentials}</div>
            </div>
          </div>

          {socialProofText && (
            <div className="nc-hero2__social-proof">{socialProofText}</div>
          )}

          <div className="nc-hero2__cta-block">
            {isLoggedIn ? (
              <Link href={hubHref} className="nc-hero2__primary">
                В кабинет →
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  className="nc-hero2__primary"
                  onClick={handleStartClick}
                >
                  {ctaText} <span aria-hidden="true">→</span>
                </button>
                <button
                  type="button"
                  className="nc-hero2__login-link"
                  onClick={() => setAuthOpen(true)}
                >
                  У меня уже есть аккаунт →
                </button>
              </>
            )}
          </div>
        </div>

        <div className="nc-hero2__chat-wrap" ref={chatWrapRef}>
          {isLoggedIn ? (
            <div className="nc-hero2__continue">
              <div className="nc-hero2__continue-eyebrow">Ты уже работаешь по программе</div>
              <h2 className="nc-hero2__continue-title">Продолжить там, где остановился</h2>
              <p className="nc-hero2__continue-sub">
                Все упражнения, чаты и портрет ждут тебя в кабинете.
              </p>
              <div className="nc-hero2__continue-actions">
                <Link href={hubHref} className="nc-hero2__primary">
                  В кабинет
                </Link>
                <Link href={chatHref} className="nc-hero2__secondary">
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
