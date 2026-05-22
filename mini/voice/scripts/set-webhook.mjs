#!/usr/bin/env node
// Одноразовый скрипт регистрации webhook'а для voice-бота.
//
// Использование:
//   VOICE_BOT_TOKEN=... VOICE_BOT_WEBHOOK_SECRET=... node mini/voice/scripts/set-webhook.mjs https://nice-guy-ai.vercel.app
//
// Можно также передать БАЗОВЫЙ URL первым аргументом, остальное возьмётся из env (.env.local).

import { config } from "dotenv";
config({ path: ".env.local" });

const baseUrl = process.argv[2] || process.env.APP_URL || "https://nice-guy-ai.vercel.app";
const token = process.env.VOICE_BOT_TOKEN;
const secret = process.env.VOICE_BOT_WEBHOOK_SECRET;

if (!token) {
  console.error("VOICE_BOT_TOKEN не задан в env. Положи в .env.local или передай VOICE_BOT_TOKEN=... перед запуском.");
  process.exit(1);
}
if (!secret) {
  console.error("VOICE_BOT_WEBHOOK_SECRET не задан в env.");
  process.exit(1);
}

const webhookUrl = `${baseUrl.replace(/\/+$/, "")}/api/voice/telegram-webhook`;

async function call(method, params) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method} failed: ${data.description}`);
  return data.result;
}

(async () => {
  console.log(`Registering webhook: ${webhookUrl}`);
  await call("setWebhook", {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
  const info = await call("getWebhookInfo", {});
  console.log("Done. Webhook info:");
  console.log(JSON.stringify(info, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
