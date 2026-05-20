# CLAUDE.md — мини-проект `funnel`

## Что это

Тест-воронка по методике психолога Игоря Волынского (Институт МПП). За 15-20 минут пользователь проходит ~17 AI-адаптивных вопросов (5 seed-вопросов + последующие генерируются Gemini под уже данные ответы) и получает персональный разбор-зеркало главного паттерна — на 700-1000 слов, в живых формулировках, без диагнозов. В конце — оффер на школу/клуб Волынского. Анонимно, без регистрации, сессия в `localStorage`.

Маршруты: `/funnel` (приветствие) → `/funnel/test` (вопросы) → `/funnel/result` (разбор) → `/funnel/offer` (предложение).

## Жёсткие правила (изоляция)

Этот мини-проект — **изолированный**. Правила основного приложения (чат, режимы, портрет, скиллы `niceguy-design`/`chat-rules`/`book-to-modes`/`book-audit`) к нему **НЕ применяются**. Не открывай и не используй корневой `CLAUDE.md` как руководство.

### Запреты
- ❌ `import` из `@/lib/*`, `@/components/*`, `@/contexts/*`, `@/hooks/*`, `@/types/*` основного приложения.
- ❌ `import` из других `@mini/<other-slug>/*` — мини-проекты не знают друг о друге.
- ❌ Использование классов из основного `app/globals.css` (`.nc-msg`, `.msg`, `.btn-primary` и т.д.). Свои стили — всегда с префиксом `.funnel-*` в `mini/funnel/funnel.css`.
- ❌ Общие React-компоненты основного (`<SiteFooter>`, `<Sidebar>`, `<MobileTabs>`, `<AuthSheet>`).
- ❌ Запросы к таблицам основного проекта в Supabase (`programs`, `profiles`, `chats`, `messages`, `exercises`, `portraits`, `test_*`).

### Разрешено
- ✅ Любые npm-зависимости из корневого `package.json` (React, ai, @ai-sdk/google, react-markdown, remark-breaks и т.д.).
- ✅ Шрифты из root `app/layout.tsx` (Onest, Cormorant Garamond) — наследуются через `<body>`.
- ✅ Env-переменные из общего `.env.local` (`GOOGLE_GEMINI_API_KEY` и т.д.).
- ✅ Шим в `app/funnel/` — но только как re-export или layout-обёртка.

### Граничный случай
Если очень хочется переиспользовать функцию из основного `lib/` — **скопируй её сюда** (`mini/funnel/lib/`). Это не «технический долг», это плата за изоляцию: основной код может измениться, мини от этого не сломается. Так уже сделано для `ai.ts`, `rate-limit.ts` и `components/AIBubble.tsx`.

## Структура

```
mini/funnel/
├── CLAUDE.md          (этот файл)
├── README.md          (описание для людей)
├── funnel.css         (все классы с префиксом .funnel-*)
├── pages/             (компоненты-страницы; рендерятся через шимы в app/funnel/)
│   ├── HomePage.tsx
│   ├── TestPage.tsx
│   ├── ResultPage.tsx
│   └── OfferPage.tsx
├── components/        (внутренние компоненты)
│   ├── AIBubble.tsx          (минимальная копия из основного ChatMessage)
│   ├── AnalyzingScreen.tsx
│   ├── OfferScreen.tsx
│   ├── QuestionScreen.tsx
│   ├── ResultScreen.tsx
│   ├── TestFlow.tsx
│   └── WelcomeScreen.tsx
├── lib/
│   ├── ai.ts                 (обёртка Gemini через @ai-sdk/google)
│   ├── rate-limit.ts         (in-memory rate limiter)
│   ├── canon-volynsky.md     (исходник методики)
│   ├── canon.generated.ts    (AUTO-GENERATED из canon-volynsky.md)
│   ├── prompts.ts
│   ├── seed-questions.ts
│   ├── session.ts
│   └── types.ts
├── api/               (route handlers — экспортируют POST)
│   ├── next-question.ts
│   └── analyze.ts
└── scripts/
    └── build-canon.mjs       (prebuild — генерирует canon.generated.ts)
```

Шимы для роутинга Next.js — в `app/funnel/` (`page.tsx`, `test/page.tsx`, `result/page.tsx`, `offer/page.tsx`, `layout.tsx`) и `app/api/funnel/{next-question,analyze}/route.ts`. Каждый — 1-2 строки re-export.

## Маршруты

- `/funnel` → `pages/HomePage.tsx` (приветствие)
- `/funnel/test` → `pages/TestPage.tsx` (AI-вопросы по очереди)
- `/funnel/result` → `pages/ResultPage.tsx` (анализ + готовый разбор)
- `/funnel/offer` → `pages/OfferPage.tsx` (предложение школа/клуб)
- `POST /api/funnel/next-question` → `api/next-question.ts` (Gemini Flash, следующий вопрос)
- `POST /api/funnel/analyze` → `api/analyze.ts` (Gemini Pro, финальный разбор)

## Canon (методика Волынского)

Источник истины — `lib/canon-volynsky.md`. Перед сборкой prebuild-скрипт `scripts/build-canon.mjs` генерирует `lib/canon.generated.ts` с константой `CANON_VOLYNSKY` (строка). Эта константа прокидывается в system-prompt обоих AI-вызовов.

Редактировать только `.md`. Чтобы локально пересобрать `canon.generated.ts`: `node mini/funnel/scripts/build-canon.mjs` (вызывается автоматом из корневого `npm run build` через `prebuild`-хук в `package.json`).

## ENV

- `GOOGLE_GEMINI_API_KEY` — ключ к Gemini API (общий с основным проектом).

## Verification (перед коммитом)

- `npm run build` проходит без ошибок (prebuild → next build).
- `/funnel` отображается, можно дойти до первого вопроса.
- `grep -rE "@/(lib|components|contexts|hooks|types)" mini/funnel/` ничего не находит.
- Удаление `mini/funnel/` и `app/funnel/` (+ `app/api/funnel/`) не ломает сборку основного сайта.
