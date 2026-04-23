# Brief для параллельного чата: доработки «Эмоциональный интеллект 2.0» + системные фиксы платформы

## Контекст

Книга-программа `eq-2-0` уже деплоена на прод (`nice-guy-ai.vercel.app/program/eq-2-0`). 4 SQL seed выполнены, регрессия пройдена, лендинг/хаб/тест/режимы рендерятся. Retrospective: [.claude/skills/book-to-modes/examples/eq-2-0.md](.claude/skills/book-to-modes/examples/eq-2-0.md).

**На проде нашли 7 проблем — большинство из них СИСТЕМНЫЕ (затрагивают все книги, не только EQ). Решать не только «здесь и сейчас для EQ», но и найти корневое решение + обновить skill `book-to-modes` чтобы баг больше не повторялся при добавлении новых книг.**

---

## 7 проблем (по приоритету системности)

### 🔴 СИСТЕМНО #1. CSP блокирует фото автора с нового издательского домена

**Симптом:** На лендинге EQ фото Бредберри не рендерится. Прямая ссылка `https://www.mann-ivanov-ferber.ru/assets/images/authors/bradberry.jpg` в браузере открывается, но с лендинга — нет.

**Корневая причина:** [next.config.ts:8](next.config.ts:8) — CSP `img-src` хардкодит список разрешённых доменов. `mann-ivanov-ferber.ru` там нет → браузер блокирует.

**Текущий список:** `*.yandex.ru *.yandex.net cdn.litres.ru drglover.com upload.wikimedia.org lh3.googleusercontent.com *.googleusercontent.com *.cdn-telegram.org imo10.labirint.ru dg.cyclowiki.org`

**Системное решение (выбрать одно):**

**Вариант A — расширяемый список хостов:**
- Добавить `*.mann-ivanov-ferber.ru` в CSP (решит сейчас)
- В скилл `book-to-modes` добавить pre-seed чеклист: «Если photo_url — новый домен, добавить в `next.config.ts` CSP `img-src` ПЕРЕД seed».
- Обновить `PLATFORM_MAP.md` с инструкцией.

**Вариант B — прокси через next/image:**
- Все внешние картинки обёртывать в `<Image />` с `remotePatterns` в next.config. CSP ослабевает, картинки кэшируются на edge. Более элегантно архитектурно, но требует refactor `AuthorSection.tsx` и `HeroSection.tsx` (обложка книги).

**Вариант C — гибрид:** обложка через next/image (рекурентный паттерн — cdn.litres.ru уже в allowlist, но next/image даёт кэш и responsive), фото автора локально — скачать и положить в `/public/authors/{slug}.jpg`.

**Рекомендация:** Вариант C. Обложки всех книг централизовать через next/image (уже cdn.litres.ru). Фото автора — скачать в `/public/authors/` при seed, избавиться от внешних URL вообще. Это решит проблему раз и навсегда + добавляет offline resilience.

**Что сделать:**
1. Скачать `https://www.mann-ivanov-ferber.ru/assets/images/authors/bradberry.jpg` в `/public/authors/bradberry.jpg`, обновить `landing_data.author.photo_url` на `/authors/bradberry.jpg` в БД
2. Для существующих книг (nice-guy, games-people-play, 5-love-languages, razgovorny-gipnoz, 100-notes, eq-2-0) — пройти и привести фото автора к локальным путям
3. Обновить `.claude/skills/book-to-modes/SKILL.md` и `references/PLATFORM_MAP.md` — «Этап 4.5: photo_url всегда локальный путь `/authors/{slug}.jpg`, фото скачивается перед seed»
4. Скилл `book-audit` — добавить проверку «photo_url → локальный, не внешний»

---

### 🔴 СИСТЕМНО #2. Welcome-сообщения plain-text рендерятся слипшимся блоком без переносов

**Симптом:** На скринах «Что я сейчас чувствую», «66 стратегий», «Что с ним происходит», «Свободный чат» — буллеты `•` и абзацы идут в одну строку без переносов. Читаемость нулевая.

**Корневая причина:** `welcome_ai_message` в БД содержит `\n\n` между абзацами и `\n` перед буллетами. [NewChatScreen.tsx](components/chat/NewChatScreen.tsx) рендерит это plain-text (не через ReactMarkdown, т.к. runbook `chat-message-formatting.md` запрещает markdown в этом поле).

**Гипотеза:** CSS `white-space` не `pre-line` — `\n` в HTML сворачивается в пробел. Либо текст разбивается на `<p>` без переносов.

**Что сделать:**
1. Проверить [NewChatScreen.tsx](components/chat/NewChatScreen.tsx) — как welcome_ai_message рендерится. Скорее всего `<p>{text}</p>` без обработки `\n`.
2. Решение: либо `white-space: pre-line` в CSS, либо `.split('\n\n').map(p => <p>{p.split('\n').map(...)}</p>)`.
3. Протестировать на ВСЕХ книгах — это системный баг, возможно раньше не замечали из-за markdown в старых seed (hypnosis использует `**bold**` + `\n\n`, возможно там рендерилось через другой pipeline).
4. Обновить runbook `chat-message-formatting.md` — уточнить точный формат и проверку.

---

### 🟡 СИСТЕМНО #3. AI не генерирует Quick Replies в «ёлочках» в самом чате

**Симптом:** В режимах `eq_strategies`, `eq_social_awareness` (скрины 4, 5) после первого сообщения пользователя AI выдаёт в конце **plain text**:

```
Вариант 1
Вариант 2
Мне сложно сформулировать
```

Без «ёлочек». Парсер [ChatWindow.tsx:50-73](components/ChatWindow.tsx:50) не распознаёт — кнопки не рендерятся.

