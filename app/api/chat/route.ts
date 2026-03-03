import { createClient, createServiceClient } from "@/lib/supabase-server";
import { streamChat } from "@/lib/gemini";
import { updatePortrait } from "@/app/api/portrait/update/route";
import type { Content } from "@google/generative-ai";

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

  // 2. Parse body
  const { message, chatId, programId, exerciseId } = await request.json();
  if (!message || !programId) {
    return Response.json({ error: "Не указано сообщение или программа" }, { status: 400 });
  }

  // 3. Get or create user record + check balance
  let { data: userData } = await supabase
    .from("profiles")
    .select("balance_tokens")
    .eq("id", user.id)
    .maybeSingle();

  if (!userData) {
    // Auto-create user record with service client (bypasses RLS)
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
    .select("id, system_prompt")
    .eq("id", programId)
    .single();

  if (!program) {
    console.error("[chat] Program not found:", programId, programError);
    return Response.json({ error: "Программа не найдена" }, { status: 404 });
  }

  // 5. Load exercise (if exercise chat)
  let exercise: { id: string; system_prompt: string; title: string } | null =
    null;
  if (exerciseId) {
    const { data } = await supabase
      .from("exercises")
      .select("id, system_prompt, title")
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

  if (!currentChatId) {
    // Build query — chain properly to avoid mutation issues
    let findQuery = supabase
      .from("chats")
      .select("id")
      .eq("user_id", user.id)
      .eq("program_id", programId)
      .eq("status", "active");

    if (exerciseId) {
      findQuery = findQuery.eq("exercise_id", exerciseId);
    } else {
      findQuery = findQuery.is("exercise_id", null);
    }

    const { data: existingChat } = await findQuery.limit(1).maybeSingle();

    if (existingChat) {
      currentChatId = existingChat.id;
    } else {
      const { data: newChat, error: chatError } = await supabase
        .from("chats")
        .insert({
          user_id: user.id,
          program_id: programId,
          exercise_id: exerciseId || null,
          status: "active",
        })
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
    }
  }

  // 8. Load message history
  const { data: dbMessages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("chat_id", currentChatId)
    .order("created_at", { ascending: true });

  // 9. Build system prompt
  let systemPrompt = program.system_prompt || "";
  if (exercise?.system_prompt) {
    systemPrompt += `\n\n---\nТЕКУЩЕЕ УПРАЖНЕНИЕ: ${exercise.title}\n${exercise.system_prompt}`;
  }
  if (portrait?.content) {
    const p = portrait.content as { ai_context?: string };
    if (p.ai_context) {
      systemPrompt += `\n\n---\nКОНТЕКСТ ПОЛЬЗОВАТЕЛЯ (из предыдущих упражнений):\n${p.ai_context}`;
    }
  }

  // 10. Convert to Gemini format
  const history: Content[] = (dbMessages || []).map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  // 11. Save user message
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

  // 12. Stream response from Gemini
  let result;
  try {
    result = await streamChat(systemPrompt, history, message);
  } catch (error) {
    console.error("[chat] Gemini API error:", error);
    return Response.json(
      { error: "Ошибка AI. Проверьте API ключ." },
      { status: 502 }
    );
  }

  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      if (isNewChat) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "chat_id", chatId: currentChatId })}\n\n`
          )
        );
      }

      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            fullResponse += text;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "delta", content: text })}\n\n`
              )
            );
          }
        }

        // Get usage metadata
        const response = await result.response;
        const tokensUsed = response.usageMetadata?.totalTokenCount || 0;

        // Save AI message
        await supabase.from("messages").insert({
          chat_id: currentChatId,
          role: "assistant",
          content: fullResponse,
          tokens_used: tokensUsed,
        });

        // Deduct tokens
        if (tokensUsed > 0) {
          const newBalance = Math.max(0, userData.balance_tokens - tokensUsed);
          await supabase
            .from("profiles")
            .update({ balance_tokens: newBalance })
            .eq("id", user.id);
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", tokensUsed })}\n\n`
          )
        );

        // Portrait auto-update: every 5 user messages
        try {
          const svc = createServiceClient();
          const { count: userMsgCount, error: countError } = await svc
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("chat_id", currentChatId)
            .eq("role", "user");

          console.log("[PORTRAIT] Message count:", userMsgCount, "Trigger:", userMsgCount && userMsgCount % 5 === 0, "error:", countError);

          if (userMsgCount && userMsgCount > 0 && userMsgCount % 5 === 0) {
            console.log("[PORTRAIT] Triggering update for chat:", currentChatId);
            // Fire and forget — don't await, don't block the user
            updatePortrait(currentChatId, "message_count").catch((err) => {
              console.error("[PORTRAIT] Background update failed:", err);
            });
          }
        } catch (err) {
          console.error("[PORTRAIT] Trigger check error:", err);
        }
      } catch (error) {
        console.error("[chat] Streaming error:", error);
        if (fullResponse) {
          await supabase.from("messages").insert({
            chat_id: currentChatId,
            role: "assistant",
            content: fullResponse,
            tokens_used: 0,
          });
        }
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: "Ошибка при генерации ответа" })}\n\n`
          )
        );
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
