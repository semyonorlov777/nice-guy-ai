import { redirect } from "next/navigation";

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/program/${slug}/chat`);
}
