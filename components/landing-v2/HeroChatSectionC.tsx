"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AnonymousChat } from "@/components/AnonymousChat";
import { ChatErrorBoundary } from "@/components/ChatErrorBoundary";
import type { QuickReplyInput } from "@/lib/chat/normalize-quick-replies";

interface HeroChatSectionCProps {
  programSlug: string;
  eyebrow: string;
  title: string;
  sub: string;
  proofText: string;
  microcopy: string;
  welcomeMessage: string;
  quickReplies: QuickReplyInput[];
  isLoggedIn: boolean;
  hubHref: string;
  chatHref: string;
}

export function HeroChatSectionC({
  programSlug,
  eyebrow,
  title,
  sub,
  proofText,
  microcopy,
  welcomeMessage,
  quickReplies,
  isLoggedIn,
  hubHref,
  chatHref,
}: HeroChatSectionCProps) {
  const chatWrapRef = useRef<HTMLDivElement>(null);

  // Автофокус только на десктопе, чтобы курсор был «живым» signifier
  // (Don Norman, The Design of Everyday Things). На мобиле клавиатура
  // не должна выскакивать сама — пользователь сам тапнет.
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

  return (
    <section className="nc-hero3">
      <div className="nc-hero3__grid">
        {/* Левая колонка — легитимизатор (5 элементов, без обложки и без primary CTA) */}
        <div className="nc-hero3__intro">
          <div className="nc-hero3__intro-top">
            <div className="nc-hero3__eyebrow">{eyebrow}</div>

            <h1
              className="nc-hero3__title"
              dangerouslySetInnerHTML={{ __html: title }}
            />

            <p className="nc-hero3__sub">
              {sub}{" "}
              <span className="nc-hero3__sub-arrow" aria-hidden="true">→</span>
            </p>
          </div>

          <div className="nc-hero3__intro-bottom">
            <div className="nc-hero3__proof">{proofText}</div>
            <div className="nc-hero3__microcopy">{microcopy}</div>
          </div>
        </div>

        {/* Правая колонка — primary action: живой чат */}
        <div className="nc-hero3__chat-wrap" ref={chatWrapRef}>
          {isLoggedIn ? (
            <div className="nc-hero3__continue">
              <div className="nc-hero3__continue-eyebrow">Ты уже работаешь по программе</div>
              <h2 className="nc-hero3__continue-title">Продолжить там, где остановился</h2>
              <p className="nc-hero3__continue-sub">
                Все упражнения, чаты и портрет ждут тебя в кабинете.
              </p>
              <div className="nc-hero3__continue-actions">
                <Link href={hubHref} className="nc-hero3__primary">
                  В кабинет
                </Link>
                <Link href={chatHref} className="nc-hero3__secondary">
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
    </section>
  );
}
