import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getChatMessages } from "@/lib/queries/messages";

const DEFAULT_BALANCE = 1000;

// ---------------------------------------------------------------------------
// ChatError — типизированная ошибка с HTTP-статусом
// ---------------------------------------------------------------------------

export class ChatError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// parseBody — извлечение текста из UIMessage + валидация
// ---------------------------------------------------------------------------

interface ParsedBody {
  message: string;
  chatId: string | undefined;
  programId: string;
  exerciseId: string | undefined;
  chatType: string | undefined;
  topicContext: string | undefined;
  chatTitle: string | undefined;
}

export function parseBody(body: Record<string, unknown>): ParsedBody {
  const { messages: clientMessages, chatId, programId, exerciseId, chatType, topicContext, chatTitle } = body as {
    messages?: Array<{ parts?: Array<{ type: string; text: string }>; content?: string }>;
    chatId?: string;
    programId?: string;
    exerciseId?: string;
    chatType?: string;
    topicContext?: string;
    chatTitle?: string;
  };

  const lastClientMsg = clientMessages?.[clientMessages.length - 1];
  const message =
    lastClientMsg?.parts
      ?.filter((p) => p.type === "text")
      ?.map((p) => p.text)
      ?.join("") || lastClientMsg?.content;

  if (!message || !programId) {
    throw new ChatError(400, "Не указано сообщение или программа");
  }

  if (typeof message !== "string" || message.length > 10000) {
    throw new ChatError(400, "Сообщение слишком длинное");
  }

  return { message, chatId, programId, exerciseId, chatType, topicContext, chatTitle };
}

// ---------------------------------------------------------------------------
// getOrCreateProfile — загрузка/создание профиля + баланс
// ---------------------------------------------------------------------------

interface ProfileResult {
  balanceTokens: number;
}

export async function getOrCreateProfile(
  supabase: SupabaseClient,
  serviceClient: SupabaseClient,
  user: User,
): Promise<ProfileResult> {
  let { data: userData } = await supabase
    .from("profiles")
    .select("balance_tokens")
    .eq("id", user.id)
    .maybeSingle();

  if (!userData) {
    console.log("[chat] Creating users record for", user.id);
    const { data: newUser, error: createError } = await serviceClient
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        balance_tokens: DEFAULT_BALANCE,
      })
      .select("balance_tokens")
      .single();

    if (createError) {
      console.error("[chat] Failed to create user record:", createError);
      throw new ChatError(500, "Не удалось создать профиль пользователя");
    }
    userData = newUser;
  }

  return { balanceTokens: userData.balance_tokens };
}

// ---------------------------------------------------------------------------
// loadProgramContext — программа + упражнение + system prompt
// ---------------------------------------------------------------------------

interface ProgramContextResult {
  program: {
    id: string;
    system_prompt: string | null;
    free_chat_welcome: string | null;
    author_chat_system_prompt: string | null;
    author_chat_welcome: string | null;
  };
  exercise: {
    id: string;
    system_prompt: string;
    title: string;
    welcome_message: string | null;
  } | null;
  systemPrompt: string;
  welcomeMessage: string | null;
}

export async function loadProgramContext(
  supabase: SupabaseClient,
  programId: string,
  exerciseId?: string,
  chatType?: string,
): Promise<ProgramContextResult> {
  // Load program
  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("id, system_prompt, free_chat_welcome, author_chat_system_prompt, author_chat_welcome")
    .eq("id", programId)
    .single();

  if (!program) {
    console.error("[chat] Program not found:", programId, programError);
    throw new ChatError(404, "Программа не найдена");
  }

  // Load exercise (if exercise chat)
  let exercise: ProgramContextResult["exercise"] = null;
  if (exerciseId) {
    const { data } = await supabase
      .from("exercises")
      .select("id, system_prompt, title, welcome_message")
      .eq("id", exerciseId)
      .single();
    exercise = data;
  }

  // Build system prompt: mode-level → program-level fallback
  // 1. Check program_modes for a custom system_prompt and welcome_message
  let systemPrompt = "";
  let modeWelcome: string | null = null;
  if (chatType) {
    const { data: modeRow } = await supabase
      .from("program_modes")
      .select("system_prompt, welcome_message, mode_templates!inner(chat_type)")
      .eq("program_id", programId)
      .eq("mode_templates.chat_type", chatType)
      .maybeSingle();

    if (modeRow?.system_prompt) {
      systemPrompt = modeRow.system_prompt;
    }
    if (modeRow?.welcome_message) {
      modeWelcome = modeRow.welcome_message;
    }
  }

  // 2. Fallback to program-level prompts
  if (!systemPrompt) {
    systemPrompt =
      chatType === "author" && program.author_chat_system_prompt
        ? program.author_chat_system_prompt
        : (program.system_prompt || "");
  }

  if (exercise?.system_prompt) {
    systemPrompt += `\n\n---\nТЕКУЩЕЕ УПРАЖНЕНИЕ: ${exercise.title}\n${exercise.system_prompt}`;
  }

  // Welcome message: mode-level → exercise → program-level fallback
  const welcomeMessage =
    modeWelcome ||
    exercise?.welcome_message ||
    (chatType === "author" ? program.author_chat_welcome : program.free_chat_welcome);

  return { program, exercise, systemPrompt, welcomeMessage };
}

