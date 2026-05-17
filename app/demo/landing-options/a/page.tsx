import type { Metadata } from "next";
import Link from "next/link";
import { SocialProof } from "@/components/landing/SocialProof";
import { OutcomesSection } from "@/components/landing/OutcomesSection";
import { AuthorSection } from "@/components/landing/AuthorSection";
import { PersonasSection } from "@/components/landing/PersonasSection";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { TestSection } from "@/components/landing/TestSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { SiteFooter } from "@/components/SiteFooter";
import { HeroChatSection, type ProofItem } from "@/components/landing-v2/HeroChatSection";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import type { QuickReplyInput } from "@/lib/chat/normalize-quick-replies";
import "../demo.css";

export const metadata: Metadata = {
  title: "Демо A: живой чат в Hero",
  robots: { index: false, follow: false },
};

const SLUG = "nice-guy";

// Тексты Hero — захардкожены для демо, по итогам исследования.
// После согласования финального варианта переедут в БД (programs.landing_data)
// либо в реальный лендинг app/program/[slug]/page.tsx.
const HERO_EYEBROW = "✦ Интерактивный тренажёр по бестселлеру";
const HERO_TITLE =
  "Хватит искать <em>чужого одобрения</em>.<br>Верни контроль над своей жизнью.";
const AUTHOR_NAME = "Доктор Роберт Гловер";
const AUTHOR_CREDENTIALS = "Психотерапевт · США · 30+ лет клинической практики";
const PROOF_ITEMS: ProofItem[] = [
  { icon: "test", text: "Психологический тест — найди свой скрытый паттерн" },
  { icon: "exercises", text: "46 структурированных упражнений из оригинальной книги" },
  { icon: "privacy", text: "Приватное пространство, без осуждения" },
];
const PRICE_TEXT = "Первые 5 сообщений бесплатно · потом 990 ₽/мес · отмена в любой момент";
const CTA_TEXT = "Начать бесплатный разбор";

// Приветствие AI и «ёлочки» — формулировки из исследования,
// бьющие напрямую в боль «славного парня».
const HERO_WELCOME =
  "Привет. Я — цифровой проводник по методу доктора Гловера. Моя задача — помочь тебе перестать угождать в ущерб себе и начать жить по своим правилам.\n\nС чем ты сталкиваешься чаще всего?";
const HERO_QUICK_REPLIES: QuickReplyInput[] = [
  { text: "Боюсь конфликтов и часто уступаю" },
  { text: "Делаю всё для партнёрши, но чувствую себя пустым" },
  { text: "Хочу пройти тест на паттерны «славного парня»" },
];

interface LandingData {
  hero_tag: string;
  hero_title: string;
  hero_subtitle: string;
  book: { cover_url: string; alt: string };
  social_proof: { icon: string; main: string; sub: string }[];
  outcomes: {
    label: string;
    title: string;
    subtitle: string;
    items: { icon: string; title: string; description: string }[];
  };
  problem: { label: string; title: string; lead: string; pain_cards: { title: string; text: string }[] };
  author: { photo_url: string | null; name: string; credentials: string; quote: string };
  personas: { label: string; title: string; items: { headline: string; body: string }[] };
  comparison: {
    label: string;
    title: string;
    subtitle: string;
    columns: { icon: string; name: string; role: string; highlight?: boolean }[];
    rows: { param: string; values: string[]; dim?: number[] }[];
    conclusion: string;
  };
  test?: {
    emoji: string;
    title: string;
    description: string;
    time_label: string;
    questions_label: string;
    cta_text: string;
    cta_href: string;
  };
  how_it_works: {
    label: string;
    title: string;
    steps: { type: "chat" | "exercise" | "insight" | "portrait"; title: string }[];
    summary_text: string;
  };
}

