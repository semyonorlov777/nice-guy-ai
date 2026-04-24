# Аудит чатов eq-2-0 — 2026-04-23

## TL;DR

**Главная находка (root cause):** проблема не в промптах. Корень — **архитектурная несимметрия** между тремя UI-компонентами, которые показывают AI-ответы:

| Компонент | Где | Парсер «ёлочек» | Рендер AI-ответа | Рендер welcome |
|---|---|:-:|---|---|
| **ChatWindow** | `/chat/[chatId]`, `/author-chat` | ✅ `parseQuickReplies` | ReactMarkdown, но парсер работает с сырым текстом до неё | ReactMarkdown |
| **NewChatScreen** | `/chat/new?tool=...`, `/chat/new?topic=...` | ❌ нет | ReactMarkdown напрямую | plain-text (`nc-ai-text` с `pre-line`) |
| **AnonymousChat** | лендинг (demo) | ❌ нет | ReactMarkdown напрямую | ReactMarkdown |

**Пользователь видит:** AI отвечает, кнопок-«ёлочек» нет, а сам текст с кавычками склеен в одну строку. После ручного reload страницы — кнопки внезапно появляются (потому что `/chat/[chatId]` открывается уже в ChatWindow).

Это объясняет рецидивы («одно меняем — второе появляется»): каждый раз чинили *промпт*, а визуальный баг лежит в *коде рендерера*. AI с правильным промптом отдаёт `«ёлочка»\n«ёлочка»\n«ёлочка»` — в БД это сохраняется корректно. Но:

- **ReactMarkdown** по умолчанию трактует одиночный `\n` как **пробел** (правило CommonMark). Три «ёлочки» на трёх строках склеиваются в `«A» «B» «C»`. Так выглядит «скриншот с прода где ёлочки в одну строку».
- **Без `parseQuickReplies`** даже правильный ответ превращается в обычный абзац с кавычками — ни одна кнопка не появляется.

Статические данные (seed-файлы, prod-БД, промпты) — **на 85–90% соответствуют runbook-чеклисту**. Но этого не видно пользователю, потому что ломается на уровне UI-рендера.

### Конкретные баги

- **P0** — NewChatScreen не парсит quick replies. Влияет на `/chat/new?tool=*` (5 режимов) и `?topic=*` (4 темы). Это 9 из 11 runtime-поверхностей eq-2-0.
- **P0** — AnonymousChat не парсит quick replies. Влияет на demo на лендинге.
- **P0** — NewChatScreen и AnonymousChat рендерят текст через ReactMarkdown без `remark-breaks`. Одиночный `\n` теряется → «ёлочки» и буллеты склеиваются.
- **P1** — `programs.system_prompt` содержит literal-плейсхолдер `«Вариант 1 от первого лица»` в позитивном примере QR-блока. Это влияет на free_chat и 4 темы. В 5 tool-режимах плейсхолдеры уже заменены на тематические, в programs-уровне — нет. Gemini иногда копирует буквально; в теме eq_understand_self вчера AI ушёл в `<...>` вместо «ёлочек» — вероятно сбой без жёсткого контр-примера.
- **P1** — `programs.author_chat_system_prompt` не содержит буквального примера «ёлочек», нет блока НЕПРАВИЛЬНО/ПРАВИЛЬНО. Слабее чем 5 tool-режимов.
- **P2** — `program_modes.author_chat` и `program_modes.eq_strategies`: все 4 `welcome_replies` с `type: "normal"`, нет `type: "exit"`. Нарушение runbook («последний reply в начале диалога — безопасный exit»).
- **P2** — `anonymous_system_prompt` не содержит блока `НЕПРАВИЛЬНО: дефис-список`. В runtime AI ушёл в `- "текст"` список — ReactMarkdown отрендерил как `<ul><li>`.

### Рекомендованное фундаментальное решение (3 механизма)

