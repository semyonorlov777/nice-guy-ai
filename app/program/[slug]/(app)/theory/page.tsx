import { ToolChatPage } from "@/components/program/ToolChatPage";

export default async function TheoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ToolChatPage slug={slug} chatType="ng_theory" />;
}
