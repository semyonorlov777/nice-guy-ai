import * as Sentry from "@sentry/nextjs";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import type { TestConfig } from "@/lib/test-config";
import { getTestConfig, getTestConfigByProgram } from "@/lib/queries/test-config";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";
import { createRateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-helpers";
import { UUID_RE } from "@/lib/test-helpers";
import { handleTypedAnswer } from "./_handlers/typed-answer";
import { handleAnonymous } from "./_handlers/anonymous";
import { handleAuthenticated } from "./_handlers/authenticated";

export const maxDuration = 60;

// ── Rate limiting (anonymous only) ──

const checkRateLimit = createRateLimit();

// ── GET handler: restore anonymous session ──

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId || !UUID_RE.test(sessionId)) {
    return apiError("Невалидный session_id", 400);
  }

  const serviceClient = createServiceClient();
  const { data: session } = await serviceClient
    .from("test_sessions")
    .select("messages, current_question, status")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!session || session.status !== "in_progress") {
    return apiError("Сессия не найдена или завершена", 404);
  }

  return Response.json({
    messages: session.messages || [],
    current_question: session.current_question,
    status: session.status,
  });
}

// ── Main handler ──

export async function POST(request: Request) {
  // 1. Soft auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. Parse body
  const body = await request.json();
  const { message, test_slug, answer_type, answer: quickAnswer, answer_text, question_index, program_slug: rawProgramSlug } = body;

  // Load test config: prefer test_slug (direct), fallback to program_slug
  let testConfig: TestConfig | null = null;
  if (typeof test_slug === "string" && test_slug) {
    testConfig = await getTestConfig(test_slug);
  }
  if (!testConfig) {
    const programSlug: string = (typeof rawProgramSlug === "string" && rawProgramSlug) ? rawProgramSlug : DEFAULT_PROGRAM_SLUG;
    testConfig = await getTestConfigByProgram(programSlug);
  }
  if (!testConfig) {
    return apiError("Тест не найден", 404);
  }

  const totalQuestions = testConfig.total_questions;

  // answer_type validation
  if (answer_type && !["quick", "text"].includes(answer_type)) {
    return apiError("Неизвестный answer_type", 400);
  }
  if (answer_type && (typeof question_index !== "number" || question_index < 0 || question_index >= totalQuestions)) {
    return apiError("Невалидный question_index", 400);
  }
  if (answer_type === "quick") {
    const score = typeof quickAnswer === "number" ? quickAnswer : Number(message);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return apiError("answer должен быть 1-5", 400);
    }
  }

  // message validation — only required when no answer_type
  if (!answer_type) {
    if (
      !message ||
      typeof message !== "string" ||
      message.length === 0 ||
      message.length > 5000
    ) {
      return apiError("Невалидное сообщение (пусто или >5000 символов)", 400);
    }
  }

  const isAuthenticated = !!user;
  if (user) {
    Sentry.setUser({ id: user.id });
  } else if (body.session_id) {
    Sentry.setUser({ id: `anon:${body.session_id}` });
  }

  // 3. Load program & service client
  const serviceClient = createServiceClient();
  const { data: program } = await serviceClient
    .from("programs")
    .select("id, test_system_prompt")
    .eq("id", testConfig.program_id)
    .single();

  if (!program || !program.test_system_prompt) {
    return apiError("Программа или промпт теста не найдены", 404);
  }

  // Mode-specific validation
  if (isAuthenticated) {
    if (body.chat_id && UUID_RE.test(body.chat_id)) {
      // Existing chat — proceed
    } else if (body.session_id && UUID_RE.test(body.session_id)) {
      // Authenticated user starting fresh test — auto-create chat
      const { data: existingTestChat } = await serviceClient
        .from("chats")
        .select("id")
        .eq("user_id", user!.id)
        .eq("program_id", program.id)
        .eq("chat_type", "test")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (existingTestChat) {
        body.chat_id = existingTestChat.id;
      } else {
        const { data: newChat, error: chatErr } = await serviceClient
          .from("chats")
          .insert({
            user_id: user!.id,
            program_id: program.id,
            chat_type: "test",
            status: "active",
            test_state: {
              current_question: 0,
              status: "in_progress",
              started_at: new Date().toISOString(),
              answers: [],
            },
          })
          .select("id")
          .single();

        if (chatErr || !newChat) {
          Sentry.captureException(chatErr ?? new Error("Auto-create test chat returned null"), {
            tags: { route: "api/test", phase: "create-chat" },
            extra: { programId: program.id },
          });
          console.error("[test] Failed to auto-create test chat:", chatErr);
          return apiError("Не удалось создать тестовый чат", 500);
        }

        body.chat_id = newChat.id;
        console.log(`[test] Auto-created test chat ${newChat.id} for user ${user!.id}`);
      }
    } else {
      return apiError("Невалидный chat_id", 400);
    }
  } else {
    if (!body.session_id || !UUID_RE.test(body.session_id)) {
      return apiError("Невалидный session_id", 400);
    }
    if (!Array.isArray(body.messages)) {
      return apiError("Отсутствует массив messages", 400);
    }

    // Rate limiting (anonymous only)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (!checkRateLimit(ip)) {
      return apiError("Слишком много запросов. Попробуйте позже.", 429);
    }
  }

  const systemPrompt = program.test_system_prompt;

  // 5. Typed answer mode (quick/text)
  if (answer_type === "quick" || answer_type === "text") {
    return handleTypedAnswer({
      serviceClient,
      supabase,
      user,
      isAuthenticated,
      answerType: answer_type,
      score: answer_type === "quick"
        ? (typeof quickAnswer === "number" ? quickAnswer : Number(message))
        : undefined,
      answerText: answer_type === "text" ? (answer_text ?? message) : undefined,
      questionIndex: question_index,
      sessionId: body.session_id,
      chatId: body.chat_id,
      clientMessages: body.messages,
      systemPrompt,
      programId: program.id,
      testConfig,
    });
  }

  // 6. Legacy mode (no answer_type)
  if (isAuthenticated) {
    return handleAuthenticated({
      supabase,
      serviceClient,
      user: user!,
      chatId: body.chat_id,
      message,
      systemPrompt,
      programId: program.id,
      testConfig,
    });
  } else {
    return handleAnonymous({
      serviceClient,
      sessionId: body.session_id,
      clientMessages: body.messages,
      message,
      systemPrompt,
      testConfig,
    });
  }
}
