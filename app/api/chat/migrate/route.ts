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

  // 4. Idempotency: check if this session was already migrated recently
  // Look for an active free chat created in the last 2 minutes with matching message count
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: recentChat } = await supabase
    .from("chats")
    .select("id")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .is("exercise_id", null)
    .in("chat_type", ["free", null])
    .eq("status", "active")
    .gte("created_at", twoMinAgo)
    .limit(1)
    .maybeSingle();

  if (recentChat) {
    // Check if it has the same number of messages (likely a duplicate migration)
    const { count } = await serviceClient
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("chat_id", recentChat.id);

    if (count === messages.length) {
      console.log(
        `[migrate] Idempotent: session ${session_id} already migrated to chat ${recentChat.id}`
      );
      return Response.json({ chat_id: recentChat.id, success: true });
    }
  }

  // 5. Close ALL existing active free chats for this user+program
  const { data: existingChats } = await supabase
    .from("chats")
    .select("id")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .is("exercise_id", null)
    .in("chat_type", ["free", null])
    .eq("status", "active");

  if (existingChats && existingChats.length > 0) {
    const chatIds = existingChats.map((c) => c.id);
    await serviceClient
      .from("chats")
      .update({ status: "completed" })
      .in("id", chatIds);
    console.log(`[migrate] Closed ${chatIds.length} existing free chat(s) for user ${user.id}`);
  }

  // 6. Create new chat (no welcome message — anonymous chat already showed it)
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .insert({
      user_id: user.id,
      program_id: program.id,
      exercise_id: null,
      status: "active",
      chat_type: "free",
      title: messages[0]?.content?.slice(0, 50) || "Анонимный чат",
    })
    .select("id")
    .single();

  if (chatError || !chat) {
    console.error("[migrate] Failed to create chat:", chatError);
    return Response.json({ error: "Не удалось создать чат" }, { status: 500 });
  }

  // 7. Insert messages with staggered created_at
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

  // 8. Update last_message_at on the new chat
  await supabase
    .from("chats")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", chat.id);

  console.log(
    `[migrate] Migrated ${messages.length} messages for user ${user.id}, session ${session_id}, chat ${chat.id}`
  );

  return Response.json({ chat_id: chat.id, success: true });
}
