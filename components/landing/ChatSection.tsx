import Link from "next/link";
import { AnonymousChat } from "@/components/AnonymousChat";

interface ChatSectionProps {
  isLoggedIn: boolean;
  slug: string;
  chatHeader: { title: string; subtitle: string };
  price: { trial_text: string; price_text: string; anchor_text: string };
  welcomeMessage: string;
  quickReplies: string[];
}

export function ChatSection({ isLoggedIn, slug, chatHeader, price, welcomeMessage, quickReplies }: ChatSectionProps) {
  return (
    <section className="chat-section" id="chat-block">
      <div className="content-w">
        <div className="chat-header-block">
          <h2>{chatHeader.title}</h2>
          <p>{chatHeader.subtitle}</p>
        </div>

        {isLoggedIn ? (
          <div className="chat-section-placeholder">
            <Link href={`/program/${slug}/chat`} className="chat-login-cta">
              Перейти в чат
            </Link>
          </div>
        ) : welcomeMessage ? (
          <div className="chat-window">
            <AnonymousChat
              programSlug={slug}
              welcomeMessage={welcomeMessage}
              quickReplies={quickReplies}
            />
          </div>
        ) : null}

        <div className="trust-line">
          <span className="trust-item">&#x1F512; Анонимно</span>
          <span className="trial-badge">{price.trial_text}</span>
          <span className="price-after">потом <span className="amt">{price.price_text}</span></span>
        </div>
        <div className="anchor-line">{price.anchor_text}</div>
      </div>
    </section>
  );
}
