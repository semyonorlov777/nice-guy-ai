"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AnonymousChat } from "@/components/AnonymousChat";
import { ChatErrorBoundary } from "@/components/ChatErrorBoundary";
import type { QuickReplyInput } from "@/lib/chat/normalize-quick-replies";

interface HeroChatSectionDProps {
  programSlug: string;
  eyebrow: string;
  title: string;
  sub: string;
  bookTitleRus: string;
  bookCoverUrl: string;
  bookAlt: string;
  bookStat1: string;
  bookStat2: string;
  authorPhotoUrl: string | null;
  authorName: string;
  authorCredentials: string;
  socialProofMain: string;
  socialProofSub: string;
  welcomeMessage: string;
  quickReplies: QuickReplyInput[];
  isLoggedIn: boolean;
  hubHref: string;
  chatHref: string;
}

export function HeroChatSectionD({
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
}: HeroChatSectionDProps) {
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
    <section className="nc-hero4">
      <div className="nc-hero4__grid">
        <div className="nc-hero4__intro">
          {/* Сначала — контекст (что это, чья книга, кому уже помогло) */}
          <div className="nc-hero4__eyebrow">{eyebrow}</div>

          <div className="nc-hero4__book">
            <div className="nc-hero4__cover">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bookCoverUrl} alt={bookAlt} />
            </div>
            <div className="nc-hero4__book-meta">
              <div className="nc-hero4__book-title">«{bookTitleRus}»</div>
              <div className="nc-hero4__book-stat">{bookStat1}</div>
              <div className="nc-hero4__book-stat">{bookStat2}</div>
            </div>
          </div>

          <div className="nc-hero4__author">
            {authorPhotoUrl && (
              <div className="nc-hero4__author-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={authorPhotoUrl} alt={authorName} />
              </div>
            )}
            <div className="nc-hero4__author-meta">
              <div className="nc-hero4__author-name">{authorName}</div>
              <div className="nc-hero4__author-creds">{authorCredentials}</div>
            </div>
          </div>

          <div className="nc-hero4__social-proof">
            <div className="nc-hero4__social-main">{socialProofMain}</div>
            <div className="nc-hero4__social-sub">{socialProofSub}</div>
          </div>

          {/* И только потом — крупный заголовок: главное обещание */}
          <h1
            className="nc-hero4__title"
            dangerouslySetInnerHTML={{ __html: title }}
          />

          {sub && <p className="nc-hero4__sub">{sub}</p>}
        </div>

        <div className="nc-hero4__chat-wrap" ref={chatWrapRef}>
          {isLoggedIn ? (
            <div className="nc-hero4__continue">
              <div className="nc-hero4__continue-eyebrow">Ты уже работаешь по программе</div>
              <h2 className="nc-hero4__continue-title">Продолжить там, где остановился</h2>
              <p className="nc-hero4__continue-sub">
                Все упражнения, чаты и портрет ждут тебя в кабинете.
              </p>
              <div className="nc-hero4__continue-actions">
                <Link href={hubHref} className="nc-hero4__primary">
                  В кабинет
                </Link>
                <Link href={chatHref} className="nc-hero4__secondary">
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