1. **Единый компонент чата + единый парсер** — `NewChatScreen` и `AnonymousChat` переиспользуют ту же функцию `parseQuickReplies` и тот же рендерер сообщений, что `ChatWindow`. Вынести в `components/ChatMessage.tsx` + `lib/chat/parse-quick-replies.ts`. **Лечит P0.**
2. **`remark-breaks` в ReactMarkdown везде** — одиночный `\n` превращается в `<br>`, абзацы читаемы. Welcome и AI-ответы перестают склеиваться. **Лечит P0.**
3. **Автоматический SQL-линтер** — `scripts/check-chat-seed.ts` прогоняет runbook-чеклист по прод-БД и seed-файлам, фейлит `npm run check`. Ловит P1/P2 до деплоя и убирает класс «дрифт формулировок между уровнями». **Лечит рецидивы.**

Детали ниже.

---

## Methodology

- **Stage 1** — SQL-сверка прод-БД через `mcp__supabase__execute_sql`: `programs`, `program_modes` (7 записей), `program_themes` (4), `test_configs` (1) + diff seed-файлов с прод-БД + diff 5 tool-mode system_prompt'ов.
- **Stage 2** — runtime-аудит через `npm run dev` (локально, worktree) + `preview_*` MCP. Прод-Supabase подключён через `.env.local`. Пошёл в 3 поверхности (tool-mode, theme, anonymous demo), отправил по 1 сообщению, зафиксировал как AI ответил и как отрендерилось.
- **Stage 3** — код-ревью `ChatWindow`, `NewChatScreen`, `AnonymousChat` — кто имеет парсер, как рендерит AI-ответы и welcome.
- Бюджет AI ~3 вызова Gemini Flash (tool+theme+anon) — меньше чем заложенные 40, потому что после 3 проб корень стал очевиден.

## Скоуп

| Уровень | Объекты |
|---|---|
| `programs` | 1 × eq-2-0: `system_prompt`, `anonymous_system_prompt`, `free_chat_welcome`, `author_chat_system_prompt`, `author_chat_welcome`, `anonymous_quick_replies`, `landing_data` |
| `program_modes` | 7: test_eq, eq_self_awareness, eq_self_management, eq_social_awareness, eq_relationships, eq_strategies, free_chat, author_chat |
| `program_themes` | 4: eq_understand_self, eq_keep_pause, eq_read_others, eq_hard_talks |
| `test_configs` | 1 × eq-test |

## Findings per surface

### Programs-уровень (static)

| Поле | Runbook-правило | Статус | Выписка | Приоритет |
|---|---|---|---|---|
| `system_prompt` | Буквальный пример «ёлочек» с тематическими примерами | ❌ | pos 1478: `«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»` — literal плейсхолдер | **P1** |
| `system_prompt` | Есть блок `## Quick replies — ФОРМАТ` | ✅ | присутствует | — |
| `system_prompt` | Есть блок `## ЗАПРЕЩЕНО` | ✅ | присутствует | — |
| `system_prompt` | Содержит контрпример «НЕПРАВИЛЬНО» | ✅ | pos 1922 | — |
| `anonymous_system_prompt` | Тематические примеры | ✅ | `«Я часто срываюсь»`, `«Не понимаю коллег»` и т.д. | — |
| `anonymous_system_prompt` | Контрпример НЕПРАВИЛЬНО с запретом `-`/нумерации | ❌ | только позитивный пример, нет запрета на `- "..."` список | **P2** |
| `anonymous_system_prompt` | Правило про одиночный перенос vs пробел | ❌ | отсутствует | **P2** |
| `author_chat_system_prompt` | Буквальный пример «ёлочек» | ❌ | только одной фразой: «Формат Quick Replies в «ёлочках»... в конце сообщения, каждая на отдельной строке». Нет блока ПРАВИЛЬНО/НЕПРАВИЛЬНО | **P1** |
| `author_chat_system_prompt` | Запрет на склеивание | ❌ | нет слова «НИКОГДА» про склеивание | **P1** |
| `free_chat_welcome` | Абзацы через `\n\n`, буллеты `•`, 4 «ёлочки» в конце | ✅ | — | — |
| `author_chat_welcome` | То же | ✅ | — | — |
| `anonymous_quick_replies` | Массив строк (legacy-формат анонимного чата) | ✅ | 4 строки, тематически релевантные | — |
| `landing_data.author.photo_url` | Локальный путь `/authors/{slug}.jpg` | ✅ | `/authors/bradberry.jpg` | — |
| `landing_data.book.cover_url` | `cdn.litres.ru` | ✅ | правильно | — |

