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
import { FullChatHero } from "@/components/landing-v2/FullChatHero";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import type { QuickReplyInput } from "@/lib/chat/normalize-quick-replies";
import "../demo.css";

export const metadata: Metadata = {
  title: "Демо B: чат во весь первый экран",
  robots: { index: false, follow: false },
};

const SLUG = "nice-guy";
const PROGRAM_TITLE = "No More Mr. Nice Guy";

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

export default async function DemoLandingB() {
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
      <div className="landing-v3">
        <div style={{ padding: 80, textAlign: "center" }}>
          Данные программы <code>{SLUG}</code> не найдены.
        </div>
      </div>
    );
  }

  const hubHref = `/program/${SLUG}/hub`;
  const chatHref = `/program/${SLUG}/chat`;
  const aboutId = "about-program";

  return (
    <div className="landing-v3 demo-landing">
      <div className="demo-bar">
        <Link href="/demo/landing-options" className="demo-bar__back">← Вернуться к вариантам</Link>
        <span className="demo-bar__tag">Вариант B · чат во весь экран</span>
        <Link href="/demo/landing-options#why" className="demo-bar__why">↗ Обоснования</Link>
      </div>

      <FullChatHero
        programSlug={SLUG}
        programTitle={PROGRAM_TITLE}
        welcomeMessage={welcomeMessage}
        quickReplies={anonymousQuickReplies}
        isLoggedIn={isLoggedIn}
        hubHref={hubHref}
        chatHref={chatHref}
        scrollTargetId={aboutId}
      />

      <div id={aboutId} />

      <section className="demo-why-block">
        <div className="demo-why-block__inner">
          <div className="demo-why-block__eyebrow">Что в этом варианте</div>
          <ul className="demo-why-block__list">
            <li>Чат занимает весь первый экран. Ничего рядом.</li>
            <li>Сверху только тонкая полоска: логотип и кнопка «Войти». Под чатом — стрелка «Узнать о программе» для тех, кто хочет сначала почитать.</li>
            <li>Обложка, автор, цена, обещания — всё это есть, но ниже. Найдёт тот, кто стал листать вниз.</li>
          </ul>
          <Link href="/demo/landing-options#why" className="demo-why-block__link">
            Развёрнутое сравнение трёх вариантов — на странице выбора ↗
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
