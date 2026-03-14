import {
  streamText,
} from "ai";
import { google } from "@/lib/ai";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { updatePortrait } from "@/app/api/portrait/update/route";

const DEFAULT_BALANCE = 1000;

export async function POST(request: Request) {
  const supabase = await createClient();

  // 1. Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Не авторизован" }, { status: 401 });
  }

  // 2. Parse body — useChat отправляет { messages: UIMessage[], ...body }
  const body = await request.json();
  const { messages: clientMessages, chatId, programId, exerciseId, chatType } = body;

  // Извлекаем текст последнего user-сообщения из UIMessage parts
  const lastClientMsg = clientMessages?.[clientMessages.length - 1];
  const message =
    lastClientMsg?.parts
      ?.filter((p: { type: string }) => p.type === "text")
      ?.map((p: { text: string }) => p.text)
      ?.join("") || lastClientMsg?.content;

  if (!message || !programId) {
    return Response.json(
      { error: "Не указано сообщение или программа" },
      { status: 400 }
    );
  }

  if (typeof message !== "string" || message.length > 10000) {
    return Response.json(
      { error: "Сообщение слишком длинное" },
      { status: 400 }
    );
  }

  // 3. Get or create user record + check balance
  let { data: userData } = await supabase
    .from("profiles")
    .select("balance_tokens")
    .eq("id", user.id)
    .maybeSingle();

  if (!userData) {
    console.log("[chat] Creating users record for", user.id);
    const serviceClient = createServiceClient();
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
      return Response.json(
        { error: "Не удалось создать профиль пользователя" },
        { status: 500 }
      );
    }
    userData = newUser;
  }

  if (userData.balance_tokens <= 0) {
    return Response.json({ error: "Недостаточно токенов" }, { status: 403 });
  }

  // 4. Load program
  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("id, system_prompt, free_chat_welcome, author_chat_system_prompt, author_chat_welcome")
    .eq("id", programId)
    .single();

  if (!program) {
    console.error("[chat] Program not found:", programId, programError);
    return Response.json({ error: "Программа не найдена" }, { status: 404 });
  }

  // 5. Load exercise (if exercise chat)
  let exercise: {
    id: string;
    system_prompt: string;
    title: string;
    welcome_message: string | null;
  } | null = null;
  if (exerciseId) {
    const { data } = await supabase
      .from("exercises")
      .select("id, system_prompt, title, welcome_message")
      .eq("id", exerciseId)
      .single();
    exercise = data;
  }

  // 6. Load portrait
  const { data: portrait } = await supabase
    .from("portraits")
    .select("content")
    .eq("user_id", user.id)
    .eq("program_id", programId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 7. Find or create chat
  let currentChatId = chatId;
  let isNewChat = false;
  const currentChatType = exerciseId ? "exercise" : (chatType === "author" ? "author" : "free");

  if (!currentChatId) {
    // Multi-chat: создаём новый чат
    const insertData: Record<string, unknown> = {
      user_id: user.id,
      program_id: programId,
      status: "active",
      exercise_id: exerciseId || null,
      chat_type: currentChatType,
    };

    const { data: newChat, error: chatError } = await supabase
      .from("chats")
      .insert(insertData)
      .select("id")
      .single();

    if (chatError || !newChat) {
      console.error("[chat] Failed to create chat:", chatError);
      return Response.json(
        { error: "Не удалось создать чат" },
        { status: 500 }
      );
    }

    currentChatId = newChat.id;
    isNewChat = true;

    const welcomeText =
      exercise?.welcome_message ||
      (chatType === "author" ? program.author_chat_welcome : program.free_chat_welcome);
    if (welcomeText) {
      await supabase.from("messages").insert({
        chat_id: currentChatId,
        role: "assistant",
        content: welcomeText,
        tokens_used: 0,
      });
    }
  }

  // 8. Load message history from DB
  const { data: dbMessages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("chat_id", currentChatId)
    .order("created_at", { ascending: true });

  // 9. Build system prompt
  let systemPrompt = (chatType === "author" && program.author_chat_system_prompt)
    ? program.author_chat_system_prompt
    : (program.system_prompt || "");
  if (exercise?.system_prompt) {
    systemPrompt += `\n\n---\nТЕКУЩЕЕ УПРАЖНЕНИЕ: ${exercise.title}\n${exercise.system_prompt}`;
  }
  if (portrait?.content) {
    const p = portrait.content as { ai_context?: string };
    if (p.ai_context) {
      systemPrompt += `\n\n---\nКОНТЕКСТ ПОЛЬЗОВАТЕЛЯ (из предыдущих упражнений):\n${p.ai_context}`;
    }
  }

  // 10. Build messages for AI SDK
  // Фильтруем leading assistant messages (Gemini требует начинать с user)
  const allDbMessages = (dbMessages || []).map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));
  const firstUserIdx = allDbMessages.findIndex((m) => m.role === "user");
  const historyMessages =
    firstUserIdx >= 0 ? allDbMessages.slice(firstUserIdx) : [];

  // Добавляем текущее сообщение
  const aiMessages = [
    ...historyMessages,
    { role: "user" as const, content: message },
  ];

  // 11. Save user message BEFORE streaming
  const { error: msgError } = await supabase.from("messages").insert({
    chat_id: currentChatId,
    role: "user",
    content: message,
    tokens_used: 0,
  });

  if (msgError) {
    console.error("[chat] Failed to save user message:", msgError);
    return Response.json(
      { error: "Не удалось сохранить сообщение" },
      { status: 500 }
    );
  }

  // 12. Stream with Vercel AI SDK
  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt || undefined,
    messages: aiMessages,
    onFinish: async ({ text, usage }) => {
      const tokensUsed = usage.totalTokens || 0;

      // Save AI message (критичная операция — await)
      await supabase.from("messages").insert({
        chat_id: currentChatId,
        role: "assistant",
        content: text,
        tokens_used: tokensUsed,
      });

      // Update chat metadata: last_message_at + auto-title
      const chatUpdate: Record<string, unknown> = {
        last_message_at: new Date().toISOString(),
      };
      if (isNewChat) {
        chatUpdate.title = message.slice(0, 50);
      }
      await supabase
        .from("chats")
        .update(chatUpdate)
        .eq("id", currentChatId);

      // Deduct tokens atomically via RPC (prevents race conditions)
      if (tokensUsed > 0) {
        const { data: deducted } = await supabase.rpc("deduct_tokens", {
          p_user_id: user.id,
          p_amount: tokensUsed,
        });
        if (!deducted) {
          console.warn("[chat] Failed to deduct tokens — insufficient balance, user:", user.id);
        }
      }

      // Portrait auto-update (fire-and-forget)
      const portraitPromise = (async () => {
        const svc = createServiceClient();
        const { count: userMsgCount } = await svc
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("chat_id", currentChatId)
          .eq("role", "user");

        if (userMsgCount && userMsgCount > 0 && userMsgCount % 5 === 0) {
          console.log(
            "[PORTRAIT] Triggering update for chat:",
            currentChatId
          );
          await updatePortrait(currentChatId, "message_count");
        }
      })();
      portraitPromise.catch((err) => {
        console.error("[PORTRAIT] Background update failed:", err);
      });
    },
  });

  // 13. Return stream response with metadata
  return result.toUIMessageStreamResponse({
    messageMetadata: () => {
      return { chatId: currentChatId };
    },
  });
}
