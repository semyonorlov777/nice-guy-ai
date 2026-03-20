import { createClient, createServiceClient } from "@/lib/supabase-server";
import { requireAuth } from "@/lib/api-helpers";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";
import type { TestAnswer } from "@/lib/issp-scoring";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  // 1. Auth required
  const supabase = await createClient();
  const { user, response } = await requireAuth(supabase);
  if (response) return response;

  // 2. Parse and validate body
  const body = await request.json();
  const { session_id, program_slug: rawProgramSlug } = body;
  const programSlug: string = (typeof rawProgramSlug === "string" && rawProgramSlug) ? rawProgramSlug : DEFAULT_PROGRAM_SLUG;

  if (!session_id || !UUID_RE.test(session_id)) {
    return Response.json(
      { error: "Невалидный session_id" },
      { status: 400 }
    );
  }

  // 3. Load test_session
  const serviceClient = createServiceClient();
  const { data: session, error: sessionError } = await serviceClient
    .from("test_sessions")
    .select("*")
    .eq("session_id", session_id)
    .single();

  if (!session || sessionError) {
    return Response.json(
      { error: "Сессия теста не найдена" },
      { status: 404 }
    );
  }

  // 4. Load program
  const { data: program } = await serviceClient
    .from("programs")
    .select("id")
    .eq("slug", programSlug)
    .single();

  if (!program) {
    return Response.json(
      { error: "Программа не найдена" },
      { status: 404 }
    );
  }

  // 5. Check for existing active test chat FIRST (idempotency)
  // This handles: double doMigrate, cross-tab auth, page refresh after migration
  const { data: existingChat } = await supabase
    .from("chats")
    .select("id")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .eq("chat_type", "test")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (existingChat) {
    // Session may still be "in_progress" if this is a retry — mark it migrated
    if (session.status === "in_progress") {
      await serviceClient
        .from("test_sessions")
        .update({ status: "migrated", updated_at: new Date().toISOString() })
        .eq("session_id", session_id);
    }
    return Response.json({ chat_id: existingChat.id });
  }

  // 6. Now check session status — only proceed if in_progress
  if (session.status !== "in_progress") {
    return Response.json(
      { error: "Сессия уже мигрирована или завершена" },
      { status: 400 }
    );
  }

  const answers = (session.answers || []) as TestAnswer[];
  if (answers.length < 34) {
    return Response.json(
      { error: "Недостаточно ответов для миграции (минимум 34)" },
      { status: 400 }
    );
  }

  // 6. Create chat with test_state
  const testState = {
    current_question: session.current_question as number,
    status: "in_progress",
    started_at: session.created_at as string,
    answers,
  };

  const { data: newChat, error: chatError } = await supabase
    .from("chats")
    .insert({
      user_id: user.id,
      program_id: program.id,
      chat_type: "test",
      status: "active",
      test_state: testState,
    })
    .select("id")
    .single();

  if (chatError || !newChat) {
    console.error("[test:migrate] Failed to create chat:", chatError);
    return Response.json(
      { error: "Не удалось создать чат" },
      { status: 500 }
    );
  }

  // 7. Bulk insert messages with staggered created_at
  const sessionMessages = (session.messages || []) as Array<{
    role: string;
    content: string;
  }>;

  if (sessionMessages.length > 0) {
    const baseTime = new Date(session.created_at as string);
    const messageRows = sessionMessages.map(
      (msg: { role: string; content: string }, idx: number) => ({
        chat_id: newChat.id,
        role: msg.role,
        content: msg.content,
        tokens_used: 0,
        created_at: new Date(baseTime.getTime() + idx * 1000).toISOString(),
      })
    );

    const { error: insertError } = await serviceClient
      .from("messages")
      .insert(messageRows);

    if (insertError) {
      console.error(
        "[test:migrate] Failed to insert messages:",
        insertError
      );
      return Response.json(
        { error: "Не удалось перенести сообщения" },
        { status: 500 }
      );
    }
  }

  // 8. Mark test_session as migrated
  await serviceClient
    .from("test_sessions")
    .update({
      status: "migrated",
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", session_id);

  console.log(
    `[test:migrate] Migrated session ${session_id} → chat ${newChat.id} for user ${user.id} (${answers.length} answers, ${sessionMessages.length} messages)`
  );

  // 9. Return chat_id
  return Response.json({ chat_id: newChat.id });
}
