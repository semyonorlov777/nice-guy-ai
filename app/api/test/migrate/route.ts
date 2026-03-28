import { createClient, createServiceClient } from "@/lib/supabase-server";
import { requireAuth, apiError } from "@/lib/api-helpers";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";
import { getTestConfigByProgram } from "@/lib/queries/test-config";
import type { TestAnswer } from "@/lib/test-scoring";

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
    return apiError("Невалидный session_id", 400);
  }

  // 3. Load test_session
  const serviceClient = createServiceClient();
  const { data: session, error: sessionError } = await serviceClient
    .from("test_sessions")
    .select("*")
    .eq("session_id", session_id)
    .single();

  if (!session || sessionError) {
    return apiError("Сессия теста не найдена", 404);
  }

  // 4. Load program
  const { data: program } = await serviceClient
    .from("programs")
    .select("id")
    .eq("slug", programSlug)
    .single();

  if (!program) {
    return apiError("Программа не найдена", 404);
  }

  // 4.5. Load test config
  const testConfig = await getTestConfigByProgram(programSlug);
  const authWallQuestion = testConfig?.ui_config.auth_wall_question ?? 34;

  // 5. Idempotency: if session already migrated, find the chat created by this migration
  if (session.status === "migrated") {
    const { data: migratedChat } = await supabase
      .from("chats")
      .select("id, test_state")
      .eq("user_id", user.id)
      .eq("program_id", program.id)
      .eq("chat_type", "test")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (migratedChat) {
      const ts = migratedChat.test_state as { current_question?: number } | null;
      return Response.json({
        chat_id: migratedChat.id,
        current_question: ts?.current_question ?? authWallQuestion,
      });
    }

    return apiError("Сессия уже мигрирована или завершена", 400);
  }

  if (session.status !== "in_progress") {
    return apiError("Сессия уже мигрирована или завершена", 400);
  }

  // 6. Complete any existing active test chat (previous incomplete attempt)
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
    await serviceClient
      .from("chats")
      .update({ status: "completed" })
      .eq("id", existingChat.id);
    console.log(`[test:migrate] Completed old test chat ${existingChat.id} for user ${user.id}`);
  }

  const answers = (session.answers || []) as TestAnswer[];
  if (answers.length < authWallQuestion) {
    return apiError(`Недостаточно ответов для миграции (минимум ${authWallQuestion})`, 400);
  }

  // 7. Create chat with test_state
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
    return apiError("Не удалось создать чат", 500);
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
      return apiError("Не удалось перенести сообщения", 500);
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

  // 9. Return chat_id + current_question
  return Response.json({
    chat_id: newChat.id,
    current_question: testState.current_question,
  });
}
