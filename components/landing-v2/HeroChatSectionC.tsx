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
  // Книга
  bookTitleRus: string;
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
  bookTitleRus,
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
  isLoggedIn,
  hubHref,
  chatHref,
}: HeroChatSectionCProps) {
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
    <section className="nc-hero3">
      <div className="nc-hero3__grid">
        <div className="nc-hero3__intro">
          <div className="nc-hero3__intro-top">
            <div className="nc-hero3__eyebrow">{eyebrow}</div>

            <h1
              className="nc-hero3__title"
              dangerouslySetInnerHTML={{ __html: title }}
            />

            {sub && <p className="nc-hero3__sub">{sub}</p>}
          </div>

          <div className="nc-hero3__intro-bottom">
            {/* Блок книги — обложка + название по-русски + статистика */}
            <div className="nc-hero3__book">
              <div className="nc-hero3__cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bookCoverUrl} alt={bookAlt} />
              </div>
              <div className="nc-hero3__book-meta">
                <div className="nc-hero3__book-title">«{bookTitleRus}»</div>
                <div className="nc-hero3__book-stat">{bookStat1}</div>
                <div className="nc-hero3__book-stat">{bookStat2}</div>
              </div>
            </div>

            {/* Блок автора — фото + имя + регалии */}
            <div className="nc-hero3__author">
              {authorPhotoUrl && (
                <div className="nc-hero3__author-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={authorPhotoUrl} alt={authorName} />
                </div>
              )}
              <div className="nc-hero3__author-meta">
                <div className="nc-hero3__author-name">{authorName}</div>
                <div className="nc-hero3__author-creds">{authorCredentials}</div>
              </div>
            </div>

            {/* Социальное доказательство — цифра + контекст */}
            <div className="nc-hero3__social-proof">
              <div className="nc-hero3__social-main">{socialProofMain}</div>
              <div className="nc-hero3__social-sub">{socialProofSub}</div>
            </div>
          </div>
        </div>

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