// ---------------------------------------------------------------------------
// loadChatContext — чат + история сообщений + портрет
// ---------------------------------------------------------------------------

interface ChatContextResult {
  chatId: string;
  isNewChat: boolean;
  messages: Array<{ role: string; content: string }>;
  portrait: { content: unknown } | null;
}

export async function loadChatContext(
  supabase: SupabaseClient,
  userId: string,
  chatId: string | undefined,
  programId: string,
  chatType: string,
  exerciseId?: string,
  welcomeMessage?: string | null,
): Promise<ChatContextResult> {
  // Load portrait
  const { data: portrait } = await supabase
    .from("portraits")
    .select("content")
    .eq("user_id", userId)
    .eq("program_id", programId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Find or create chat
  let currentChatId: string = chatId ?? "";
  let isNewChat = false;

  if (!chatId) {
    // Попробовать переиспользовать существующий пустой чат (без user-сообщений)
    const { data: existingChat } = await supabase
      .from("chats")
      .select("id")
      .eq("user_id", userId)
      .eq("program_id", programId)
      .eq("chat_type", chatType)
      .eq("status", "active")
      .is("exercise_id", exerciseId || null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingChat) {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("chat_id", existingChat.id)
        .eq("role", "user");

      if (count === 0) {
        // Пустой чат найден — переиспользовать
        currentChatId = existingChat.id;
        isNewChat = true; // title всё ещё нужен
      }
    }

    if (!currentChatId) {
      // Нет пустого чата — создать новый
      const { data: newChat, error: chatError } = await supabase
        .from("chats")
        .insert({
          user_id: userId,
          program_id: programId,
          status: "active",
          exercise_id: exerciseId || null,
          chat_type: chatType,
        })
        .select("id")
        .single();

      if (chatError || !newChat) {
        console.error("[chat] Failed to create chat:", chatError);
        throw new ChatError(500, "Не удалось создать чат");
      }

      currentChatId = newChat.id;
      isNewChat = true;

      if (welcomeMessage) {
        await supabase.from("messages").insert({
          chat_id: currentChatId,
          role: "assistant",
          content: welcomeMessage,
          tokens_used: 0,
        });
      }
    }
  }

  // Load message history
  const messages = await getChatMessages(supabase, currentChatId);

  return { chatId: currentChatId, isNewChat, messages, portrait };
}

// ---------------------------------------------------------------------------
// appendPortraitContext — добавляет контекст портрета к system prompt
// ---------------------------------------------------------------------------

export function appendPortraitContext(
  systemPrompt: string,
  portrait: { content: unknown } | null,
): string {
  if (!portrait?.content) return systemPrompt;

  const p = portrait.content as { ai_context?: string };
  if (p.ai_context) {
    return systemPrompt + `\n\n---\nКОНТЕКСТ ПОЛЬЗОВАТЕЛЯ (из предыдущих упражнений):\n${p.ai_context}`;
  }

  return systemPrompt;
}

// ---------------------------------------------------------------------------
// buildGeminiHistory — конвертация сообщений в формат Gemini (user-first)
// ---------------------------------------------------------------------------

export function buildGeminiHistory(
  messages: Array<{ role: string; content: string }>,
  currentMessage: string,
): Array<{ role: "user" | "assistant"; content: string }> {
  const allMessages = messages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  // Gemini требует начинать с user — фильтруем leading assistant messages
  const firstUserIdx = allMessages.findIndex((m) => m.role === "user");
  const historyMessages = firstUserIdx >= 0 ? allMessages.slice(firstUserIdx) : [];

  return [...historyMessages, { role: "user" as const, content: currentMessage }];
}
