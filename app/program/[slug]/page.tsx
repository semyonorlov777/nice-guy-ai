import type { Metadata } from "next";
import Link from "next/link";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { HeroSection } from "@/components/landing/HeroSection";
import { SocialProof } from "@/components/landing/SocialProof";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { SolutionSection } from "@/components/landing/SolutionSection";
import { AnonymousChat } from "@/components/AnonymousChat";
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
    author_top: string;
    title: string;
    subtitle: string;
    author_bottom: string;
  };
  social_proof: { icon: string; number: string; label: string }[];
  problem: {
    label: string;
    title: string;
    lead: string;
    pain_cards: { icon: string; title: string; text: string }[];
  };
  comparison: {
    title: string;
    items: {
      emoji: string;
      title: string;
      text: string;
      tag: string;
      tag_color: string;
      highlight?: boolean;
    }[];
  };
  solution: {
    label: string;
    title: string;
    subtitle: string;
    features: { icon: string; title: string; text: string }[];
    positioning: string;
  };
  chat_header: {
    title: string;
    subtitle: string;
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
  const authHref = isLoggedIn ? `/program/${slug}/chat` : "/auth";

  // If no landing_data, fall back to a minimal layout
  if (!landingData) {
    return (
      <div className="landing" style={{ minHeight: "100vh", background: "#0f1114", color: "#e0e0e0" }}>
        <div style={{ padding: "120px 24px 60px", maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 40, marginBottom: 16 }}>
            Программа
          </h1>
          <p style={{ color: "#8a8a8a", marginBottom: 32 }}>Данные лендинга не найдены.</p>
          <Link href={authHref} style={{ padding: "14px 32px", background: "#c9a84c", color: "#0f1114", borderRadius: 10, textDecoration: "none", fontWeight: 600 }}>
            {isLoggedIn ? "В приложение" : "Войти"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="landing landing-v2">
      <LandingHeader
        ctaText={isLoggedIn ? "В приложение" : "Попробовать бесплатно"}
        ctaHref={authHref}
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

      <ProblemSection
        label={landingData.problem.label}
        title={landingData.problem.title}
        lead={landingData.problem.lead}
        painCards={landingData.problem.pain_cards}
        comparison={landingData.comparison}
      />

      <SolutionSection
        label={landingData.solution.label}
        title={landingData.solution.title}
        subtitle={landingData.solution.subtitle}
        features={landingData.solution.features}
        positioning={landingData.solution.positioning}
      />

      <div className="landing-chat-section" id="chat-block" data-theme="dark">
        {!isLoggedIn && welcomeMessage ? (
          <AnonymousChat
            programSlug={slug}
            welcomeMessage={welcomeMessage}
            quickReplies={anonymousQuickReplies}
            scrollToSectionId="chat-block"
            headerTitle={landingData.chat_header.title}
            headerSubtitle={landingData.chat_header.subtitle}
          />
        ) : isLoggedIn ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Link
              href={`/program/${slug}/chat`}
              className="btn-primary"
            >
              Перейти в чат
            </Link>
          </div>
        ) : null}
      </div>

    </div>
  );
}
