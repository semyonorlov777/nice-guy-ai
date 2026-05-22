# CLAUDE.md — мини-проект `voice`

## Что это

Личный инструмент заказчика для быстрой расшифровки голосовых заметок. Веб-страница `/voice` + Telegram-бот: записал голос → получил текст. Single-user, доступ по секретной ссылке (нет авторизации в вебе) и по `chat_id` в Telegram.

Зачем: в Telegram на Mac нельзя скопировать текст транскрипции Premium, телефон старый. Нужна одна вкладка, чтобы записать мысль и сразу получить текст для вставки в нейронку.

## Жёсткие правила (изоляция)

Этот мини-проект — **изолированный**. Правила основного приложения (чат, режимы, портрет, скиллы `niceguy-design`/`chat-rules`/`book-to-modes`/`book-audit`) к нему **НЕ применяются**.

### Запреты
- ❌ `import` из `@/lib/*`, `@/components/*`, `@/contexts/*`, `@/hooks/*`, `@/types/*` основного приложения.
- ❌ `import` из других `@mini/<other-slug>/*`.
- ❌ Использование классов из основного `app/globals.css`. Свои стили — всегда с префиксом `.voice-*` в `mini/voice/styles.css`.
- ❌ Общие React-компоненты основного (`<SiteFooter>`, `<Sidebar>`, `<MobileTabs>`, `<AuthSheet>`).
- ❌ Запросы к таблицам основного проекта в Supabase. Только свои таблицы с префиксом `voice_` (`voice_chats`, `voice_messages`).

### Разрешено
- ✅ npm-зависимости из корневого `package.json` (React, `openai`, `@supabase/supabase-js`).
- ✅ Шрифты из root `app/layout.tsx` (наследуются через `<body>`).
- ✅ Env-переменные из общего `.env.local`: `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, плюс свои с префиксом `VOICE_*`.

## Структура

```
mini/voice/
├── CLAUDE.md
├── README.md
├── styles.css                  # все классы с префиксом .voice-*
├── pages/
│   ├── HomePage.tsx            # список заметок + новая
│   └── ChatPage.tsx            # одна заметка: лента + Recorder
├── components/
│   ├── Recorder.tsx            # запись + waveform + сохранение
│   ├── MessageBubble.tsx       # карточка сообщения + copy
│   └── ChatListItem.tsx        # превью заметки в списке
├── lib/
│   ├── db.ts                   # Supabase service client + TABLES константы
│   ├── repo.ts                 # CRUD на voice_chats / voice_messages
│   ├── transcribe.ts           # OpenAI gpt-4o-mini-transcribe
│   ├── telegram.ts             # Bot API helpers под VOICE_BOT_TOKEN
│   ├── useVoiceRecorder.ts     # клиентский хук записи (адаптация useVoiceInput)
│   └── types.ts
├── api/
│   ├── chats.ts                # GET list, POST create
│   ├── chat-messages.ts        # GET, POST, DELETE, PATCH
│   ├── transcribe.ts           # MediaRecorder fallback
│   └── telegram-webhook.ts     # voice от @voice-bot
├── migrations/
│   └── 001_init.sql            # voice_chats + voice_messages (применена)
└── scripts/
    └── set-webhook.mjs         # одноразовая регистрация webhook для бота
```

## Маршруты

- `/voice` → `pages/HomePage.tsx` — список заметок.
- `/voice/[chatId]` → `pages/ChatPage.tsx` — одна заметка.
- `/api/voice/chats` — GET/POST.
- `/api/voice/chats/[chatId]/messages` — GET, POST (новое сообщение), DELETE (чата), PATCH (название).
- `/api/voice/transcribe` — MediaRecorder fallback (Safari etc).
- `/api/voice/telegram-webhook` — webhook от voice-бота.

## ENV-переменные

| Переменная | Где | Назначение |
|---|---|---|
| `OPENAI_API_KEY` | server | OpenAI gpt-4o-mini-transcribe. Уже есть в .env.local. |
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | server | Supabase service client. Уже есть. |
| `VOICE_BOT_TOKEN` | server | Bot Token нового бота от @BotFather. |
| `VOICE_BOT_WEBHOOK_SECRET` | server | Случайный hex 32+ байт. Telegram передаёт в header. |
| `VOICE_OWNER_TG_CHAT_ID` | server | Числовой chat_id заказчика. Бот игнорирует voice от других. |

## Telegram-бот

**Отдельный бот, не auth-бот.** Создание:

1. У @BotFather: `/newbot` → имя и username → сохранить токен.
2. Добавить в `.env.local`:
   ```
   VOICE_BOT_TOKEN=<токен>
   VOICE_BOT_WEBHOOK_SECRET=<openssl rand -hex 32>
   VOICE_OWNER_TG_CHAT_ID=<твой telegram id>
   ```
3. Тот же набор переменных — в Vercel project settings (Production + Preview).
4. После деплоя — зарегистрировать webhook:
   ```bash
   node mini/voice/scripts/set-webhook.mjs https://nice-guy-ai.vercel.app
   ```
5. Написать боту `/start` — он должен ответить приветствием.

Узнать свой `chat_id`: напиши боту `/start` без выставленной `VOICE_OWNER_TG_CHAT_ID`, посмотри в Vercel logs `from.id` из апдейта, потом выставь и передеплой.

## Supabase

Таблицы `public.voice_chats` и `public.voice_messages`. Изначально планировались в отдельной schema `voice`, но Supabase не пускает `ALTER DATABASE pgrst.db_schemas` под нашими правами, поэтому изоляция держится по префиксу `voice_*` в именах.

RLS включена на обе таблицы, политик НЕТ — anon/authenticated не имеют доступа. Все запросы — через service role в `mini/voice/lib/db.ts` (использует константы из `TABLES`).

## Verification

- `npm run build` без ошибок.
- `/voice` открывается без логина в браузере.
- Запись в Chrome работает через Web Speech (бесплатно), в Safari — через MediaRecorder + `/api/voice/transcribe` (OpenAI).
- Telegram-бот после регистрации webhook принимает voice от owner'а и отвечает текстом.
- `grep -rE "@/(lib|components|contexts|hooks|types)" mini/voice/` ничего не находит.

## Что не делаю в этом мини

- Multi-user auth. Single-user. Заходит секретная ссылка + chat_id в env.
- Realtime через Supabase Realtime — polling 5 сек хватает.
- Хранение аудио в Storage — только текст в БД.
- Команды боту (кроме /start) — fast-follow.
