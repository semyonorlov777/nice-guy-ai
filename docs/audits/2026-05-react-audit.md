# React / Next.js аудит — 2026-05-17

**Скоуп:** четыре файла.
**Скиллы:** `vercel-react-best-practices` (70 правил, 8 категорий), `vercel-composition-patterns` (4 категории).
**Уровни:** только CRITICAL и HIGH. MEDIUM/LOW не включены.

CRITICAL = `async-*` (waterfalls) + `bundle-*` (bundle size).
HIGH = `server-*` (server perf) + `architecture-*` (composition).

Инвариант проекта: стриминговые компоненты (`NewChatScreen`, `ChatWindow`) обязаны быть `"use client"` — превращение в Server Component не предлагается.

## CRITICAL

app/program/[slug]/(app)/chat/[chatId]/page.tsx:19-57 | async-parallel | 6 последовательных `await` (createClient, auth.getUser, programs lookup, chats lookup, getUserProfileForChat, exercises count, getChatMessages) для независимых запросов — классический waterfall, удваивает/утраивает TTFB страницы чата | После `auth.getUser` объединить `[programs lookup, chats lookup]` в `Promise.all`, затем `[getUserProfileForChat, exercises count, getChatMessages]` в `Promise.all` — все три зависят только от уже известных `user.id` / `program.id` / `chat.id`

app/program/[slug]/(app)/chat/[chatId]/page.tsx:69-96 | async-defer-await + async-parallel | Дополнительный условный `await` для `welcomeMessage` (exercise / author / tool-mode JOIN на program_modes ↔ mode_templates) идёт ПОСЛЕ всех остальных await — лишний RTT, хотя зависит только от `chat.exercise_id` / `chat.chat_type` (известны на line 39) | Запускать `welcomeMessage` lookup параллельно с user-profile / exerciseCount / messages в общем `Promise.all` — ветка выбирается по `chat.chat_type` синхронно, запрос отправляется сразу после получения chat

components/chat/ChatListPage.tsx:5,7 + components/chat/NewChatScreen.tsx:9 + components/icons/hub-icons.tsx:509-547 | bundle-barrel-imports + bundle-analyzable-paths | `@/components/icons/hub-icons` — барель на 548 строк (40+ иконок + `THEME_ICON_MAP` со статическими ссылками на большинство из них). Импорт одного `PlusIcon` / `ArrowRightIcon` затаскивает весь файл в bundle — `THEME_ICON_MAP` препятствует tree-shaking | Вынести `THEME_ICON_MAP` в отдельный модуль `components/icons/theme-map.ts`, импортируемый только там, где он реально нужен (компоненты хаба с темами); либо разбить `hub-icons.tsx` на по-файловую структуру

## HIGH

app/program/[slug]/(app)/hub/page.tsx:21-31 | server-parallel-fetching | `supabase.auth.getUser()` и `supabase.from("programs")...` идут sequentially перед основным `Promise.all` (line 40) — независимы, лишний RTT до начала параллельного блока | `const [{ data: { user } }, { data: program }] = await Promise.all([supabase.auth.getUser(), supabase.from("programs").select(...).eq("slug", slug).single()])`, затем валидация и основной `Promise.all`

app/program/[slug]/(app)/hub/page.tsx:48 (вызов getLastActiveMode из lib/queries/modes.ts:84-119) | server-parallel-fetching | `getLastActiveMode` внутри делает 2 sequential `await` (`chats` → `mode_templates` по chat_type), что удлиняет общий `Promise.all` блок на этом ребре | Переписать как один JOIN-запрос (`chats` LEFT JOIN `mode_templates` через chat_type) либо распараллелить внутри хелпера, если chat_type предсказуем

app/program/[slug]/(app)/chat/[chatId]/page.tsx:48,51,57 + app/program/[slug]/(app)/hub/page.tsx:48,53,75 | server-cache-react | Серверные хелперы `getChatMessages`, `getUserProfileForChat`, `getProgramModes`, `getProgramThemes`, `getLastActiveMode` не обёрнуты в `React.cache()` — при повторном вызове в одном request (layout + page, page + nested RSC) идёт дублирующий запрос в Supabase | Обернуть каждую функцию через `import { cache } from "react"; export const getChatMessages = cache(async (...) => {...})` — дедупликация per-request бесплатна

components/chat/NewChatScreen.tsx:50-66 | rerender / advanced-init-once | `new DefaultChatTransport({ api, body: () => ({...}) })` создаётся при каждом рендере `NewChatScreen`, передаётся в `useChat` — AI SDK перенастраивает transport на каждый рендер (включая каждое сообщение в стриме) | Мемоизировать: `const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat", body: () => ({ chatId: chatIdRef.current, programId, chatType, topicKey: topic, toolKey: tool, topicContext, chatTitle: welcome.title }) }), [programId, chatType, topic, tool, topicContext, welcome.title])` — `body` остаётся функцией, читает свежие значения через closure/ref