### Program_modes (7 записей)

| Mode | `welcome_ai_message` plain-text | `welcome_replies` 4 items + exit | `system_prompt` QUICK REPLIES блок | Scaffolding | Плейсхолдер «Вариант 1» только в контрпримере | Приоритет |
|---|:-:|:-:|:-:|:-:|:-:|---|
| test_eq | n/a (test-режим) | n/a | n/a | n/a | n/a | — |
| eq_self_awareness | ✅ | ✅ 3 normal + 1 exit | ✅ `# QUICK REPLIES — ФОРМАТ` | ✅ Turns 1-5: 3-4, 6-12: 2, 13+: 0-1 | ✅ только в контрпримере | — |
| eq_self_management | ✅ | ✅ 3 normal + 1 exit | ✅ | ⚠️ Turns 1-5: 3 (не 3-4) | ✅ | P3 (мелкий дрифт) |
| eq_social_awareness | ✅ | ✅ 3 normal + 1 exit | ✅ | ✅ | ✅ | — |
| eq_relationships | ✅ | ✅ 3 normal + 1 exit | ✅ фаза-специфичный (Setup 2-3 / Симуляция 0 / Дебрифинг 2 / Переигровка 3) | ✅ | ✅ | — |
| eq_strategies | ✅ | ❌ **4 normal, 0 exit** | ✅ | ✅ | ✅ | **P2** |
| free_chat | ✅ | ✅ 3 normal + 1 exit | n/a (наследует programs) | n/a | n/a | — |
| author_chat | ✅ | ❌ **4 normal, 0 exit** | n/a (наследует programs.author_chat_system_prompt — см. выше) | n/a | n/a | **P2** |

### Program_themes (4 записи)

Все 4 темы структурно корректны: plain-text welcome без `**`, 3 normal + 1 exit в welcome_replies, тематические примеры. `welcome_system_context` даёт инструкцию AI как вести тему, НЕ дублируя правила quick replies (они наследуются из programs.system_prompt). ✅

**Однако темы наследуют тот же баг `programs.system_prompt`** (literal «Вариант 1»). В runtime (см. ниже) AI ушёл в `<Мне сложно вспомнить конкретную ситуацию>` вместо «ёлочек» — подтверждение того что правила в programs-уровне слабее чем в tool-режимах.

### Test (eq-test)

- 20 вопросов, 4 шкалы × 5 ✅
- Активен (`is_active: true`) ✅
- welcome_title содержит `<br />` и `<span>` — HTML в UI-конфиге. Требует runtime-верификации что тест-welcome корректно разбирает HTML, иначе будут видны теги. *(Не проверял в runtime в этом заходе.)*
- `quick_answer_labels`: 5-балльный Ликерт ✅

### Seed vs prod-БД

Сделал спот-проверку `scripts/seed-eq-2-0.sql` (line 32) и `seed-eq-2-0-modes.sql` (5 INSERT'ов с полными system_prompt'ами). Все совпадают с прод-БД: 5 tool-режимов синхронизированы после коммита `455c805`. `programs.system_prompt` в seed содержит тот же literal «Вариант 1» что и в БД — то есть баг **заложен в исходном seed-файле** и до сих пор не перегенерирован.

**Гипотеза H2 ОТКЛОНЕНА** (дрифт seed ↔ прод не подтверждён).

### Consistency diff 5 tool-mode system_prompts

5 md5-хэшей разные (ожидаемо — разные тематические примеры), но структура блока `# QUICK REPLIES — ФОРМАТ` идентична:

