import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Стандартный JSON-ответ с ошибкой.
 *
 * Конвенция языка ошибок:
 * - Обычные роуты: русский, user-facing ("Не найдено", "Невалидный ID")
 * - test/answer/route.ts: английский snake_case — machine-readable коды ("rate_limited", "rpc_error")
 *
 * @param extra — дополнительные поля ответа (например { server_question, result_id })
 */
export function apiError(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): Response {
  return Response.json({ error: message, ...extra }, { status });
}

type AuthSuccess = { user: User; response: null };
type AuthFailure = { user: null; response: Response };

/**
 * Проверяет авторизацию. Возвращает user или готовый 401 Response.
 *
 * Использование:
 *   const { user, response } = await requireAuth(supabase);
 *   if (response) return response;
 */
export async function requireAuth(
  supabase: SupabaseClient,
): Promise<AuthSuccess | AuthFailure> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, response: apiError("Не авторизован", 401) };
  }

  return { user, response: null };
}
