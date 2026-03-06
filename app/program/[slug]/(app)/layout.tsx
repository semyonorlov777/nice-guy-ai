import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { Sidebar } from "@/components/Sidebar";
import { MobileTabs } from "@/components/MobileTabs";

export default async function ProgramLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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
    .select("id, slug, title, features")
    .eq("slug", slug)
    .single();

  if (!program) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, telegram_username, avatar_url")
    .eq("id", user.id)
    .single();

  const userInfo = profile
    ? {
        name: profile.name || "",
        username: profile.telegram_username || null,
        avatarUrl: profile.avatar_url || null,
      }
    : null;

  return (
    <div className="program-layout">
      <Sidebar slug={slug} user={userInfo} features={program.features as Record<string, boolean> | null} />
      <main className="program-main">{children}</main>
      <MobileTabs slug={slug} features={program.features as Record<string, boolean> | null} />
    </div>
  );
}
