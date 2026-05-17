import { apiError } from "@/lib/api-helpers";
import { updatePortrait } from "@/lib/portrait-updater";

// Re-export для обратной совместимости с местами, которые исторически
// импортировали updatePortrait отсюда. Новый код должен импортировать напрямую
// из @/lib/portrait-updater.
export { updatePortrait };

/**
 * HTTP handler — for manual/external calls (protected by internal secret)
 */
export async function POST(request: Request) {
  try {
    const internalSecret = process.env.INTERNAL_API_SECRET;
    if (
      !internalSecret ||
      request.headers.get("x-internal-secret") !== internalSecret
    ) {
      return apiError("Не авторизован", 401);
    }

    const { chat_id, trigger } = await request.json();

    if (!chat_id) {
      return apiError("chat_id обязателен", 400);
    }

    const result = await updatePortrait(chat_id, trigger || "manual");

    if (!result.success) {
      return apiError(result.error || "Ошибка обновления портрета", 500);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[PORTRAIT] HTTP handler error:", error);
    return apiError("Внутренняя ошибка сервера", 500);
  }
}
