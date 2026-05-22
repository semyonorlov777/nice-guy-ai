import { NextResponse } from "next/server";
import { addMessage, getChat, listMessages, deleteChat, renameChat } from "@mini/voice/lib/repo";

interface RouteContext {
  params: Promise<{ chatId: string }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { chatId } = await ctx.params;
  try {
    const chat = await getChat(chatId);
    if (!chat) return NextResponse.json({ error: "Чат не найден" }, { status: 404 });
    const messages = await listMessages(chatId);
    return NextResponse.json({ chat, messages });
  } catch (err) {
    console.error("[voice/messages] get error:", err);
    return NextResponse.json({ error: "Не удалось загрузить сообщения" }, { status: 500 });
  }
}

export async function POST(request: Request, ctx: RouteContext) {
  const { chatId } = await ctx.params;
  try {
    const body = (await request.json()) as { text?: string; audio_duration_sec?: number };
    const text = (body.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "Пустой текст" }, { status: 400 });

    const chat = await getChat(chatId);
    if (!chat) return NextResponse.json({ error: "Чат не найден" }, { status: 404 });

    const message = await addMessage({
      chat_id: chatId,
      source: "web",
      text,
      audio_duration_sec: body.audio_duration_sec ?? null,
    });
    return NextResponse.json({ message });
  } catch (err) {
    console.error("[voice/messages] post error:", err);
    return NextResponse.json({ error: "Не удалось сохранить сообщение" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { chatId } = await ctx.params;
  try {
    await deleteChat(chatId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[voice/messages] delete error:", err);
    return NextResponse.json({ error: "Не удалось удалить чат" }, { status: 500 });
  }
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const { chatId } = await ctx.params;
  try {
    const body = (await request.json()) as { title?: string };
    const title = (body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "Пустое название" }, { status: 400 });
    await renameChat(chatId, title);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[voice/messages] patch error:", err);
    return NextResponse.json({ error: "Не удалось переименовать" }, { status: 500 });
  }
}
