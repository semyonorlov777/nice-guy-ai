import { redirect } from "next/navigation";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";

export default async function ResultsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/program/${DEFAULT_PROGRAM_SLUG}/test/results/${id}`);
}
