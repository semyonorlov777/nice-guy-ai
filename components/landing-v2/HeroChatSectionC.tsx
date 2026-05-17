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
  bookCoverUrl: string;
  bookAlt: string;
  authorName: string;
  authorCredentials: string;
  socialProofText: string;
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
  bookCoverUrl,
  bookAlt,
  authorName,
  authorCredentials,
  socialProofText,
  welcomeMessage,
  quickReplies,
  isLoggedIn,
  hubHref,
  chatHref,
}: HeroChatSectionCProps) {
  const chatWrapRef = useRef<HTMLDivElement>(null);

  // Автофокус на десктопе — курсор в поле ввода виден как «живой» сигнал.
  // На мобиле клавиатура не должна выскакивать сама.
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
        {/* Левая колонка — компактный якорь: что это, для кого, кто стоит, кому уже помогло */}
        <div className="nc-hero3__intro">
          <div className="nc-hero3__intro-top">
            <div className="nc-hero3__eyebrow">{eyebrow}</div>

            <h1
              className="nc-hero3__title"
              dangerouslySetInnerHTML={{ __html: title }}
            />

            <p className="nc-hero3__sub">{sub}</p>
          </div>

          <div className="nc-hero3__intro-bottom">
            {/* Компактная карточка автора с обложкой — привязка к понятному */}
            <div className="nc-hero3__author">
              <div className="nc-hero3__cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bookCoverUrl} alt={bookAlt} />
              </div>
              <div className="nc-hero3__author-meta">
                <div className="nc-hero3__author-name">{authorName}</div>
                <div className="nc-hero3__author-creds">{authorCredentials}</div>
              </div>
            </div>

            {/* Социальное доказательство — одна сильная строка */}
            <div className="nc-hero3__social-proof">{socialProofText}</div>
          </div>
        </div>

        {/* Правая колонка — живой чат, единственное главное действие */}
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
