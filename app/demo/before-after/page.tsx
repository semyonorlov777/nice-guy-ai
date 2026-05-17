import type { Metadata } from "next";
import Link from "next/link";
import { HeroSection } from "@/components/landing/HeroSection";
import { SocialProof } from "@/components/landing/SocialProof";
import { ChatSection } from "@/components/landing/ChatSection";
import { HeroChatSectionE } from "@/components/landing-v2/HeroChatSectionE";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import type { QuickReplyInput } from "@/lib/chat/normalize-quick-replies";
import "../landing-options/demo.css";

export const metadata: Metadata = {
  title: "Демо: до и после nice-guy",
  robots: { index: false, follow: false },
};

const SLUG = "nice-guy";

interface LandingData {
  hero_tag: string;
  hero_title: string;
  hero_subtitle: string;
  hero_cta: string;
  hero_hint: string;
  book: { cover_url: string; alt: string };
  social_proof: { icon: string; main: string; sub: string }[];
  author: { photo_url: string | null; name: string; credentials: string; quote: string };
  chat_header: { title: string; subtitle: string };
  price: { trial_text: string; price_text: string; anchor_text: string };
}

export default async function DemoBeforeAfterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  const svc = createServiceClient();
  const { data: program } = await svc
    .from("programs")
    .select("free_chat_welcome, anonymous_quick_replies, landing_data")
    .eq("slug", SLUG)
    .single();

  const landingData = program?.landing_data as LandingData | null;
  const welcomeMessage = program?.free_chat_welcome || "";
  const anonymousQuickReplies =
    (program?.anonymous_quick_replies as QuickReplyInput[] | null) ?? [];

  if (!landingData) {
    return (
      <div className="demo-ba-page">
        <div className="demo-bar">
          <Link href="/demo/landing-options" className="demo-bar__back">
            ← К другим демо
          </Link>
          <span className="demo-bar__tag">Демо · было/стало</span>
          <span />
        </div>
        <div style={{ padding: 80, textAlign: "center" }}>
          Данные программы <code>{SLUG}</code> не найдены.
        </div>
      </div>
    );
  }

  const chatHref = isLoggedIn ? `/program/${SLUG}/hub` : "#chat-block";
  const hubHref = `/program/${SLUG}/hub`;
  const directChatHref = `/program/${SLUG}/chat`;

  return (
    <div className="landing-v3 demo-landing demo-ba-page">
      <div className="demo-bar">
        <Link href="/demo/landing-options" className="demo-bar__back">
          ← К другим демо
        </Link>
        <span className="demo-bar__tag">
          Демо · было/стало для лендинга nice-guy
        </span>
        <span />
      </div>

      <div className="demo-ba-head">
        <h1 className="demo-ba-head__title">
          Лендинг «No More Mr. Nice Guy» — было и стало
        </h1>
        <p className="demo-ba-head__lead">
          Так выглядел первый экран в текущей версии и так — после переделки.
          Это сравнение для согласования.
        </p>
      </div>

      {/* ── БЫЛО ── */}
      <div className="demo-ba-version demo-ba-version--before">
        <div className="demo-ba-label">
          <span className="demo-ba-label__tag">Было — текущая версия</span>
          <span className="demo-ba-label__sub">
            Первый экран и ближайшие к нему секции с лендинга
          </span>
        </div>

        <HeroSection
          tag={landingData.hero_tag}
          title={landingData.hero_title}
          subtitle={landingData.hero_subtitle}
          cta={landingData.hero_cta}
          hint={landingData.hero_hint}
          ctaHref={chatHref}
          book={landingData.book}
          loggedInHubHref={isLoggedIn ? hubHref : undefined}
        />

        <SocialProof items={landingData.social_proof} />

        <ChatSection
          isLoggedIn={isLoggedIn}
          slug={SLUG}
          chatHeader={landingData.chat_header}
          price={landingData.price}
          welcomeMessage={welcomeMessage}
          quickReplies={anonymousQuickReplies}
        />
      </div>

      {/* ── Разделитель ── */}
      <div className="demo-ba-divider">
        <div className="demo-ba-divider__inner">
          <div className="demo-ba-divider__arrow">↓</div>
          <h2 className="demo-ba-divider__title">а вот стало</h2>
          <p className="demo-ba-divider__sub">
            Чат — на первом экране. Название книги — в H1. Книга, автор,
            сообщество — отдельными блоками слева.
          </p>
        </div>
      </div>

      {/* ── СТАЛО ── */}
      <div className="demo-ba-version demo-ba-version--after">
        <div className="demo-ba-label">
          <span className="demo-ba-label__tag">Стало — новая версия</span>
          <span className="demo-ba-label__sub">
            Сейчас работает на проде — /program/nice-guy
          </span>
        </div>

        <HeroChatSectionE
          programSlug={SLUG}
          eyebrow="✦ Интерактивный тренажёр по бестселлеру"
          title="Хватит быть<br>славным парнем"
          bookCoverUrl={landingData.book.cover_url}
          bookAlt={landingData.book.alt}
          bookStat1="Тираж 2+ млн копий, переведена на 20+ языков"
          bookStat2="Топ ЛитРес · 24 650 отзывов читателей"
          authorPhotoUrl={landingData.author.photo_url}
          authorName="Доктор Роберт Гловер"
          authorCredentials="Клинический психотерапевт, США · 30 лет работает с мужчинами"
          socialProofMain="2 700+ мужчин в русскоязычном сообществе"
          socialProofSub="уже работают по методу Гловера"
          welcomeMessage="Привет. Я тренажёр по методу Роберта Гловера. Помогу перестать жить ради чужого одобрения и начать жить по своим правилам.\n\nРасскажи одну ситуацию: где ты последний раз сказал «да», когда хотел сказать «нет»?"
          quickReplies={[
            { text: "Согласился, когда хотел отказаться" },
            { text: "Промолчал, когда был не согласен" },
            { text: "Сам не понимаю, чего хочу" },
          ]}
          quickReplyLabel="Можно начать с одного из этих:"
          isLoggedIn={isLoggedIn}
          hubHref={hubHref}
          chatHref={directChatHref}
        />
      </div>
    </div>
  );
}