**Гипотеза:** Gemini Pro 2.5 Flash не повторяет инструкцию про «ёлочки» из system_prompt, особенно когда в промпте есть literal пример `«Вариант 1»` — модель считает это placeholder'ом для реальных вариантов и вставляет текст без кавычек.

**Что сделать:**
1. Воспроизвести на dev — посмотреть raw response Gemini (Network tab) в любом режиме. Точно понять: AI забывает «ёлочки» или забывает генерировать replies вообще?
2. Улучшить system_prompt: вместо пустого шаблона — **КОНКРЕТНЫЙ пример с русским контекстом**:
   ```
   ПРАВИЛЬНО (пример):
   «Да, хочу разобрать ситуацию с коллегой»
   «Я сам не понимаю что чувствую»
   «Мне сложно сформулировать»
   ```
   Не использовать `«Вариант 1»` как placeholder — модель путает плейсхолдер с инструкцией.
3. Возможно добавить middleware на бэкенде: если ответ содержит plain-text на концах строк, но не в «ёлочках» — автоматически обернуть. Риск: хрупкий regex. Лучше фикс через prompt.
4. Прогнать ВСЕ 5 кастомных промптов EQ + другие книги, где может быть та же проблема.

---

### 🟡 #4. Визуальный контраст exit-reply слишком слабый

**Симптом:** На скрине free_chat 4-я кнопка «Не знаю о чём спросить» имеет `type: exit`, но визуально почти идентична normal-кнопкам.

**Корневая причина:** [globals.css:3816-3817](app/globals.css:3816) — `.nc-reply-exit { background: transparent; border-color: var(--border); color: var(--text-muted); }`. В тёмной теме цвет `--text-muted` слишком близок к active reply.

**Что сделать:**
1. Усилить контраст: меньше opacity, явно другой цвет текста, возможно смещённый по вертикали отступ.
2. Визуальный префикс «✕» или стрелка «→»? (обсудить с дизайном).
3. A/B на мобиле + десктопе.

---

### 🟠 СПЕЦИФИЧНО EQ #5. Hero-заголовок «EQ — навык, а не черта» непонятен

**Симптом:** Сокращение «EQ» без контекста. Пользователь не связывает с книгой.

**Что сделать:**
```sql
UPDATE programs
SET landing_data = jsonb_set(
  landing_data, '{hero_title}',
  '"<em>Эмоциональный интеллект</em> — навык, а не черта"'
)
WHERE slug = 'eq-2-0';
```

(Проверить что `<em>` не ломает layout при длинном title — возможно понадобится обновить hero-layout CSS для >50 символов.)

---

### 🟠 СПЕЦИФИЧНО EQ #6. Режим `eq_strategies` игнорирует отсутствие теста

**Симптом:** Пользователь кликает «Покажи результат теста и подбери под него», **не пройдя тест**. AI отвечает:
> «По результатам теста твоя зона роста — Самосознание. Значит, развитие...»

Это ложь — теста нет, top_zone = null.

**Что сделать:**
1. Обновить `system_prompt` режима `eq_strategies` — явная инструкция: «Если в `{{cross_mode_data}}` НЕТ поля `top_zone` или оно пустое — НЕ утверждай про результаты теста. Предложи: "Ты ещё не проходил тест. Давай выберем навык вручную или сначала тест за 5 минут?"»
2. То же проверить для всех 5 кастомных режимов EQ + других книг.

---

### 🔴 СИСТЕМНО #7. Общий audit всей системы чатов

Пользователь цитата: «всю систему чатов внутри нужно перепроверять и делать нормально».

**Что сделать:**
1. Прогнать **book-audit** скилл по всем 5 книгам (nice-guy, games-people-play, 5-love-languages, razgovorny-gipnoz, 100-notes, eq-2-0) по checklist:
   - welcome_ai_message правильный формат (plain text, корректные `\n`)
   - welcome_replies каждого режима: последний с `type: exit`
   - system_prompt содержит явный пример «ёлочек» с русским контекстом
   - Cross_mode_data guards: если данные пустые — AI не врёт
2. Отрефакторить общий блок правил в отдельный include, чтобы одна правка применялась ко всем книгам.

---

## Порядок работы (предложение)

Фаза 1 (блокер UX):
- #2 (форматирование welcome) + #3 (AI не ставит «ёлочки») — основа user experience чатов. Пока не решено — любые другие фиксы неэффективны.

Фаза 2 (системные):
- #1 (CSP/фото автора) — решить через локальные `/public/authors/`, обновить для всех книг
- #7 (audit всех книг) — после #2, #3 пройти все книги и валидировать

Фаза 3 (точечные):
- #5 (hero EQ) — один UPDATE
- #4 (exit visual) — дизайн + CSS
- #6 (eq_strategies guard) — UPDATE system_prompt

---

## Критические файлы

- `next.config.ts` — CSP
- `components/chat/NewChatScreen.tsx` — рендер welcome
- `components/ChatWindow.tsx` — парсер replies в диалоге
- `app/globals.css` — стили `.nc-reply`, `.nc-reply-exit`
- `.claude/skills/book-to-modes/SKILL.md` — процесс добавления книги
- `.claude/skills/book-to-modes/references/PLATFORM_MAP.md` — чеклист seed
- `docs/runbooks/chat-message-formatting.md` — канонический формат
- `scripts/seed-eq-2-0-modes.sql` — UPDATE system_prompts

## Что НЕ трогать

- 20 утверждений теста eq-test (уже в БД)
- scales, scoring, level_thresholds
- Архитектуру 8 режимов программы
- Существующие тесты (ISSP, GPP, hypnosis) — прошли регрессию в текущей сессии
