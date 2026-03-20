import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { requireProgramFeature } from "@/lib/queries/program";

interface Exercise {
  id: string;
  number: number;
  chapter: number;
  chapter_title: string | null;
  title: string;
  description: string;
}

type ExerciseStatus = "done" | "active" | "locked";

export default async function ExercisesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const program = await requireProgramFeature(supabase, slug, "exercises");

  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, number, chapter, chapter_title, title, description")
    .eq("program_id", program.id)
    .order("number");

  // Get chat statuses for this user's exercises
  const { data: chats } = await supabase
    .from("chats")
    .select("exercise_id, status")
    .eq("user_id", user!.id)
    .eq("program_id", program.id)
    .not("exercise_id", "is", null);

  // Build status map: exercise_id -> status
  const statusMap = new Map<string, ExerciseStatus>();
  if (chats) {
    for (const chat of chats) {
      const current = statusMap.get(chat.exercise_id);
      if (chat.status === "completed") {
        statusMap.set(chat.exercise_id, "done");
      } else if (current !== "done") {
        statusMap.set(chat.exercise_id, "active");
      }
    }
  }

  function getStatus(exerciseId: string): ExerciseStatus {
    return statusMap.get(exerciseId) || "locked";
  }

  // Group exercises by chapter
  const chapters = new Map<number, Exercise[]>();
  for (const ex of exercises || []) {
    if (!chapters.has(ex.chapter)) {
      chapters.set(ex.chapter, []);
    }
    chapters.get(ex.chapter)!.push(ex);
  }

  const sortedChapters = Array.from(chapters.entries()).sort(
    ([a], [b]) => a - b
  );

  return (
    <div className="content-scroll">
      <div className="content-container">
        <div className="page-header">
          <h1>Упражнения</h1>
          <small>
            {sortedChapters.length} глав &middot; {exercises?.length || 0}{" "}
            упражнений
          </small>
        </div>

        {sortedChapters.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">{"📚"}</div>
            <div className="empty-state-title">Упражнения скоро появятся</div>
            <div className="empty-state-text">
              Мы работаем над программой. Пока можешь попробовать свободный чат.
            </div>
          </div>
        )}

        {sortedChapters.map(([chapter, exs]) => {
          const doneCount = exs.filter(
            (e) => getStatus(e.id) === "done"
          ).length;

          return (
            <div key={chapter} className="chapter-group">
              <div className="chapter-header">
                Глава {chapter} &middot; {exs[0]?.chapter_title || ""}
                <span className="chapter-progress">
                  {doneCount} / {exs.length}{" "}
                  {doneCount > 0 ? "\u2713" : ""}
                </span>
              </div>

              {exs.map((ex) => {
                const status = getStatus(ex.id);

                return (
                  <Link
                    key={ex.id}
                    href={`/program/${slug}/exercise/${ex.number}`}
                    className={`exercise-item${status === "active" ? " is-active" : ""}`}
                  >
                    <div
                      className={`ex-status ${
                        status === "done"
                          ? "ex-done"
                          : status === "active"
                            ? "ex-active"
                            : "ex-locked"
                      }`}
                    >
                      {status === "done"
                        ? "\u2713"
                        : status === "active"
                          ? "\u25B6"
                          : ex.number}
                    </div>
                    <div className="ex-info">
                      <div className="ex-title">{ex.title}</div>
                      {status === "active" && (
                        <div className="ex-subtitle">В процессе</div>
                      )}
                    </div>
                    <div className="ex-arrow">&rsaquo;</div>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
