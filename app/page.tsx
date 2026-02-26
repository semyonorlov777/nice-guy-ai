"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

interface Program {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover_url: string | null;
}

export default function HomePage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
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
        .select("id, slug, title, description, cover_url")
        .order("created_at")
        .then(({ data }) => {
          setPrograms(data || []);
          setLoading(false);
        });
    });
  }, [router]);

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
        <h1 className="text-xl font-bold text-gray-900">Nice Guy AI</h1>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <h2 className="mb-6 text-lg font-semibold text-gray-900">Программы</h2>

        {programs.length === 0 ? (
          <p className="text-gray-500">Программ пока нет</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {programs.map((program) => (
              <button
                key={program.id}
                onClick={() => router.push(`/program/${program.slug}`)}
                className="rounded-xl bg-gray-50 p-6 text-left shadow-sm transition hover:shadow-md"
              >
                <h3 className="font-semibold text-gray-900">{program.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  {program.description}
                </p>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
