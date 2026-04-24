# Handoff: массовая уборка промптов по 6 книгам

**Дата:** 2026-04-24
**Предыдущие работы:** см. [docs/chat-audit-eq-2-0.md](./chat-audit-eq-2-0.md) и коммиты `41a9c52`, `55f9b36`, `3197b74`, `7ee6262`, `dba493b` — закрыли архитектурные баги рендера чатов и написали SQL-линтер.

## Контекст в одно предложение

Архитектура чатов починена (единый `<AIBubble>` + `<QuickReplyBar>`, парсер «ёлочек» в `lib/chat/`, `remark-breaks`, SQL-линтер в `npm run check:chats`). Теперь надо пройтись по **56 ошибкам + 19 предупреждениям** линтера в прод-БД — это system_prompts всех 6 книг, в которых остались слабые формулировки quick-replies правил и literal-плейсхолдеры `«Вариант 1»`.

## Prompt для нового чата

```
Прочитай docs/prompts-cleanup-handoff.md — там весь контекст.

Задача: пройти по 56 ошибкам линтера `npm run check:chats` и исправить
промпты в прод-БД Supabase. Это не рефакторинг кода, а массовая правка
текстов system_prompt / anonymous_system_prompt / author_chat_system_prompt
/ welcome_replies в таблицах programs и program_modes.

Правила форматирования промптов — docs/runbooks/chat-message-formatting.md
+ .claude/skills/book-to-modes/references/REFERENCE.md §5.

Принцип работы: файл-миграция в scripts/fix-<book>-<area>.sql →
прогон через mcp__supabase__execute_sql → перегенерировать
соответствующий seed-файл в scripts/seed-<book>*.sql (чтобы
seed == прод, не было drift).

После каждой книги — npm run check:chats должен показывать меньше
ошибок. Финальная цель — 0 errors.

Коммитить отдельным коммитом на книгу. После всех 6 — деплой (merge
main + push, по правилам memory).
```

## Что уже сделано (не трогать)

- **Единый рендерер чатов** — `components/chat/ChatMessage.tsx` экспортирует `<AIBubble>` и `<QuickReplyBar>`. Парсер в `lib/chat/parse-quick-replies.ts` толерантен к markdown-маркерам (`* `, `- `, `• `, `1. `).
- **remark-breaks подключён** — одинарный `\n` теперь не склеивается в пробел.
- **SQL-линтер** `npm run check:chats` (`scripts/check-chat-seed.ts`) — ходит в прод-БД, применяет правила runbook-а.
- **Документация** — `CLAUDE.md`, `docs/runbooks/chat-message-formatting.md`, `.claude/skills/chat-rules/SKILL.md` содержат архитектурный инвариант и все правила по quick replies.

## Как запустить аудит

```bash
cd <worktree>
npm run check:chats
```

Требуется `.env.local` с `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — скопируй из основного проекта (`cp ../../../.env.local .`).

## Каталог ошибок по книгам (на момент 2026-04-24)

### nice-guy (12 errors, 3 warnings)
- **[P1]** `programs.system_prompt` — literal `«Вариант 1 от первого лица»` в ПРАВИЛЬНОМ примере
- **[P1]** `programs.author_chat_system_prompt` — то же
- **[P1]** 6 tool-режимов (`ng_relationships`, `ng_theory`, `ng_boundaries`, `exercises`, `ng_quiz`, `ng_parents`, `ng_my_syndrome`, `free_chat`, `author_chat`) — тот же literal placeholder
- **[P2]** `free_chat`, `author_chat`, `exercises` — нет exit в welcome_replies
- **[P2]** `free_chat`, `author_chat` — нет контрпримера `НЕПРАВИЛЬНО` в system_prompt

### eq-2-0 (1 error, 3 warnings)
- **[P1]** `programs.system_prompt` — literal placeholder
- **[P2]** `programs.author_chat_system_prompt` — нет `НИКОГДА не склеивай`, нет контрпримера
- **[P2]** `author_chat`, `eq_strategies` — нет exit в welcome_replies

### love-languages (9 errors, 3 warnings)
- **[P1]** `programs.system_prompt`, `author_chat_system_prompt`, и 6 tool-режимов — literal placeholder
- **[P1]** `anonymous_system_prompt` — вообще нет блока `QUICK REPLIES`
- **[P2]** `free_chat`, `author_chat` — нет exit-reply
- **[P2]** `author_chat.system_prompt` — нет контрпримера

### games-people-play (10 errors, 3 warnings)
- **[P1]** `programs.system_prompt`, `author_chat_system_prompt`, 7 tool-режимов (все `ta_*`) — literal placeholder
- **[P1]** `anonymous_system_prompt` — нет блока `QUICK REPLIES`
- **[P2]** `free_chat`, `author_chat` — нет exit
- **[P2]** `free_chat.system_prompt` — нет контрпримера

### razgovorny-gipnoz (10 errors, 2 warnings)
- **[P1]** `programs.system_prompt`, `author_chat_system_prompt`, 5 tool-режимов (все `hypno_*`) — literal placeholder
- **[P1]** `anonymous_system_prompt` — нет блока `QUICK REPLIES`
- **[P0]** 5 tool-режимов (`hypno_negotiate`, `hypno_detect`, `hypno_suggest`, `hypno_rapport`, `hypno_trance`) — markdown `**bold**` в `welcome_ai_message` — видно буквально как `**текст**` на welcome-экране!
- **[P2]** `free_chat`, `author_chat` — нет exit

### 100-notes (7 errors, 2 warnings)
- **[P1]** `programs.system_prompt`, `author_chat_system_prompt`, 6 tool-режимов (все `notes_*`) — literal placeholder
- **[P2]** `free_chat`, `author_chat` — нет exit

## Шаблон фикса

### 1. Замена literal «Вариант 1» на тематические примеры

Для каждого режима нужны **тематические** примеры «ёлочек» по теме режима. Смотри `.claude/skills/book-to-modes/references/REFERENCE.md` §5.

**БЫЛО** (плохо):
```
## Quick replies — ФОРМАТ

