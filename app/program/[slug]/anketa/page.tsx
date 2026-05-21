import { createClient } from "@/lib/supabase-server";
import { getFacts } from "@/lib/personalization";
import {
  ANKETA_QUESTIONS,
  isAnketaProgram,
  isAnketaComplete,
} from "@/lib/anketa/questions";
import { notFound, redirect } from "next/navigation";
import { AnketaClient } from "./client";

export default async function AnketaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  if (!isAnketaProgram(slug)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const facts = await getFacts(supabase, user.id);
  // Полная анкета редиректит на хаб — кроме случая ?edit=1 (пользователь
  // явно зашёл редактировать ответы со страницы портрета).
  const isEditMode = query.edit === "1";
  if (!isEditMode && isAnketaComplete(facts, slug)) {
    redirect(`/program/${slug}/hub`);
  }

  return (
    <AnketaClient
      slug={slug}
      questions={ANKETA_QUESTIONS[slug]}
      initialFacts={facts}
    />
  );
}
