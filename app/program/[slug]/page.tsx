import type { Metadata } from "next";
import Link from "next/link";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { HeroSection } from "@/components/landing/HeroSection";
import { SocialProof } from "@/components/landing/SocialProof";
import { OutcomesSection } from "@/components/landing/OutcomesSection";
import { AuthorSection } from "@/components/landing/AuthorSection";
import { PersonasSection } from "@/components/landing/PersonasSection";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { TestSection } from "@/components/landing/TestSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { ChatSection } from "@/components/landing/ChatSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { createClient, createServiceClient } from "@/lib/supabase-server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const svc = createServiceClient();
  const { data: program } = await svc
    .from("programs")
    .select("meta_title, meta_description")
    .eq("slug", slug)
    .single();

  return {
    title: program?.meta_title || "AI-тренажёры по книгам",
    description: program?.meta_description || "Платформа AI-тренажёров для работы над собой",
  };
}

interface LandingData {
  hero_tag: string;
  hero_title: string;
  hero_subtitle: string;
  hero_cta: string;
  hero_hint: string;
  book: {
    cover_url: string;
    alt: string;
  };
  social_proof: { icon: string; main: string; sub: string }[];
  outcomes: {
    label: string;
    title: string;
    subtitle: string;
    items: { icon: string; title: string; description: string }[];
  };
  problem: {
    label: string;
    title: string;
    lead: string;
    pain_cards: { title: string; text: string }[];
  };
  author: {
    photo_url: string | null;
    name: string;
    credentials: string;
    quote: string;
  };
  personas: {
    label: string;
    title: string;
    items: { headline: string; body: string }[];
  };
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
  chat_header: {
    title: string;
    subtitle: string;
  };
  price: {
    trial_text: string;
    price_text: string;
    anchor_text: string;
  };
}

export default async function ProgramLanding({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  const svc = createServiceClient();
  const { data: program } = await svc
    .from("programs")
    .select("free_chat_welcome, anonymous_quick_replies, landing_data")
    .eq("slug", slug)
    .single();

  const landingData = program?.landing_data as LandingData | null;
  const welcomeMessage = program?.free_chat_welcome || "";
  const anonymousQuickReplies = (program?.anonymous_quick_replies as string[]) || [];

  const chatHref = isLoggedIn ? `/program/${slug}/chat` : "#chat-block";

  // If no landing_data, fall back to a minimal layout
  if (!landingData) {
    return (
      <div className="landing-v3" style={{ minHeight: "100vh" }}>
        <div style={{ padding: "120px 24px 60px", maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 40, marginBottom: 16 }}>
            Программа
          </h1>
          <p style={{ color: "#9E9B93", marginBottom: 32 }}>Данные лендинга не найдены.</p>
          <Link href={isLoggedIn ? `/program/${slug}/chat` : "/auth"} style={{ padding: "14px 32px", background: "#C9963B", color: "#fff", borderRadius: 10, textDecoration: "none", fontWeight: 600 }}>
            {isLoggedIn ? "В приложение" : "Войти"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-v3">
      <LandingHeader
        ctaText={isLoggedIn ? "В приложение" : "Начать бесплатно"}
        ctaHref={chatHref}
      />

      <HeroSection
        tag={landingData.hero_tag}
        title={landingData.hero_title}
        subtitle={landingData.hero_subtitle}
        cta={landingData.hero_cta}
        hint={landingData.hero_hint}
        ctaHref={chatHref}
        book={landingData.book}
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

      <ChatSection
        isLoggedIn={isLoggedIn}
        slug={slug}
        chatHeader={landingData.chat_header}
        price={landingData.price}
        welcomeMessage={welcomeMessage}
        quickReplies={anonymousQuickReplies}
      />

      <LandingFooter />
    </div>
  );
}
