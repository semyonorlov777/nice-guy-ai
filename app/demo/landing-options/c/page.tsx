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
import { HeroChatSectionC } from "@/components/landing-v2/HeroChatSectionC";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import type { QuickReplyInput } from "@/lib/chat/normalize-quick-replies";
import "../demo.css";

export const metadata: Metadata = {
  title: "Демо C: chat-first (синтез исследований)",
  robots: { index: false, follow: false },
};

const SLUG = "nice-guy";

// Тексты левой карточки — синтез двух исследований.
// Приоритет — рекомендации Claude Research, опирающиеся на NN/g, Cialdini,
// Wroblewski, Baymard, Pernice. Из Gemini взяты только формулировки приветствия
// и тон «ёлочек».
const HERO_EYEBROW = "AI-тренажёр · 46 практик";
const HERO_TITLE =
  'Перестань быть «<em>хорошим парнем</em>».<br>Стань тем, кем хотел.';
const HERO_SUB =
  "46 упражнений и AI-диалог по методу Роберта Гловера — автора книги, переведённой на 20+ языков, тираж 2+ млн копий.";
const HERO_PROOF =
  "Психотест из 35 вопросов · Goodreads 4,04★ (24 650 оценок)";
const HERO_MICROCOPY =
  "Без регистрации. Первые 5 сообщений AI — бесплатно.";

// Приветствие AI — открытое приглашение (NN/g: не фиксированный поток с выбором,
// а свободный вход в диалог). Прозрачность про AI — в первой строке
// (Nature 2025: «transparency reduces skepticism»).
const HERO_WELCOME =
  "Привет. Я — AI-симулятор, обученный на методе доктора Гловера. Расскажи, что в твоей жизни сейчас не работает так, как ты хочешь — с этого и начнём.";

// «Ёлочки» — конкретные ситуации из жизни мужчины, не философские темы.
// Снижение порога входа до одного клика (Wroblewski: gradual engagement).
const HERO_QUICK_REPLIES: QuickReplyInput[] = [
  { text: "Жена не уважает, хотя я делаю всё", type: "default" },
  { text: "Не могу отказать на работе", type: "default" },
  { text: "Не понимаю, чего хочу сам", type: "default" },
];

interface LandingData {
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

export default async function DemoLandingC() {
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
        <span className="demo-bar__tag">Вариант C · chat-first (синтез исследований)</span>
      </div>

      {/* Мини-шапка: «Войти» в правом верхнем углу страницы (Claude Research,
          14 из 16 проанализированных AI-сайтов). Вне Hero-карточки, чтобы
          не конкурировать с input справа за внимание. */}
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

      <HeroChatSectionC
        programSlug={SLUG}
        eyebrow={HERO_EYEBROW}
        title={HERO_TITLE}
        sub={HERO_SUB}
        proofText={HERO_PROOF}
        microcopy={HERO_MICROCOPY}
        welcomeMessage={HERO_WELCOME}
        quickReplies={HERO_QUICK_REPLIES}
        isLoggedIn={isLoggedIn}
        hubHref={hubHref}
        chatHref={chatHref}
      />

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