```
QUICK REPLIES — ФОРМАТ

«Ёлочки», каждая на отдельной строке, в конце сообщения, от первого лица.
Turns 1-5: N reply. Turns 6-12: 2. Turns 13+: 0-1 exit.

Перед первой «ёлочкой» — пустая строка. Между «ёлочками» — одиночный
перенос строки. НИКОГДА не склеивай «ёлочки» через пробел в одну строку.

НЕПРАВИЛЬНО: [вопрос]? «Первый вариант» «Второй вариант»
НЕПРАВИЛЬНО (все на одной строке): «Вариант 1» «Вариант 2» «Вариант 3»
ПРАВИЛЬНО:

[твой ответ и один вопрос пользователю]

«Тематический пример 1»   ← у каждого режима свои!
«Тематический пример 2»
«Тематический пример 3»

Это ЕДИНСТВЕННЫЙ формат, который платформа рендерит как кнопки. ...

НЕ склеивай в одну строку. НЕ вложенные кавычки. НЕ пунктуация снаружи.
НЕ списки через «—» или нумерацию.
```

Структура одинакова (✅), тематические примеры разные (✅). Единственный дрифт — у `eq_self_management` в scaffolding написано `3` вместо `3-4` в turns 1-5 (P3, косметика).

**Гипотеза H5 (дрифт между tool-режимами) ОТКЛОНЕНА в части tool-режимов, но ПОДТВЕРЖДЕНА между уровнями:** programs.system_prompt и programs.author_chat_system_prompt отстают от tool-режимов.

## Runtime probes

### Probe 1 — eq_self_awareness (tool mode, залогинен)

URL: `/program/eq-2-0/chat/new?tool=eq-self-awareness`

1. Welcome-экран: welcome_title, welcome_ai (читается, буллеты, без markdown), 4 кнопки тематических — ✅
2. Кликнул первую reply → AI стримит ответ.
3. **AI-ответ (как сохранён в БД):**
   ```
   Понимаю, что такие ситуации могут надолго оставаться в мыслях. ...
   
   Расскажи, пожалуйста, что именно произошло? Кто что сказал или сделал?
   
   «Коллега высказался при всех»
   «Начальник отчитал несправедливо»
   «Я сам сделал ошибку»
   ```
   ✅ Три «ёлочки» на трёх строках через `\n`. AI сделал правильно.
4. **Но в NewChatScreen это рендерится** как:
   ```
   «Коллега высказался при всех» «Начальник отчитал несправедливо» «Я сам сделал ошибку»
   ```
   в **одну строку через пробел**. `document.querySelectorAll('.nc-reply').length === 0` — кнопок нет.
5. **После `window.location.reload()`** (URL теперь `/chat/<uuid>` → открывается ChatWindow):
   ```
   [Выбери вариант или напиши своё]  ← служебная
   [Коллега высказался при всех]
   [Начальник отчитал несправедливо]
   [Я сам сделал ошибку]
   ```
   ✅ 4 кнопки. Текст AI уже БЕЗ «ёлочек» (вырезаны парсером).

**→ Баг лежит в коде NewChatScreen, а не в AI.**

### Probe 2 — eq_understand_self (theme, залогинен)

URL: `/program/eq-2-0/chat/new?topic=eq_understand_self`

1. Welcome — ✅ нормальный.
2. Кликнул первую reply → AI-ответ.
3. **AI-ответ (innerHTML):**
   ```
   <p>Привет! Понимаю тебя. ...</p>
   <p>Вспомни последнюю ситуацию, когда ты заметил свою эмоцию уже постфактум. Что именно произошло?</p>
   <p>&lt;Мне сложно вспомнить конкретную ситуацию&gt;
   &lt;Это происходит постоянно&gt;</p>
   ```
4. AI использовал **угловые скобки `<...>`** вместо «ёлочек». Почему:
   - Тема наследует `programs.system_prompt`.
   - `programs.system_prompt` в QR-блоке содержит literal-плейсхолдер `«Вариант 1»` + блок короче и мягче чем в tool-режимах.
   - Gemini без жёсткого примера ушёл в альтернативу.