«Вариант 1 от первого лица»
«Вариант 2»
«Мне сложно сформулировать»
```

**СТАЛО** (пример для `ng_relationships`):
```
## Quick replies — ФОРМАТ

...
ПРАВИЛЬНО:

[твой ответ и один вопрос пользователю]

«Она ждёт от меня больше инициативы»
«Чувствую что меня используют»
«Не понимаю чего она на самом деле хочет»
«Мне сложно сформулировать»
```

### 2. Добавление блока QR для `anonymous_system_prompt` (3 книги)

`games-people-play`, `razgovorny-gipnoz`, `love-languages` — `anonymous_system_prompt` слишком короткий, нет правил quick-replies. Добавить блок с конкретными примерами для demo.

### 3. Добавление exit-reply в `welcome_replies`

```sql
-- БЫЛО:
'[{"text": "A", "type": "normal"}, ..., {"text": "D", "type": "normal"}]'::jsonb

-- СТАЛО:
'[{"text": "A", "type": "normal"}, ..., {"text": "D", "type": "exit"}]'::jsonb
```
Последний reply → `type: "exit"`.

### 4. Убрать `**bold**` из razgovorny-gipnoz welcome_ai_message

Прямая правка текста — убрать `**…**` обёртки (это plain-text рендер, markdown не работает).

## Процесс по одной книге

1. `npm run check:chats 2>&1 | grep "<slug>"` — выписать ошибки этой книги
2. Открыть `scripts/seed-<slug>*.sql` как source-of-truth. Отредактировать там.
3. Написать миграцию `scripts/fix-<slug>-prompts-cleanup-2026-04-XX.sql` — `UPDATE programs SET ... WHERE slug = '<slug>'` и `UPDATE program_modes SET ... FROM mode_templates mt WHERE mt.key = '<mode>' AND ...`
4. Применить миграцию через `mcp__supabase__execute_sql`
5. Повторно прогнать `npm run check:chats` → проверить что по этой книге 0 errors
6. Коммит: `fix(<slug>): cleanup QR placeholders + exit-replies + ...`

## Порядок работы

**Рекомендую в таком порядке (от лёгкого к сложному):**

1. **eq-2-0** — всего 1 error + 3 warns, тренировка процесса
2. **100-notes** — 7 errors, структурно простые
3. **nice-guy** — 12 errors, 3 warns — основной продукт
4. **love-languages** — 9 errors, + написать anonymous QR с нуля
5. **games-people-play** — 10 errors, + написать anonymous QR с нуля
6. **razgovorny-gipnoz** — 10 errors + markdown в welcome (P0, визуальный баг) + написать anonymous QR

После всех 6 — `npm run check:chats` должен выдавать `✅ all chat fields pass runbook checklist`.

## Deploy

По памяти пользователя: после готовности — `git checkout main && git merge --ff-only <branch> && git push origin main`. Без спрашивания. Vercel подхватит автоматом, короткий отчёт пользователю.

## Полезные файлы

- **Правила**: `docs/runbooks/chat-message-formatting.md`, `.claude/skills/book-to-modes/references/REFERENCE.md` (§5), `.claude/skills/chat-rules/SKILL.md`
- **Линтер**: `scripts/check-chat-seed.ts`
- **Образец миграции**: `scripts/fix-eq-2-0-strengthen-quick-reply-rule.sql` (усиление 5 EQ-режимов), `scripts/fix-100-notes-strengthen-quick-reply-rule.sql`
- **Seed-файлы** (source-of-truth): `scripts/seed-<slug>*.sql`
- **Рендерер чатов** (НЕ трогать): `components/chat/ChatMessage.tsx`, `lib/chat/parse-quick-replies.ts`

## Open debt (не в этом скоупе)

- **Chat scroll architecture** — см. [docs/chat-scroll-task.md](./chat-scroll-task.md). Пользователь отметил что в ChatGPT/Claude скроллится вся страница, а у нас только область чата. Отдельная задача с риском регрессий на мобилке — не трогать параллельно с этой уборкой.
