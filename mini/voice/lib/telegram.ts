// Bot API helpers для voice-бота. Полностью независимы от lib/telegram-login.ts —
// единственный общий момент это контракт api.telegram.org.
//
// ENV:
//   VOICE_BOT_TOKEN          — Bot Token от @BotFather (новый бот, не auth-бот)
//   VOICE_BOT_WEBHOOK_SECRET — секрет, который Telegram передаёт в header
//   VOICE_OWNER_TG_CHAT_ID   — chat_id владельца; бот игнорирует voice от других

const API_BASE = "https://api.telegram.org";

function getToken(): string {
  const token = process.env.VOICE_BOT_TOKEN;
  if (!token) throw new Error("VOICE_BOT_TOKEN is not set");
  return token;
}

export function getOwnerChatId(): number | null {
  const raw = process.env.VOICE_OWNER_TG_CHAT_ID;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function getWebhookSecret(): string | null {
  return process.env.VOICE_BOT_WEBHOOK_SECRET ?? null;
}

async function botApi<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) {
    throw new Error(`Telegram API ${method} failed: ${data.description ?? "unknown"}`);
  }
  return data.result as T;
}

export async function sendMessage(chatId: number, text: string, replyToMessageId?: number): Promise<void> {
  // Telegram лимит на сообщение — 4096 символов. Длинные транскрипции бьём чанками.
  const MAX_LEN = 4000;
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > MAX_LEN) {
    chunks.push(rest.slice(0, MAX_LEN));
    rest = rest.slice(MAX_LEN);
  }
  if (rest.length > 0) chunks.push(rest);

  for (let i = 0; i < chunks.length; i++) {
    await botApi("sendMessage", {
      chat_id: chatId,
      text: chunks[i],
      reply_to_message_id: i === 0 ? replyToMessageId : undefined,
    });
  }
}

export async function getFileUrl(fileId: string): Promise<string> {
  const token = getToken();
  const file = await botApi<{ file_path: string }>("getFile", { file_id: fileId });
  return `${API_BASE}/file/bot${token}/${file.file_path}`;
}

export async function downloadFile(fileId: string): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const url = await getFileUrl(fileId);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download Telegram file: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const mimeType = res.headers.get("content-type") || "audio/ogg";
  return { buffer, mimeType };
}

export async function setWebhook(url: string, secretToken: string, allowedUpdates: string[] = ["message"]): Promise<void> {
  await botApi("setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: allowedUpdates,
    drop_pending_updates: false,
  });
}

export async function deleteWebhook(): Promise<void> {
  await botApi("deleteWebhook", { drop_pending_updates: false });
}

export async function getWebhookInfo(): Promise<{ url: string; pending_update_count: number; last_error_message?: string }> {
  return botApi("getWebhookInfo", {});
}

// --- Типы Telegram Update (только нужные нам поля) ---

export interface TgUser {
  id: number;
  first_name?: string;
  username?: string;
}

export interface TgVoice {
  file_id: string;
  duration: number;
  mime_type?: string;
}

export interface TgAudio {
  file_id: string;
  duration: number;
  mime_type?: string;
}

export interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type: string };
  date: number;
  text?: string;
  voice?: TgVoice;
  audio?: TgAudio;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}
