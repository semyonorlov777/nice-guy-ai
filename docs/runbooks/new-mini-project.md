# Runbook: создание нового мини-проекта

## Что такое мини-проект

Изолированная единица внутри репозитория `nice-guy-ai`, которая:
- Живёт в `mini/<slug>/` (вне `app/`, не индексируется Claude по умолчанию).
- Подключается к Next.js через тонкие шимы в `app/<slug>/` (1-2 строки re-export).
- Не зависит от кода основного приложения (никаких импортов из `@/lib`, `@/components`, `@/contexts`, `@/hooks`).
- Деплоится вместе с основным сайтом на тот же Vercel-проект, маршрут `nice-guy-ai.vercel.app/<slug>`.

Примеры существующих мини: `funnel` (тест-воронка Волынского), `spiral-test` (тест Карины — пока статичный HTML в `public/`).

Полный манифест и правила изоляции — в корневом [CLAUDE.md](../../CLAUDE.md) (секция «Мини-проекты — критическое правило»).

## Быстрый старт

```bash
npm run new-mini <slug>
npm run dev
# открыть http://localhost:3000/<slug>
```

`<slug>` — kebab-case, 3-31 символ, начинается с буквы. Не из reserved-списка (`api`, `auth`, `program`, `legal`, `balance`, `test`, `profile`, `chat`, `chats`, `exercise`, `exercises`, `portrait`, `hub`, `funnel`).

Скрипт создаёт:
- `mini/<slug>/` — всё содержимое (страницы, либы, API, стили, CLAUDE.md, README.md)
- `app/<slug>/` — шимы для роутинга Next.js

## Что заполнить руками после генерации

1. **`mini/<slug>/CLAUDE.md`** — раздел «Что это»: 2-3 предложения о задаче и аудитории.
2. **`mini/<slug>/README.md`** — описание + сценарий пользователя.
3. **`mini/<slug>/pages/HomePage.tsx`** — заменить заглушку на реальный UI.
4. Если нужны новые роуты:
   - Добавить компонент: `mini/<slug>/pages/XxxPage.tsx`.
   - Добавить шим: `app/<slug>/xxx/page.tsx`:
     ```tsx
     export { default } from "@mini/<slug>/pages/XxxPage";
     ```
5. Если нужны API:
   - Логика: `mini/<slug>/api/yyy.ts` с `export async function POST(req: Request) { ... }`.
   - Шим: `app/<slug>/api/yyy/route.ts`:
     ```ts
     export { POST } from "@mini/<slug>/api/yyy";
     ```

## Дизайн (если хочется тёмную эстетику основного)

В стартовом `mini/<slug>/styles.css` уже подключены:
- Тёмный фон `#111318`, текст `#f5f5f0`, акцент золото `#d4a545`.
- Шрифты `Cormorant Garamond` (заголовки) и `Onest` (текст) — наследуются из root `<body>`.

Не обязательно следовать — можно сделать совсем другую эстетику. Главное: все классы с префиксом `.<slug>-`, без использования классов основного `globals.css`.

## AI (Gemini Flash)

Готовая обёртка — `mini/<slug>/lib/ai.ts`. Использование в API:

```ts
// mini/<slug>/api/analyze.ts
import { streamText } from "ai";
import { chatModel, CHAT_PROVIDER_OPTIONS } from "@mini/<slug>/lib/ai";

export async function POST(req: Request) {
  const { message } = await req.json();
  const result = streamText({
    model: chatModel(),
    providerOptions: CHAT_PROVIDER_OPTIONS,
    messages: [{ role: "user", content: message }],
  });
  return result.toUIMessageStreamResponse();
}
```

ENV: `GOOGLE_GEMINI_API_KEY` (общая, уже есть в проекте).

## Rate limit

Готов в `mini/<slug>/lib/rate-limit.ts`. Использование:

```ts
import { createRateLimit } from "@mini/<slug>/lib/rate-limit";

const checkRateLimit = createRateLimit({ windowMs: 60_000, max: 10 });

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(ip)) {
    return new Response("Too many requests", { status: 429 });
  }
  // ...
}
```

## Если нужна БД (Supabase)

По умолчанию **без БД**. Если понадобится — изолируй через отдельную schema:

1. Создать schema через MCP `apply_migration` или Supabase Dashboard:
   ```sql
   CREATE SCHEMA <slug>;
   ```
2. Все миграции — в `mini/<slug>/migrations/NNNN_description.sql`. Применяй через MCP `apply_migration`.
3. Supabase Dashboard → API → Schemas → добавить `<slug>` к exposed schemas (по умолчанию только `public`).
4. Клиент в `mini/<slug>/lib/db.ts`:
   ```ts
   import { createClient } from "@supabase/supabase-js";
   export const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
     { db: { schema: "<slug>" } }
   );
   ```
5. RLS — обязательна на каждую таблицу. К `public.*` (таблицы основного проекта) НЕ обращайся.
6. Перед коммитом — `mcp__supabase__get_advisors` (security + performance) и `SELECT * FROM pg_policies WHERE schemaname = '<slug>'`.

## Перед коммитом — verification

```bash
# Сборка проходит
npm run build

# Импортов из основного проекта нет
grep -rE "@/(lib|components|contexts|hooks|types)" mini/<slug>/

# Удаление мини не ломает основной сайт
rm -rf mini/<slug>/ app/<slug>/
npm run build
git checkout -- mini app   # вернуть назад если всё ОК
```

## Шаблон промпта «создай мини одним сообщением»

Скопируй в новую сессию Claude, заменив `<slug>` и `<задача>`:

```
Создай мини-проект <slug> в этом репозитории.

ЗАДАЧА: <одно предложение что делает>

ДЕЙСТВИЯ:
1. Прочитай ТОЛЬКО docs/runbooks/new-mini-project.md и .claude/skills/niceguy-design/SKILL.md
   (для тёмной эстетики, если хочешь похожий стиль).
   НЕ читай корневой CLAUDE.md правила про чат/режимы/тесты — этот проект изолированный.
2. Запусти `npm run new-mini <slug>`.
3. Заполни mini/<slug>/CLAUDE.md (раздел "Что это") и README.md описанием задачи.
4. Реализуй сценарий:
   - <шаг 1>
   - <шаг 2>
   - <шаг 3>
5. Дизайн: тёмный фон #111318, золото-акцент #D4A545, шрифты Onest/Cormorant (наследуются).
6. AI (если нужен): Gemini Flash через AI SDK, обёртка в mini/<slug>/lib/ai.ts уже есть.
7. БД: не используй, если явно не сказано иначе.
8. ВСЕ файлы — в mini/<slug>/. В app/<slug>/ только шимы (re-export из @mini/<slug>/pages/).

ЖЁСТКИЕ ЗАПРЕТЫ (см. mini/<slug>/CLAUDE.md):
- никаких импортов из @/lib, @/components, @/contexts, @/hooks
- никакого использования классов основного globals.css
- никаких запросов к таблицам основного проекта в Supabase

ПЕРЕД КОММИТОМ:
- npm run build проходит
- grep -rE "@/(lib|components|contexts|hooks|types)" mini/<slug>/ ничего не находит
- на странице /<slug> сценарий проходится до конца
```
