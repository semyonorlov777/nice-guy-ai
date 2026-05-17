import type { Metadata } from "next";
import Link from "next/link";
import { OutcomesSection } from "@/components/landing/OutcomesSection";
import { AuthorSection } from "@/components/landing/AuthorSection";
import { PersonasSection } from "@/components/landing/PersonasSection";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { TestSection } from "@/components/landing/TestSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { SiteFooter } from "@/components/SiteFooter";
import { HeroChatSection } from "@/components/landing-v2/HeroChatSection";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import type { QuickReplyInput } from "@/lib/chat/normalize-quick-replies";
import "../demo.css";

export const metadata: Metadata = {
  title: "Демо A: живой чат в Hero",
  robots: { index: false, follow: false },
};

const SLUG = "nice-guy";

// Тексты Hero — захардкожены для демо. После согласования переедут в БД.
const HERO_EYEBROW = "✦ Интерактивный тренажёр по бестселлеру";
const HERO_TITLE =
  'Перестань быть «<em>хорошим парнем</em>».<br>Стань тем, кем хотел.';

// Блок книги — название по-русски (русское издание), статистика книги.
const BOOK_TITLE_RUS = "Хватит быть славным парнем";
const BOOK_STAT_1 = "Тираж 2+ млн копий, переведена на 20+ языков";
const BOOK_STAT_2 = "Топ ЛитРес · 24 650 отзывов читателей";

// Блок автора — кто, регалии. Имя отдельной строкой, регалии — без воды.
const AUTHOR_NAME = "Доктор Роберт Гловер";
const AUTHOR_CREDENTIALS =
  "Клинический психотерапевт, США · 30 лет работает с мужчинами";

// Социальное доказательство — про сообщество (на основе реальных цифр:
// Telegram-канал 400+, группа 2.1к, регулярные встречи). Двухстрочное:
// крупная цифра + контекст.
const SOCIAL_MAIN = "2 700+ мужчин в русскоязычном сообществе";
const SOCIAL_SUB = "уже работают по методу Гловера";

// Приветствие — короткое. Регалии автора уже в карточке слева.
// Слово «AI» в видимых текстах не используем (проектный принцип:
// AI/ИИ обесценивают премиальный продукт). Просто «тренажёр».
const HERO_WELCOME =
  "Привет. Я тренажёр по методу Роберта Гловера.\n\nРасскажи одну ситуацию: где ты последний раз сказал «да», когда хотел сказать «нет»?";

const HERO_QUICK_REPLIES: QuickReplyInput[] = [
  { text: "Согласился, когда хотел отказаться" },
  { text: "Промолчал, когда был не согласен" },
  { text: "Сам не понимаю, чего хочу" },
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
  const authHref = `/auth?redirect=${encodeURIComponent(hubHref)}`;

  return (
    <div className="landing-v3 demo-landing">
      <div className="demo-bar">
        <Link href="/demo/landing-options" className="demo-bar__back">← Вернуться к вариантам</Link>
        <span className="demo-bar__tag">Вариант A · крупные блоки</span>
        <Link href="/demo/landing-options#why" className="demo-bar__why">↗ Обоснования</Link>
      </div>

      <header className="nc-hero3__page-header">
        <Link href="/" className="nc-hero3__page-brand">
          <span className="nc-hero3__page-brand-mark">К</span>
          <span className="nc-hero3__page-brand-text">Книжный Спарринг</span>
        </Link>
        {!isLoggedIn && (
          <Link href={authHref} className="nc-hero3__page-login">
            Войти →
          </Link>
        )}
      </header>

      <HeroChatSection
        programSlug={SLUG}
        eyebrow={HERO_EYEBROW}
        title={HERO_TITLE}
        bookTitleRus={BOOK_TITLE_RUS}
        bookCoverUrl={landingData.book.cover_url}
        bookAlt={landingData.book.alt}
        bookStat1={BOOK_STAT_1}
        bookStat2={BOOK_STAT_2}
        authorPhotoUrl={landingData.author.photo_url}
        authorName={AUTHOR_NAME}
        authorCredentials={AUTHOR_CREDENTIALS}
        socialProofMain={SOCIAL_MAIN}
        socialProofSub={SOCIAL_SUB}
        welcomeMessage={HERO_WELCOME}
        quickReplies={HERO_QUICK_REPLIES}
        isLoggedIn={isLoggedIn}
        hubHref={hubHref}
        chatHref={chatHref}
      />

      <section className="demo-why-block">
        <div className="demo-why-block__inner">
          <div className="demo-why-block__eyebrow">Что в этом варианте</div>
          <ul className="demo-why-block__list">
            <li>Три отдельных блока слева: книга, автор, сообщество. То же что в C, но крупнее — обложка больше, фото автора больше, цифра соцдока крупнее.</li>
            <li>Чат справа — единственное действие. Без отдельной кнопки «начать»: само поле ввода — и есть приглашение.</li>
            <li>«Войти» — сверху страницы. Подходит, если важно, чтобы блоки про книгу/автора/сообщество были крупно видны и убедительны до того, как человек начнёт писать.</li>
          </ul>
          <Link href="/demo/landing-options#why" className="demo-why-block__link">
            Развёрнутое сравнение вариантов — на странице выбора ↗
          </Link>
        </div>
      </section>

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
