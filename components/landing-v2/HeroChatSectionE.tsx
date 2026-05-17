"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AnonymousChat } from "@/components/AnonymousChat";
import { ChatErrorBoundary } from "@/components/ChatErrorBoundary";
import type { QuickReplyInput } from "@/lib/chat/normalize-quick-replies";

// Вариант E на базе A: H1 = название книги.
// В блоке книги (карточка с обложкой) название убрано — оно теперь крупно
// сверху, дублировать не нужно. Освобождает воздух.

interface HeroChatSectionEProps {
  programSlug: string;
  eyebrow: string;
  title: string;
  // Книга — только обложка и статистика, без названия
  bookCoverUrl: string;
  bookAlt: string;
  bookStat1: string;
  bookStat2: string;
  // Автор
  authorPhotoUrl: string | null;
  authorName: string;
  authorCredentials: string;
  // Соцдоказательство
  socialProofMain: string;
  socialProofSub: string;
  // Чат
  welcomeMessage: string;
  quickReplies: QuickReplyInput[];
  quickReplyLabel: string;
  isLoggedIn: boolean;
  hubHref: string;
  chatHref: string;
}

export function HeroChatSectionE({
  programSlug,
  eyebrow,
  title,
  bookCoverUrl,
  bookAlt,
  bookStat1,
  bookStat2,
  authorPhotoUrl,
  authorName,
  authorCredentials,
  socialProofMain,
  socialProofSub,
  welcomeMessage,
  quickReplies,
  quickReplyLabel,
  isLoggedIn,
  hubHref,
  chatHref,
}: HeroChatSectionEProps) {
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

  return (
    <section className="nc-hero5">
      <div className="nc-hero5__grid">
        <div className="nc-hero5__intro">
          <div className="nc-hero5__eyebrow">{eyebrow}</div>

          <h1
            className="nc-hero5__title"
            dangerouslySetInnerHTML={{ __html: title }}
          />

          {/* Блок книги — без названия (оно теперь сверху как H1) */}
          <div className="nc-hero5__book">
            <div className="nc-hero5__cover">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bookCoverUrl} alt={bookAlt} />
            </div>
            <div className="nc-hero5__book-meta">
              <div className="nc-hero5__book-stat">{bookStat1}</div>
              <div className="nc-hero5__book-stat">{bookStat2}</div>
            </div>
          </div>

          {/* Блок автора */}
          <div className="nc-hero5__author">
            {authorPhotoUrl && (
              <div className="nc-hero5__author-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={authorPhotoUrl} alt={authorName} />
              </div>
            )}
            <div className="nc-hero5__author-meta">
              <div className="nc-hero5__author-name">{authorName}</div>
              <div className="nc-hero5__author-creds">{authorCredentials}</div>
            </div>
          </div>

          {/* Блок соцдоказательства */}
          <div className="nc-hero5__social-proof">
            <div className="nc-hero5__social-main">{socialProofMain}</div>
            <div className="nc-hero5__social-sub">{socialProofSub}</div>
          </div>
        </div>

        <div className="nc-hero5__chat-wrap" ref={chatWrapRef}>
          {isLoggedIn ? (
            <div className="nc-hero5__continue">
              <div className="nc-hero5__continue-eyebrow">Ты уже работаешь по программе</div>
              <h2 className="nc-hero5__continue-title">Продолжить там, где остановился</h2>
              <p className="nc-hero5__continue-sub">
                Все упражнения, чаты и портрет ждут тебя в кабинете.
              </p>
              <div className="nc-hero5__continue-actions">
                <Link href={hubHref} className="nc-hero5__primary">
                  В кабинет
                </Link>
                <Link href={chatHref} className="nc-hero5__secondary">
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
                quickReplyLabel={quickReplyLabel}
              />
            </ChatErrorBoundary>
          )}
        </div>
      </div>
    </section>
  );
}
