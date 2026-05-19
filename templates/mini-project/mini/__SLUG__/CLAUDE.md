# CLAUDE.md — мини-проект `__SLUG__`

## Что это

<2-3 предложения: какая методика/задача, кто целевая аудитория, что делает мини-проект>

## Жёсткие правила (изоляция)

Этот мини-проект — **изолированный**. Правила основного приложения (чат, режимы, портрет, скиллы `niceguy-design`/`chat-rules`/`book-to-modes`/`book-audit`) к нему **НЕ применяются**. Не открывай и не используй корневой `CLAUDE.md` как руководство.

### Запреты
- ❌ `import` из `@/lib/*`, `@/components/*`, `@/contexts/*`, `@/hooks/*`, `@/types/*` основного приложения.
- ❌ `import` из других `@mini/<other-slug>/*` — мини-проекты не знают друг о друге.
- ❌ Использование классов из основного `app/globals.css` (`.nc-msg`, `.msg`, `.btn-primary` и т.д.). Свои стили — всегда с префиксом `.__SLUG__-*` в `mini/__SLUG__/styles.css`.
- ❌ Общие React-компоненты основного (`<SiteFooter>`, `<Sidebar>`, `<MobileTabs>`, `<AuthSheet>`).
- ❌ Запросы к таблицам основного проекта в Supabase (`programs`, `profiles`, `chats`, `messages`, `exercises`, `portraits`, `test_*`).

### Разрешено
- ✅ Любые npm-зависимости из корневого `package.json` (React, ai, @ai-sdk/google, и т.д.).
- ✅ Шрифты из root `app/layout.tsx` (Onest, Cormorant Garamond) — наследуются через `<body>`.
- ✅ Env-переменные из общего `.env.local` (`GOOGLE_GEMINI_API_KEY` и т.д.). Свои переменные именуй с префиксом `__SLUG___*`.
- ✅ Шим в `app/__SLUG__/` — но только как re-export.

### Граничный случай
Если очень хочется переиспользовать функцию из основного `lib/` — **скопируй её сюда** (`mini/__SLUG__/lib/`). Это не «технический долг», это плата за изоляцию: основной код может измениться, мини от этого не сломается.

## Структура

```
mini/__SLUG__/
├── CLAUDE.md          (этот файл)
├── README.md          (описание для людей)
├── styles.css         (все классы с префиксом .__SLUG__-*)
├── pages/             (компоненты-страницы; рендерятся через шимы в app/__SLUG__/)
├── components/        (внутренние компоненты)
├── lib/
│   ├── ai.ts          (готовая обёртка Gemini Flash через AI SDK)
│   ├── rate-limit.ts  (готовый in-memory rate limiter)
│   ├── types.ts
│   └── prompts.ts
├── api/               (route handlers — экспортируют GET/POST)
└── migrations/        (SQL миграции если есть БД)
```

Шимы для роутинга Next.js — в `app/__SLUG__/`. Каждый файл там — 1-2 строки re-export.

## Маршруты

- `/__SLUG__` → `pages/HomePage.tsx` (через `app/__SLUG__/page.tsx`)

Добавление нового роута:
1. Создать `mini/__SLUG__/pages/XxxPage.tsx`.
2. Создать шим `app/__SLUG__/xxx/page.tsx`:
   ```tsx
   export { default } from "@mini/__SLUG__/pages/XxxPage";
   ```
3. Для API: создать `mini/__SLUG__/api/yyy.ts` с `export async function POST(...)`, шим `app/__SLUG__/api/yyy/route.ts`:
   ```ts
   export { POST } from "@mini/__SLUG__/api/yyy";
   ```

## Если нужна БД (Supabase)

По умолчанию **без БД**. Если понадобится:

1. `CREATE SCHEMA __SLUG__;` (через MCP `apply_migration` или Supabase Dashboard).
2. Все миграции — в `mini/__SLUG__/migrations/NNNN_*.sql`.
3. В Supabase Dashboard → API → Schemas → добавить `__SLUG__` к exposed schemas.
4. Создать `mini/__SLUG__/lib/db.ts`:
   ```ts
   import { createClient } from "@supabase/supabase-js";
   export const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
     { db: { schema: "__SLUG__" } }
   );
   ```
5. RLS — обязательна на каждую таблицу schema. К `public.*` не обращаться.

## Verification (перед коммитом)

- `npm run build` проходит без ошибок.
- В браузере `/__SLUG__` отображается и сценарий проходится до конца.
- `grep -rE "@/(lib|components|contexts|hooks|types)" mini/__SLUG__/` ничего не находит.
- Удаление `mini/__SLUG__/` и `app/__SLUG__/` не ломает сборку основного сайта.
