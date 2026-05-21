import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase-server";
import { findOrCreateOAuthUser } from "@/lib/oauth-common";

// Вход через Telegram-бота с одноразовым кодом.
// Flow: сайт создаёт код → /start CODE → бот ловит webhook → сайт polls → сессия.

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME!;
const BOT_TOKEN = process.env.TELEGRAM_CLIENT_SECRET!;
const CODE_TTL_MS = 10 * 60 * 1000;

export interface TelegramLoginCode {
  code: string;
  status: "pending" | "confirmed" | "used" | "expired";
  telegram_id: number | null;
  telegram_username: string | null;
  name: string | null;
  avatar_url: string | null;
  expires_at: string;
}

export interface TelegramFromUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export function generateLoginCode(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export async function createLoginCode(): Promise<{ code: string; botUrl: string }> {
  const supabase = createServiceClient();
  const code = generateLoginCode();
  const expires_at = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { error } = await supabase
    .from("telegram_login_codes")
    .insert({ code, status: "pending", expires_at });

  if (error) {
    throw new Error(`Failed to create login code: ${error.message}`);
  }

  return {
    code,
    botUrl: `https://t.me/${BOT_USERNAME}?start=${code}`,
  };
}

export async function getLoginCode(code: string): Promise<TelegramLoginCode | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("telegram_login_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to fetch login code: ${error.message}`);
  }
  return data as TelegramLoginCode | null;
}

// Атомарно: ставит status=confirmed только если код pending и не expired.
// Возвращает true если подтвердили, false если уже не pending или expired.
export async function confirmLoginCode(
  code: string,
  user: TelegramFromUser,
  avatarUrl: string | null,
): Promise<boolean> {
  const supabase = createServiceClient();
  const fullName = [user.first_name, user.last_name]
    .filter((s): s is string => Boolean(s))
    .join(" ")
    .trim();

  const { data, error } = await supabase
    .from("telegram_login_codes")
    .update({
      status: "confirmed",
      telegram_id: user.id,
      telegram_username: user.username || null,
      name: fullName || user.username || "",
      avatar_url: avatarUrl,
      confirmed_at: new Date().toISOString(),
    })
    .eq("code", code)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to confirm login code: ${error.message}`);
  }
  return Boolean(data);
}

export async function markCodeUsed(code: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("telegram_login_codes")
    .update({ status: "used", used_at: new Date().toISOString() })
    .eq("code", code)
    .eq("status", "confirmed");
}

export async function createOrUpdateUserFromLogin(login: TelegramLoginCode) {
  if (login.telegram_id === null) {
    throw new Error("Cannot create user: telegram_id is null on confirmed login code");
  }
  return findOrCreateOAuthUser({
    provider: "Telegram",
    emailPrefix: "tg",
    hmacInput: String(login.telegram_id),
    secret: BOT_TOKEN,
    lookupField: "telegram_id",
    lookupValue: login.telegram_id,
    existingProfileUpdate: {
      telegram_username: login.telegram_username || undefined,
      avatar_url: login.avatar_url || undefined,
      name: login.name || undefined,
    },
    newProfileData: {
      email: null,
      telegram_id: login.telegram_id,
      telegram_username: login.telegram_username,
      avatar_url: login.avatar_url,
      name: login.name || "",
    },
  });
}

// Получает URL фото профиля юзера из Telegram. ВНУТРЕННИЙ метод —
// URL содержит bot token, нельзя отдавать клиенту. Используется только
// как промежуточный шаг в downloadAndUploadAvatar.
async function getTelegramPhotoSourceUrl(userId: number): Promise<string | null> {
  try {
    const photosResp = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos?user_id=${userId}&limit=1`,
    );
    const photosData = await photosResp.json();
    if (!photosData.ok || !photosData.result?.photos?.[0]?.[0]) return null;

    const photoSizes = photosData.result.photos[0] as Array<{ file_id: string }>;
    // Берём средний размер если есть — баланс качества и веса.
    const chosen = photoSizes[Math.min(1, photoSizes.length - 1)];
    if (!chosen?.file_id) return null;

    const fileResp = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${chosen.file_id}`,
    );
    const fileData = await fileResp.json();
    if (!fileData.ok || !fileData.result?.file_path) return null;

    return `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
  } catch (err) {
    console.error("[telegram-login] Failed to fetch user photo URL:", err);
    return null;
  }
}

// Скачивает фото юзера из Telegram и загружает в Supabase Storage bucket
// `avatars`. Возвращает публичный URL или null. URL содержит cache-bust
// `?v={ts}`, чтобы при смене фото в Telegram браузер обновил картинку.
export async function downloadAndUploadAvatar(userId: number): Promise<string | null> {
  const sourceUrl = await getTelegramPhotoSourceUrl(userId);
  if (!sourceUrl) return null;

  try {
    const photoResp = await fetch(sourceUrl);
    if (!photoResp.ok) {
      console.error("[telegram-login] Failed to download photo:", photoResp.status);
      return null;
    }

    const arrayBuffer = await photoResp.arrayBuffer();
    const contentType = photoResp.headers.get("content-type") || "image/jpeg";

    const supabase = createServiceClient();
    const filename = `telegram-${userId}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filename, new Uint8Array(arrayBuffer), {
        contentType,
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("[telegram-login] Storage upload failed:", uploadError);
      return null;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(filename);
    // Cache-bust: при смене фото публичный URL остаётся тем же, поэтому
    // добавляем ?v=timestamp — иначе браузер покажет старую кешированную копию.
    return `${data.publicUrl}?v=${Date.now()}`;
  } catch (err) {
    console.error("[telegram-login] downloadAndUploadAvatar error:", err);
    return null;
  }
}

export async function sendBotMessage(chatId: number, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch (err) {
    console.error("[telegram-login] Failed to send message:", err);
  }
}
