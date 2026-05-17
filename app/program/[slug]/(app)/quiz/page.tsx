import { ToolChatPage } from "@/components/program/ToolChatPage";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ToolChatPage slug={slug} chatType="ng_quiz" />;
}
