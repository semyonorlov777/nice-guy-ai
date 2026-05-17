import { ToolChatPage } from "@/components/program/ToolChatPage";

export default async function SyndromePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ToolChatPage slug={slug} chatType="ng_my_syndrome" />;
}
