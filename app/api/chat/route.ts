import { streamText } from "ai";
import { chatModel, CHAT_PROVIDER_OPTIONS, CHAT_MODEL_ID } from "@/lib/ai";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { requireAuth, apiError } from "@/lib/api-helpers";
import { updatePortrait } from "@/app/api/portrait/update/route";
import {
  ChatError,
  parseBody,
  getOrCreateProfile,
  loadProgramContext,
  loadChatContext,
  appendPortraitContext,
  appendTestScores,
  buildGeminiHistory,
} from "@/lib/chat/prepare-context";

export async function POST(request: Request) {
  console.log("[chat] model:", CHAT_MODEL_ID);
  const supabase = await createClient();

  // 1. Auth
  const { user, response } = await requireAuth(supabase);
  if (response) return response;

  // 2. Parse body + validate
  const body = await request.json();

  try {
    const { message, chatId, programId, exerciseId, chatType, topicContext, chatTitle } = parseBody(body);

    // 3. Profile + balance
    const serviceClient = createServiceClient();
    const profile = await getOrCreateProfile(supabase, serviceClient, user);
    if (profile.balanceTokens <= 0) {
      return apiError("Недостаточно токенов", 403);
    }

    // 4. Program + exercise + system prompt
    const ctx = await loadProgramContext(supabase, programId, exerciseId, chatType);

    // 5. Chat + history + portrait
    const currentChatType = exerciseId ? "exercise" : (chatType || "free");
    const chatCtx = await loadChatContext(
      supabase, user.id, chatId, programId, currentChatType, exerciseId, ctx.welcomeMessage,
    );

    // 6. Final system prompt (base + portrait + test scores + topic context)
    let systemPrompt = appendPortraitContext(ctx.systemPrompt, chatCtx.portrait);
    systemPrompt = await appendTestScores(supabase, systemPrompt, user.id, programId);
    if (topicContext) {
      systemPrompt += `\n\n---\nКОНТЕКСТ ТЕМЫ:\n${topicContext}`;
    }

    // 7. Build AI messages
    const aiMessages = buildGeminiHistory(chatCtx.messages, message);

    // 8. Save user message BEFORE streaming
    const { error: msgError } = await supabase.from("messages").insert({
      chat_id: chatCtx.chatId,
      role: "user",
      content: message,
      tokens_used: 0,
    });

    if (msgError) {
      console.error("[chat] Failed to save user message:", msgError);
      return apiError("Не удалось сохранить сообщение", 500);
    }

    // 9. Stream with Vercel AI SDK
    const result = streamText({
      model: chatModel(),
      providerOptions: CHAT_PROVIDER_OPTIONS,
      system: systemPrompt || undefined,
      messages: aiMessages,
      onFinish: async ({ text, usage }) => {
        const tokensUsed = usage.totalTokens || 0;

        // Save AI message
        await supabase.from("messages").insert({
          chat_id: chatCtx.chatId,
          role: "assistant",
          content: text,
          tokens_used: tokensUsed,
        });

        // Update chat metadata: last_message_at + auto-title
        const chatUpdate: Record<string, unknown> = {
          last_message_at: new Date().toISOString(),
        };
        if (chatCtx.isNewChat) {
          chatUpdate.title = chatTitle || message.slice(0, 50);
        }
        await supabase
          .from("chats")
          .update(chatUpdate)
          .eq("id", chatCtx.chatId);

        // Deduct tokens atomically via RPC
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
            .eq("chat_id", chatCtx.chatId)
            .eq("role", "user");

          if (userMsgCount && userMsgCount > 0 && userMsgCount % 5 === 0) {
            console.log("[PORTRAIT] Triggering update for chat:", chatCtx.chatId);
            await updatePortrait(chatCtx.chatId, "message_count");
          }
        })();
        portraitPromise.catch((err) => {
          console.error("[PORTRAIT] Background update failed:", err);
        });
      },
    });

    // 10. Return stream response with metadata
    return result.toUIMessageStreamResponse({
      messageMetadata: () => {
        return { chatId: chatCtx.chatId };
      },
    });
  } catch (e) {
    if (e instanceof ChatError) {
      return apiError(e.message, e.statusCode);
    }
    throw e;
  }
}
