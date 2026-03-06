import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { PublicHeader } from "@/components/PublicHeader";

export const metadata: Metadata = {
  title: "AI-тренажёры по книгам",
  description: "Платформа AI-тренажёров для работы над собой",
};

interface LandingData {
  book?: { author_top?: string };
}

export default async function CatalogPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: programs } = await supabase
    .from("programs")
    .select("id, slug, title, landing_data, meta_description")
    .order("created_at");

  // For logged-in users, load progress (completed chats per program)
  let progressMap = new Map<string, number>();
  if (user && programs?.length) {
    const { data: chats } = await supabase
      .from("chats")
      .select("program_id")
      .eq("user_id", user.id)
      .eq("status", "completed");

    if (chats) {
      for (const chat of chats) {
        progressMap.set(chat.program_id, (progressMap.get(chat.program_id) || 0) + 1);
      }
    }
  }

  return (
    <div className="catalog-page">
      <PublicHeader />
      <div className="catalog-container">
        <h1 className="catalog-title">Программы</h1>
        <p className="catalog-subtitle">Выбери книгу и начни работу над собой с AI-ассистентом</p>

        <div className="catalog-grid">
          {(programs || []).map((program) => {
            const landing = program.landing_data as LandingData | null;
            const author = landing?.book?.author_top;
            const completed = progressMap.get(program.id) || 0;
            const hasProgress = user && completed > 0;
            const href = user
              ? `/program/${program.slug}/chat`
              : `/program/${program.slug}`;

            return (
              <Link key={program.id} href={href} className="catalog-card">
                <div className="catalog-card-body">
                  <h2 className="catalog-card-title">{program.title}</h2>
                  {author && <div className="catalog-card-author">{author}</div>}
                  {program.meta_description && (
                    <p className="catalog-card-desc">{program.meta_description}</p>
                  )}
                </div>
                <div className="catalog-card-footer">
                  {hasProgress && (
                    <span className="catalog-card-progress">
                      Пройдено: {completed}
                    </span>
                  )}
                  <span className="catalog-card-btn">
                    {hasProgress ? "Продолжить" : "Начать"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
