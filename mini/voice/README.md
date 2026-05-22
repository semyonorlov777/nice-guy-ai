# voice

Личный инструмент быстрой расшифровки голосовых заметок. Веб + Telegram-бот, single-user.

## Сценарий

1. Зашёл на `/voice` → создал новую заметку (или открыл существующую).
2. Нажал «Записать голосовое» → говорю → жму «Готово» → вижу текст в чате.
3. Дополнительно: отправил голосовое в Telegram-бот → бот пришёл текст в ответ и сохранил его в чат `Telegram Inbox` в вебе.
4. Нажал «Скопировать всё» → вставил в нейронку.

В Chrome/Edge запись идёт через Web Speech API (бесплатно, real-time). В Safari — через MediaRecorder + OpenAI gpt-4o-mini-transcribe.

## Маршрут на продакшене

https://nice-guy-ai.vercel.app/voice

(noindex, доступ по секретной ссылке)

## Локальный запуск

```bash
npm run dev
# открыть http://localhost:3000/voice
```

## Настройка Telegram-бота

См. `CLAUDE.md` секция «Telegram-бот». Кратко:

1. Создать бота у @BotFather, получить токен.
2. Добавить в `.env.local`: `VOICE_BOT_TOKEN`, `VOICE_BOT_WEBHOOK_SECRET`, `VOICE_OWNER_TG_CHAT_ID`.
3. После деплоя: `node mini/voice/scripts/set-webhook.mjs https://nice-guy-ai.vercel.app`.

## Структура

См. `CLAUDE.md`.
