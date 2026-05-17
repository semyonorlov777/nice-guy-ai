import { ToolChatPage } from "@/components/program/ToolChatPage";

export default async function ParentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ToolChatPage slug={slug} chatType="ng_parents" />;
}
