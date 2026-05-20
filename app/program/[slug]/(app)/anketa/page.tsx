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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isAnketaProgram(slug)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const facts = await getFacts(supabase, user.id);
  if (isAnketaComplete(facts, slug)) redirect(`/program/${slug}/hub`);

  return (
    <AnketaClient
      slug={slug}
      questions={ANKETA_QUESTIONS[slug]}
      initialFacts={facts}
    />
  );
}