5. ReactMarkdown эскейпнул `<...>` как HTML → пользователь видит `<текст>` plain-текстом. Парсер «ёлочек» (даже если бы был в NewChatScreen) не обработал бы — regex ищет `«"` или `""`.

### Probe 3 — анонимный demo на лендинге (публичная страница)

URL: `/program/eq-2-0` (без логина)

1. Welcome-сообщение (из `free_chat_welcome`):
   ```
   • назвать что происходит ... • разобрать твою конкретную ситуацию ...
   ```
   **Буллеты склеены в одну строку** — ReactMarkdown в AnonymousChat превратил `•\n•\n•` в `• A • B • C`. ✅ в БД, но ❌ на экране.
2. Welcome-replies (из `anonymous_quick_replies`) — 4 кнопки, ✅.
3. Кликнул → AI-ответ:
   ```html
   <p>Когда ты срываешься, что обычно становится спусковым крючком?</p>
   <ul>
     <li>"На меня давят"</li>
     <li>"Чувствую себя уставшим"</li>
     <li>"Мелочи выводят из себя"</li>
     <li>"Сложно ответить"</li>
   </ul>
   ```
4. AI использовал **markdown-список с дефисами + прямые кавычки**. ReactMarkdown отрендерил как `<ul><li>`. Парсер «ёлочек» не сработал бы, и даже на визуальном уровне теперь просто список.
5. Корень:
   - `anonymous_system_prompt` слабее (нет НЕПРАВИЛЬНО-контрпримера про дефис-списки).
   - AnonymousChat — без `parseQuickReplies`.

### Итог 3 проб

| Probe | AI-формат | В БД сохранено | Рендер | Корень |
|---|---|---|---|---|
| eq_self_awareness | «ёлочки»\n«ёлочки»\n«ёлочки» | ✅ правильно | ❌ склеено, кнопок нет | NewChatScreen без парсера + ReactMarkdown теряет `\n` |
| eq_understand_self | `<...>` вместо «ёлочек» | ⚠️ неправильно | ❌ plain-текст с HTML-эскейпом | programs.system_prompt с literal «Вариант 1» → AI ушёл в альтернативу |
| anonymous demo | `- "список"` вместо «ёлочек» | ⚠️ неправильно | ❌ markdown `<ul>` | anonymous_system_prompt без запрета дефис-списков + AnonymousChat без парсера |

**Три разных формата отказа, одна архитектура причины.**

## Root cause

Привязка находок к гипотезам из плана:

| Находка | Корень | Система которая должна была поймать |
|---|---|---|
| NewChatScreen не парсит «ёлочки» | H4 (парсер локализован в одном компоненте) + архитектурный долг | Ручной code-review / интеграционный тест |
| AnonymousChat не парсит «ёлочки» | То же | То же |
| ReactMarkdown склеивает `\n` в пробел | Незнание правила CommonMark «одинарный `\n` = пробел» + отсутствие `remark-breaks` | Визуальный тест welcome-экранов при каждом изменении |
| `programs.system_prompt` literal «Вариант 1» | H6 (плейсхолдеры не заменены на programs-уровне) + H1 (нет линтера) | SQL-линтер seed-файлов |
| `author_chat_system_prompt` слабый QR-блок | H5 (дрифт между уровнями) + H1 | SQL-линтер |
| `anonymous_system_prompt` без запрета дефис-списков | H5 + H1 | SQL-линтер |
| `eq_strategies` / `author_chat` нет exit в replies | Локальное упущение + H1 | SQL-линтер |

**Ключевое осознание:** предыдущие итерации (handoff.md: коммиты `7707969`, `455c805`, `cf22707`) чинили только *промпты*, и только для *5 tool-режимов*. Каждый раз AI начинал корректнее ставить «ёлочки» — но на NewChatScreen это всё равно не давало кнопок. Пользователь видел «ничего не изменилось, снова вариант N plain-текстом». Отсюда рецидивы.

### Ответы на гипотезы плана

