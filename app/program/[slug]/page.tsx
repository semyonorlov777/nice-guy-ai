"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

interface Program {
  id: string;
  slug: string;
  title: string;
  description: string;
}

interface Exercise {
  id: string;
  number: number;
  title: string;
  description: string;
}

export default function ProgramPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const [program, setProgram] = useState<Program | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/auth");
        return;
      }

      supabase
        .from("programs")
        .select("id, slug, title, description")
        .eq("slug", params.slug)
        .single()
        .then(({ data: prog }) => {
          if (!prog) {
            router.push("/");
            return;
          }

          setProgram(prog);

          supabase
            .from("exercises")
            .select("id, number, title, description")
            .eq("program_id", prog.id)
            .order("number")
            .then(({ data }) => {
              setExercises(data || []);
              setLoading(false);
            });
        });
    });
  }, [router, params.slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-5">
        <button
          onClick={() => router.push("/")}
          className="text-sm text-[#c9a84c] transition hover:underline"
        >
          &larr; Назад
        </button>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900">{program?.title}</h1>
        <p className="mt-2 text-gray-500">{program?.description}</p>

        <div className="mt-8 space-y-3">
          {exercises.length === 0 ? (
            <p className="text-gray-500">Упражнений пока нет</p>
          ) : (
            exercises.map((exercise) => (
              <button
                key={exercise.id}
                onClick={() =>
                  router.push(
                    `/program/${params.slug}/exercise/${exercise.number}`
                  )
                }
                className="flex w-full items-start gap-4 rounded-xl bg-gray-50 p-5 text-left shadow-sm transition hover:shadow-md"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-semibold text-[#c9a84c]">
                  {exercise.number}
                </span>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {exercise.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-500">
                    {exercise.description}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
