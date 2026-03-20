import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getProgramModes, getLastActiveMode } from "@/lib/queries/modes";
import { HubScreen } from "@/components/hub/HubScreen";

export default async function HubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: program } = await supabase
    .from("programs")
    .select("id, title, landing_data")
    .eq("slug", slug)
    .single();

  if (!program) redirect("/");

  const landingData = program.landing_data as Record<string, unknown> | null;
  const authorName =
    (landingData?.author as Record<string, unknown>)?.name as string ??
    "";
  const coverUrl =
    (landingData?.book as Record<string, unknown>)?.cover_url as string ??
    null;

  const { count: exerciseCount } = await supabase
    .from("exercises")
    .select("id", { count: "exact", head: true })
    .eq("program_id", program.id);

  const [modes, lastActive] = await Promise.all([
    getProgramModes(supabase, program.id),
    getLastActiveMode(supabase, user.id, program.id),
  ]);

  return (
    <HubScreen
      modes={modes}
      lastActive={lastActive}
      program={{
        title: program.title,
        author: authorName,
        coverUrl,
        slug,
        exerciseCount: exerciseCount ?? undefined,
      }}
    />
  );
}
