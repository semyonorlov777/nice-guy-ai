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
    .select("id, slug, title")
    .eq("slug", slug)
    .single();

  if (!program) redirect("/");

  return (
    <div className="program-layout">
      <Sidebar slug={slug} />
      <main className="program-main">{children}</main>
      <MobileTabs slug={slug} />
    </div>
  );
}
