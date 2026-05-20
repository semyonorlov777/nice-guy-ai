# funnel — глубинный разбор по методике Волынского

Анонимный тест-воронка на 15-20 минут: пользователь проходит AI-адаптивный диагностический разговор и получает персональный разбор главного паттерна.

## Сценарий пользователя

1. **Приветствие** (`/funnel`) — что это, сколько времени, на что надеяться. Кнопка «Начать разговор».
2. **Тест** (`/funnel/test`) — 5 seed-вопросов (возраст, что отнимает силы, что уже пробовали и т.д.), затем 10-15 вопросов, которые Gemini Flash генерирует под уже данные ответы. Каждый вопрос — `scale` / `choice` / `open`. AI решает когда остановиться (но не раньше 14 и не позже 20).
3. **Анализ** (`/funnel/result`) — анимированный экран «готовлю разбор» (~70 сек), параллельно Gemini Pro пишет персональный разбор на 700-1000 слов. Когда готово — показывается разбор (markdown).
4. **Оффер** (`/funnel/offer`) — кнопки на школу Волынского и клуб (внешние ссылки).

Сессия сохраняется в `localStorage` (`funnel:session`, TTL 7 дней) — можно вернуться и продолжить.

## Stack

- Next.js 16 (App Router) — рендерится через шимы в `app/funnel/` и `app/api/funnel/`.
- React, TypeScript, Tailwind отсутствует — стили в `funnel.css` с префиксом `.funnel-*`.
- AI: Gemini Flash (`next-question`) + Gemini Pro (`analyze`) через `@ai-sdk/google` + пакет `ai`.
- БД: нет. Только `localStorage` на клиенте.
- Rate limit: in-memory (per-IP), `lib/rate-limit.ts`.

## Локальный запуск

```bash
npm install   # из корня
npm run dev   # next dev — http://localhost:3000/funnel
```

`GOOGLE_GEMINI_API_KEY` нужен в `.env.local` (или унаследован от корневого).

## Где что лежит

| Что | Файл |
|---|---|
| Канон методики (источник) | `lib/canon-volynsky.md` |
| Канон → TS-константа | `lib/canon.generated.ts` (AUTO-GENERATED) |
| System-prompts | `lib/prompts.ts` |
| Seed-вопросы | `lib/seed-questions.ts` |
| Типы | `lib/types.ts` |
| Состояние сессии (localStorage) | `lib/session.ts` |
| Gemini обёртка | `lib/ai.ts` |
| Rate limiter | `lib/rate-limit.ts` |
| AI: следующий вопрос | `api/next-question.ts` |
| AI: финальный разбор | `api/analyze.ts` |
| Главный flow | `components/TestFlow.tsx` |
| Экран вопроса | `components/QuestionScreen.tsx` |
| Экран анализа | `components/AnalyzingScreen.tsx` |
| Экран результата | `components/ResultScreen.tsx` |
| Экран приветствия | `components/WelcomeScreen.tsx` |
| Экран оффера | `components/OfferScreen.tsx` |
| Markdown bubble | `components/AIBubble.tsx` |
| Стили | `funnel.css` |
| Prebuild canon | `scripts/build-canon.mjs` |

## Правила (см. CLAUDE.md)

- Никаких `@/lib`, `@/components` основного проекта.
- Все CSS-классы — `.funnel-*`.
- Если нужна функция из основного — скопировать сюда, не импортировать.
