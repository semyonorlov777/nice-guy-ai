import type { SupabaseClient, User } from "@supabase/supabase-js";

export interface UserProfileForChat {
  userInitial: string;
  avatarUrl: string | null;
  balanceTokens: number;
}

/**
 * Загружает профиль пользователя и вычисляет userInitial / avatarUrl.
 * Если balance_tokens не нужен — он всё равно возвращается (0 по умолчанию).
 */
export async function getUserProfileForChat(
  supabase: SupabaseClient,
  user: User,
): Promise<UserProfileForChat> {
  const { data } = await supabase
    .from("profiles")
    .select("name, avatar_url, balance_tokens")
    .eq("id", user.id)
    .maybeSingle();

  const userInitial =
    data?.name?.[0]?.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "?";

  return {
    userInitial,
    avatarUrl: data?.avatar_url || null,
    balanceTokens: data?.balance_tokens ?? 0,
  };
}
