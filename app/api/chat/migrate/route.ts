import { createClient, createServiceClient } from "@/lib/supabase-server";

interface MigrateMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  // 1. Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Не авторизован" }, { status: 401 });
  }

  // 2. Parse body
  const { program_slug, messages, session_id } = await request.json();

  if (!program_slug || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Невалидные данные" }, { status: 400 });
  }

  // 3. Find program by slug
  const serviceClient = createServiceClient();
  const { data: program } = await serviceClient
    .from("programs")
    .select("id")
    .eq("slug", program_slug)
    .single();

  if (!program) {
    return Response.json({ error: "Программа не найдена" }, { status: 404 });
  }

  // 4. Check if user already has an active free chat for this program
  const { data: existingChat } = await supabase
    .from("chats")
    .select("id")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .is("exercise_id", null)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (existingChat) {
    // Already has a chat — just redirect there, don't duplicate
    return Response.json({ chat_id: existingChat.id, success: true });
  }

  // 5. Create chat
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .insert({
      user_id: user.id,
      program_id: program.id,
      exercise_id: null,
      status: "active",
    })
    .select("id")
    .single();

  if (chatError || !chat) {
    console.error("[migrate] Failed to create chat:", chatError);
    return Response.json({ error: "Не удалось создать чат" }, { status: 500 });
  }

  // 6. Insert messages with staggered created_at
  const baseTime = new Date();
  const messageRows = (messages as MigrateMessage[]).map(
    (msg: MigrateMessage, i: number) => ({
      chat_id: chat.id,
      role: msg.role,
      content: msg.content,
      tokens_used: 0,
      created_at: new Date(baseTime.getTime() - (messages.length - i) * 1000).toISOString(),
    })
  );

  const { error: insertError } = await serviceClient
    .from("messages")
    .insert(messageRows);

  if (insertError) {
    console.error("[migrate] Failed to insert messages:", insertError);
    return Response.json({ error: "Не удалось сохранить сообщения" }, { status: 500 });
  }

  console.log(
    `[migrate] Migrated ${messages.length} messages for user ${user.id}, session ${session_id}, chat ${chat.id}`
  );

  return Response.json({ chat_id: chat.id, success: true });
}
