import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Стандартный JSON-ответ с ошибкой.
 */
export function apiError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
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