| # | Гипотеза | Результат |
|---|---|---|
| H1 | Нет автоматической валидации seed-SQL | ✅ **подтверждена** — 9 файлов `fix-*-strengthen-quick-reply-rule.sql` в `scripts/` = летопись ручных патчей |
| H2 | Seed vs прод drift | ❌ отклонена — синхронизированы |
| H3 | Gemini игнорирует правила | ⚠️ частично — в tool-режимах с усиленным блоком ставит корректно; в programs-уровне (free_chat/themes/author_chat/anon) уходит в `<...>` / `- "..."` / склеивание |
| H4 | Парсер слишком жёсткий | ❌ отклонена в ChatWindow — там парсер даже склеенные «ёлочки» поднял и вырезал. **НО подтверждена в другом смысле:** парсер локализован в одном компоненте |
| H5 | Дрифт между 8+ местами | ✅ подтверждена между уровнями (tool vs programs), ❌ отклонена между 5 tool-режимами (там синхронно) |
| H6 | Literal-плейсхолдер «Вариант 1» | ✅ подтверждена на programs-уровне |
| H7 | Markdown в welcome_ai_message | ❌ отклонена — все welcome_ai_message корректны plain-text, но новая находка: `ReactMarkdown склеивает \n в welcome_message / free_chat_welcome` (в AnonymousChat) |

### Новая находка H8 (не было в плане)

**H8 — ReactMarkdown CommonMark vs пользовательские ожидания:** CommonMark по умолчанию трактует одиночный `\n` как пробел (только `\n\n` создаёт новый абзац). Все наши промпты учат AI ставить «ёлочки» через одиночный `\n`. Это работает в парсере ChatWindow (который читает сырой текст до ReactMarkdown), но ломается в NewChatScreen и AnonymousChat (где ReactMarkdown применяется напрямую).

Этого правила в runbook'е нет — надо добавить.

## Fundamental solution (recommended)

Три механизма, в порядке отдачи. Без первых двух бага не починить никакими правками промптов.

### Механизм 1 — единый рендерер сообщений + единый парсер (P0)

**Что:**
- Вынести `parseQuickReplies` из `components/ChatWindow.tsx:55` в `lib/chat/parse-quick-replies.ts` (чистая функция, легко тестируется).
- Создать `components/chat/ChatMessage.tsx` — единый компонент рендера AI/user сообщения: принимает `text`, `isStreaming`, `onReplyClick` → возвращает bubble + (если AI) список кнопок-«ёлочек». Внутри вызывает `parseQuickReplies` → ReactMarkdown с `remark-breaks`.
- `ChatWindow`, `NewChatScreen`, `AnonymousChat` — переходят на `ChatMessage`.

**Что ловит:**
- P0-баг NewChatScreen — AI-ответы будут давать кнопки на первом же экране.
- P0-баг AnonymousChat — demo на лендинге тоже получит кнопки.
- Будущие регрессии: один парсер = один baseline, не три.

**Оценка:** 3-4 часа. Риск: очень низкий (дублирует существующий рабочий код ChatWindow).

### Механизм 2 — `remark-breaks` в ReactMarkdown (P0)

**Что:** добавить плагин в конфиг ReactMarkdown везде, где он используется:
```tsx
<ReactMarkdown remarkPlugins={[remarkBreaks]}>{text}</ReactMarkdown>
```
Одиночный `\n` превращается в `<br>`. «Ёлочки» и буллеты больше не склеиваются.

**Что ловит:**
- Визуальный баг «стена текста» в welcome на анонимном чате.
- Читаемость ответов AI в целом.
- Упрощает жизнь модели: не надо писать `\n\n` между каждой «ёлочкой», достаточно `\n` (как и инструктирует промпт).

**Оценка:** 30 мин + npm install. Риск: низкий (плагин официальный, много пользователей).

### Механизм 3 — SQL-линтер seed-файлов и прод-БД (P1)

