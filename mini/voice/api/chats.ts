import { NextResponse } from "next/server";
import { createChat, listChats } from "@mini/voice/lib/repo";

export async function GET() {
  try {
    const chats = await listChats();
    return NextResponse.json({ chats });
  } catch (err) {
    console.error("[voice/chats] list error:", err);
    return NextResponse.json({ error: "Не удалось загрузить чаты" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { title?: string };
    const chat = await createChat(body.title);
    return NextResponse.json({ chat });
  } catch (err) {
    console.error("[voice/chats] create error:", err);
    return NextResponse.json({ error: "Не удалось создать чат" }, { status: 500 });
  }
}
