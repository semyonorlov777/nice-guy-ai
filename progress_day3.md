# Nice Guy AI — Прогресс разработки

## Day 1 ✅ — AI-фундамент
- Системный промпт для AI-фасилитатора
- 46 упражнений с контекстом, историями, ловушками
- Тестирование в Claude Projects — работает
- Файл: `data/упражнения_обновленные_27_02_v3.md`

## Day 2 ✅ — Каркас проекта
- Next.js приложение работает на localhost:3000
- Supabase проект (Frankfurt) подключён
- 9 таблиц созданы: programs, exercises, users, user_programs, chats, messages, portraits, payments, subscriptions
- RLS-политики включены на всех таблицах
- Тестовый пользователь создан в Supabase Auth
- Авторизация работает (логин/пароль)
- 3 коммита в Git

## Day 3 Step 1 ✅ — 46 упражнений в БД
- Все 46 упражнений загружены через SQL INSERT
- program_id: `dd325a70-28d9-48d6-a902-3922dc1c34c1`
- Каждое упражнение содержит: chapter, number, title, description, system_prompt, order_index
- Проверка: SELECT count(*) = 46 ✅

## Day 3 Steps 2-6 — ТЕКУЩАЯ ЗАДАЧА
- Step 2: Сайдбар с упражнениями
- Step 3: ChatWindow компонент
- Step 4: API route /api/chat + Gemini API
- Step 5: Склейка всего вместе
- Step 6: Учёт токенов

## Структура БД (ключевые таблицы)

```
programs: id, slug, title, description, system_prompt, config, is_active
exercises: id, program_id, chapter, number, title, description, system_prompt, order_index
users: id, email, name, balance_tokens
chats: id, user_id, program_id, exercise_id (null=свободный), status
messages: id, chat_id, role, content, tokens_used
portraits: id, user_id, program_id, content (jsonb)
```

## Структура файлов проекта

```
nice-guy-ai/
├── app/
│   ├── page.tsx                  # Главная
│   ├── layout.tsx                # Шаблон
│   ├── program/[slug]/
│   │   ├── page.tsx              # Лендинг программы
│   │   ├── exercise/[id]/page.tsx # Чат по упражнению
│   │   ├── chat/page.tsx         # Свободный чат
│   │   └── portrait/page.tsx     # Портрет
│   ├── auth/page.tsx             # Вход
│   ├── balance/page.tsx          # Баланс
│   └── api/
│       ├── chat/route.ts         # AI чат
│       ├── payment/              # Оплата
│       └── portrait/route.ts     # Портрет
├── components/
│   ├── ChatWindow.tsx
│   ├── Sidebar.tsx
│   └── ...
├── lib/
│   ├── supabase.ts
│   ├── gemini.ts
│   └── yookassa.ts
├── .env.local                    # API ключи
└── package.json
```

## Ключевые решения
- AI: Google Gemini API (gemini-2.0-flash) — дешёвый и быстрый
- Дизайн: светлая тема по умолчанию + тёмная, акцент #c9a84c
- Авторизация MVP: админ создаёт аккаунты вручную
- Монетизация MVP: пакеты токенов (не подписка)
- URL: /program/nice-guy/exercise/3

## Env переменные (.env.local)
```
GOOGLE_GEMINI_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Что НЕ в MVP
- Telegram-бот
- Голосовой ввод
- Публичная регистрация
- Подписочная модель
- Дашборд для лидера группы