export default async function DemoLandingA() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  const svc = createServiceClient();
  const { data: program } = await svc
    .from("programs")
    .select("landing_data")
    .eq("slug", SLUG)
    .single();

  const landingData = program?.landing_data as LandingData | null;

  if (!landingData) {
    return (
      <div className="landing-v3">
        <div style={{ padding: 80, textAlign: "center" }}>
          Данные программы <code>{SLUG}</code> не найдены.
        </div>
      </div>
    );
  }

  const hubHref = `/program/${SLUG}/hub`;
  const chatHref = `/program/${SLUG}/chat`;

  return (
    <div className="landing-v3 demo-landing">
      <div className="demo-bar">
        <Link href="/demo/landing-options" className="demo-bar__back">← Вернуться к вариантам</Link>
        <span className="demo-bar__tag">Вариант A · живой чат в Hero (v2 — после исследования)</span>
        <Link href="/demo/landing-options#why" className="demo-bar__why">↗ Обоснования</Link>
      </div>

      <HeroChatSection
        programSlug={SLUG}
        eyebrow={HERO_EYEBROW}
        title={HERO_TITLE}
        authorName={AUTHOR_NAME}
        authorCredentials={AUTHOR_CREDENTIALS}
        bookCoverUrl={landingData.book.cover_url}
        bookAlt={landingData.book.alt}
        proofItems={PROOF_ITEMS}
        priceText={PRICE_TEXT}
        ctaText={CTA_TEXT}
        welcomeMessage={HERO_WELCOME}
        quickReplies={HERO_QUICK_REPLIES}
        isLoggedIn={isLoggedIn}
        hubHref={hubHref}
        chatHref={chatHref}
      />

      <section className="demo-why-block">
        <div className="demo-why-block__inner">
          <div className="demo-why-block__eyebrow">Главное в этом варианте</div>
          <ul className="demo-why-block__list">
            <li>Двухколоночный Hero: видны и обложка/автор/цена, и активный чат — привычная структура лендинга.</li>
            <li>Крупная кнопка-мост «Начать разбор» — клик фокусирует поле ввода в чате справа и подсвечивает его пульсацией.</li>
            <li>Регалии автора («Доктор Гловер, 30+ лет практики») и цена 990 ₽/мес — для тех, кто привык к явным сигналам до клика.</li>
          </ul>
          <Link href="/demo/landing-options#why" className="demo-why-block__link">
            Полное обоснование — на странице выбора ↗
          </Link>
        </div>
      </section>

      <SocialProof items={landingData.social_proof} />

      <OutcomesSection
        label={landingData.outcomes.label}
        title={landingData.outcomes.title}
        subtitle={landingData.outcomes.subtitle}
        items={landingData.outcomes.items}
      />

      <AuthorSection
        photo_url={landingData.author.photo_url}
        name={landingData.author.name}
        credentials={landingData.author.credentials}
        quote={landingData.author.quote}
      />

      <PersonasSection
        label={landingData.problem.label}
        title={landingData.problem.title}
        lead={landingData.problem.lead}
        items={landingData.personas.items}
      />

      <ComparisonSection
        label={landingData.comparison.label}
        title={landingData.comparison.title}
        subtitle={landingData.comparison.subtitle}
        columns={landingData.comparison.columns}
        rows={landingData.comparison.rows}
        conclusion={landingData.comparison.conclusion}
      />

      {landingData.test && (
        <TestSection
          emoji={landingData.test.emoji}
          title={landingData.test.title}
          description={landingData.test.description}
          time_label={landingData.test.time_label}
          questions_label={landingData.test.questions_label}
          cta_text={landingData.test.cta_text}
          cta_href={landingData.test.cta_href}
        />
      )}

      <HowItWorksSection
        label={landingData.how_it_works.label}
        title={landingData.how_it_works.title}
        steps={landingData.how_it_works.steps}
        summary_text={landingData.how_it_works.summary_text}
      />

      <SiteFooter variant="program" />
    </div>
  );
}