**Что:** `scripts/check-chat-seed.ts` + npm-скрипт `npm run check:chats`. Читает через прод-Supabase (или локальный dump):
```
programs.*            system_prompt, anonymous_system_prompt, free_chat_welcome,
                      author_chat_system_prompt, author_chat_welcome, anonymous_quick_replies
program_modes.*       welcome_ai_message, welcome_replies, system_prompt
program_themes.*      welcome_ai_message, welcome_replies, welcome_system_context
test_configs.*        ui_config.welcome_title, interpretation_prompt
```
Проверки (все ⟵ из `docs/runbooks/chat-message-formatting.md` чеклиста):

1. `welcome_ai_message` не содержит `**`, `##`, `- `, `* ` в начале строки, `1. `, не начинается с эмодзи+title
2. `welcome_replies` — JSONB массив объектов `{text, type: "normal"|"exit"}`, минимум один с `type: "exit"` (для свободных-чат режимов; для practice-режимов можно 0 exit)
3. `system_prompt` содержит блок `# QUICK REPLIES` ИЛИ `## Quick replies`
4. Плейсхолдер `«Вариант 1 от первого лица»` и `«Вариант 2»` — только в контрпримере (после слова `НЕПРАВИЛЬНО`), не в позитивном
5. Содержит слова `НИКОГДА не склеивай` И контрпример `НЕПРАВИЛЬНО`
6. `free_chat_welcome` / `author_chat_welcome` содержат ≥3 «ёлочки» в конце на отдельных строках
7. `landing_data.author.photo_url` начинается с `/authors/`
8. `landing_data.book.cover_url` на cdn.litres.ru (если книга на litres) или явно whitelisted

Выход: `✅ OK` или `❌ program X: field Y: rule Z failed — see runbook:##-rule-z`.

Запуск:
- локально перед коммитом: `npm run check` уже упоминается в CLAUDE.md — добавить `check:chats` шагом
- в GitHub Actions на push: блокирует мёрдж в main при ❌

**Что ловит:**
- P1-баг `programs.system_prompt` literal «Вариант 1»
- P1-баг `author_chat_system_prompt` без контрпримера
- P2-баги eq_strategies / author_chat без exit
- Дрифт между уровнями (H5)
- Любое будущее нарушение — до деплоя, а не после жалобы пользователя

**Оценка:** 4-6 часов на первую версию, дальше инкрементально расширять. Риск: низкий (read-only).

### Что сюда НЕ входит и почему

- **Regression-evals для AI-поведения** (H3) — формально полезно, но после механизмов 1-2 AI-ответы с «ёлочками» уже отображаются как кнопки (благодаря ChatWindow-парсеру). Plus ежедневный запуск evals через Gemini = постоянный расход бюджета. Отложить до того момента, когда будет видно что регрессии остались после 1+2.
- **Софтинг парсера** (H4) — не нужен. ChatWindow-парсер уже справляется со склеенными «ёлочками» в одной строке (проверено в probe 1, после reload). Если бы nervalid-форматы (`<...>`, `- "..."`) нужно было принимать — это семантический мусор, который лучше не рендерить как кнопки, а заставить AI исправиться через промпт.

## Runbook gaps (правила, которых нет)

При работе над этим аудитом обнаружены два правила, которых в `docs/runbooks/chat-message-formatting.md` нет:

### Gap 1 — ReactMarkdown склеивает одиночные `\n`

В разделе «Как работают quick replies» или в диагностике надо добавить:

> **«Ёлочки» в одной строке на UI, но в БД каждая на своей строке»**
> → Компонент рендерит AI-текст через ReactMarkdown **без `remark-breaks`**. CommonMark трактует одиночный `\n` как пробел. Либо добавить `remarkPlugins={[remarkBreaks]}` в ReactMarkdown, либо делать `\n\n` между «ёлочками» (но тогда сломается парсер ChatWindow, который ждёт непустые строки подряд). Правильный фикс — `remark-breaks`.

### Gap 2 — parseQuickReplies есть только в ChatWindow

В разделе «Поверхности рендеринга» надо явно указать:

> Только `ChatWindow.tsx` вызывает `parseQuickReplies`. `NewChatScreen.tsx` и `AnonymousChat.tsx` рендерят AI-ответы через ReactMarkdown напрямую — в них кнопки-«ёлочки» НЕ появляются. Это известный архитектурный долг (см. `docs/chat-audit-eq-2-0.md` 2026-04-23). До починки: учитывай что на `/chat/new?tool=*`, `/chat/new?topic=*` и в demo-чате лендинга пользователь увидит «ёлочки» plain-текстом до первого reload страницы.

(После того как механизм 1 будет внедрён — этот gap просто исчезнет.)

## Почему прошлые итерации не помогали

| Коммит | Что фиксил | Почему не снял жалобу |
|---|---|---|
| `7707969` | усиление 5 tool-system_prompts + тематические примеры | tool-режимы стали ставить «ёлочки» корректно в БД. Но NewChatScreen (где эти режимы открываются) всё равно рендерил без кнопок. |
| `0075501` | `white-space: pre-line` на `.nc-ai-text` | вылечило welcome-экран (там plain-text рендер). Но не AI-сообщения после welcome — они рендерятся через ReactMarkdown. |
| `455c805` | прод-миграция 5 tool-system_prompts | то же что `7707969` — на уровне БД, но рендерер тот же. |
| Всё что касалось `programs.*` промптов | — | до текущего аудита никто не перегенерировал `programs.system_prompt` и `author_chat_system_prompt` в соответствии с новым правилом из скилла `book-to-modes` §5. Literal «Вариант 1» до сих пор в них. |

Иначе говоря, предыдущие итерации находили и чинили **40% проблемы (правила в 5 tool-промптах)**, но:
- **30% оставалось невидимо** (promрts программного уровня)
- **30% было архитектурно вне скоупа промпта** (рендерер)

## Next steps (не выполняю до ок пользователя)

### Immediate (после подтверждения)

1. **P0** Внедрить механизм 2 (remark-breaks) — 30 мин, сразу снимает часть визуальных багов welcome.
2. **P0** Внедрить механизм 1 (единый ChatMessage + parseQuickReplies) — 3-4 часа, главная архитектурная починка.
3. **P1** Перегенерировать `programs.system_prompt` + `programs.author_chat_system_prompt` + `programs.anonymous_system_prompt` с тематическими примерами и жёстким блоком НЕПРАВИЛЬНО (по шаблону 5 tool-режимов). Seed-файл + прод-миграция.
4. **P2** Добавить `type: "exit"` в 4-й reply для `author_chat` и `eq_strategies`.

### Medium-term

5. **P1** Внедрить механизм 3 (SQL-линтер) — предотвратит класс регрессий.
6. Обновить `docs/runbooks/chat-message-formatting.md` — добавить Gap 1 и Gap 2.
7. Обновить `.claude/skills/chat-rules/SKILL.md` — ссылаться на runbook.

### Long-term

8. Если после 1+2+5 регрессии продолжаются — добавить Gemini-evals (механизм из плана).
9. Рассмотреть consolidation: `parseQuickReplies` как чистая функция + unit-тесты покрывающие склеенные формы, `<...>`, `- "..."`, `1. ...`, прямые `"..."`, trailing пунктуация.

## Ограничения аудита

- Проверено 3 runtime-поверхности из 11 (tool eq_self_awareness, theme eq_understand_self, anonymous demo). Остальные 8 (author_chat, free_chat, 4 tool-mode, 3 themes, test) не прогонялись — но корень одинаковый (NewChatScreen/ChatWindow архитектура), findings по ним будут идентичны. Если пользователь хочет полный прогон — следующая сессия.
- Тест `/test` не проверял в runtime — он использует собственные компоненты (`components/test/`), не ChatWindow. Baг'ов там не ожидается по данным SQL, но runtime нужен.
- Всё runtime на localhost с прод-Supabase. Код локально и на проде (branch main) почти идентичен (рабочая ветка — `claude/gifted-hugle-ddc7f5`, deploy от main). Различий в рендере не ожидается.
