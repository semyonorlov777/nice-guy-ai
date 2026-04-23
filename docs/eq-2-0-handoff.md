# EQ 2.0 fixes — Handoff для следующего чата

**Дата:** 2026-04-23
**Исходный бриф:** [docs/eq-2-0-fixes-brief.md](./eq-2-0-fixes-brief.md) — 7 проблем с прода книги «Эмоциональный интеллект 2.0».
**Статус:** Фаза 1 и Фаза 2 блоки A+B закрыты. Осталась Фаза 2 блок C + Фаза 3 + 2 debt item.

---

## Что сделано в предыдущем чате (7 коммитов в `main`)

### Фаза 1 — блокеры UX

| Коммит | Что | Проблема |
|--------|-----|----------|
| `1c142c3` | chore: принёс seed-файлы EQ из параллельного worktree | — |
| `0075501` | fix(chat): `white-space: pre-line` на `.nc-ai-text` | #2 welcome слипался |
| `7707969` | fix(eq-2-0): seed 5 EQ system_prompts — усиленный QUICK REPLIES блок | #3 AI не ставил «ёлочки» |
| `455c805` | fix(eq-2-0): миграция прод-БД (`scripts/fix-eq-2-0-strengthen-quick-reply-rule.sql`) | #3 применено в прод |

### Фаза 2 блок B — концептуальная доработка скилла

| Коммит | Что |
|--------|-----|
| `56780c9` | `book-to-modes`: SKILL.md + REFERENCE.md §5 + PLATFORM_MAP.md — правила чтобы новые книги не страдали от класса багов EQ |

Ключевые добавления в скилл:
- Обязательная замена плейсхолдеров `«Вариант 1»` на **тематически-конкретные** примеры при вставке QUICK REPLIES блока в каждый system_prompt.
- welcome_ai_message — plain-text рендер, `\n\n` между абзацами обязательны.
- `photo_url` автора — **ВСЕГДА локальный путь** `/authors/{slug}.jpg`, внешние URL запрещены (CSP).
- Верификационный SELECT после INSERT расширен: проверки `has_niggda_rule`, `has_counter_example`, `placeholders_replaced`, `is_local_photo`.

### Фаза 2 блок A — фото авторов локально

| Коммит | Что | Проблема |
|--------|-----|----------|
| `0301717` | fix(eq-2-0): `/authors/bradberry.jpg` (54 KB) + seed + прод-БД | #1 CSP блокировал mann-ivanov-ferber.ru |
| `0d386fb` | fix(landing): остальные 5 фото локально + CSP img-src обрезан (убраны drglover.com, upload.wikimedia.org, dg.cyclowiki.org) | #1 полностью закрыт |

Все 6 книг теперь: `landing_data.author.photo_url = "/authors/{slug}.(jpg\|png)"`.

---

## Что осталось (для нового чата)

### Фаза 2 блок C — аудит (ОСТОРОЖНО: пользователь сказал что не уверен в скилле `book-audit`, он мог протухнуть)

**C1. Ревизия скилла `book-audit`** (`.claude/skills/book-audit/`):
- Прочитать SKILL.md + references/CHECKLIST.md.
- Сверить со свежим состоянием платформы:
  - `welcome_replies` — теперь типизированные объекты `{text, type: "normal"|"exit"}`, не строки.
  - QUICK REPLIES блок в system_prompt — новый усиленный формат с `НИКОГДА не склеивай`, НЕПРАВИЛЬНО/ПРАВИЛЬНО, тематическими примерами.
  - `photo_url` — локальный путь.
  - welcome_ai_message — plain-text с `\n\n` между абзацами.
- Если чеклист скилла отстал — обновить.

**C2. Прогон обновлённого `book-audit` по всем 6 книгам:**
- nice-guy, games-people-play, love-languages, razgovorny-gipnoz, 100-notes, eq-2-0
- Составить отчёт: что найдено per-book.

**C3. Исправить найденное** — ожидаемо 10-20 мелких пунктов.

### Фаза 3 — точечные (из брифа)

- **#4** — усилить контраст `.nc-reply-exit` в [app/globals.css:3816-3817](../app/globals.css:3816). Цвет `--text-muted` слишком близок к normal reply в тёмной теме. Возможно префикс «✕» или «→».
- **#5** — EQ hero `UPDATE programs SET landing_data = jsonb_set(landing_data, '{hero_title}', '"<em>Эмоциональный интеллект</em> — навык, а не черта"') WHERE slug = 'eq-2-0';` (проверить что длинный title не ломает hero-layout).
- **#6** — guard в `eq_strategies` system_prompt на отсутствие `top_zone`: если пользователь не проходил тест — AI не должен врать «по результатам твоего теста...». Добавить правило: «Если `{{cross_mode_data}}` не содержит `top_zone` или он пустой — предложи сначала пройти тест или выбрать навык вручную».

### Debt items (мелкое, вне scope брифа)

1. **`public/authors/glover.png`** — 2.4 MB, 1920×1080. В прод URL изначально был `drglover.com/.../Certification.png` — это сертификат, не портрет. Надо найти нормальное фото Гловера (Wikipedia Commons / drglover.com /about/ / издательство), заменить, вписать в `landing_data.author.photo_url`.
2. **100-notes cover_url** — использует `imo10.labirint.ru/books/768816/cover.jpg/2000-0`. По правилу `book-to-modes` обложки должны быть с `cdn.litres.ru`. Найти книгу на litres.ru, взять cover_url, обновить БД + seed + убрать `imo10.labirint.ru` из CSP в `next.config.ts`.

---

## Критические файлы

**Код:**
- [app/globals.css:3807](../app/globals.css:3807) — `.nc-ai-text` с `white-space: pre-line` (задача #2)
- [components/chat/NewChatScreen.tsx:185](../components/chat/NewChatScreen.tsx:185) — рендер welcome
- [components/ChatWindow.tsx:50-73](../components/ChatWindow.tsx:50) — парсер «ёлочек», **не менять**
- [next.config.ts](../next.config.ts) — CSP `img-src` (комментарии внутри объясняют логику)

**SQL:**
- [scripts/seed-eq-2-0-modes.sql](../scripts/seed-eq-2-0-modes.sql) — source of truth для 5 EQ режимов
- [scripts/fix-eq-2-0-strengthen-quick-reply-rule.sql](../scripts/fix-eq-2-0-strengthen-quick-reply-rule.sql) — миграция (уже применена в прод)
- [scripts/fix-100-notes-strengthen-quick-reply-rule.sql](../scripts/fix-100-notes-strengthen-quick-reply-rule.sql) — образец паттерна миграции

**Скиллы (обновлены, читать перед работой):**
- [.claude/skills/book-to-modes/SKILL.md](../.claude/skills/book-to-modes/SKILL.md)
- [.claude/skills/book-to-modes/references/REFERENCE.md](../.claude/skills/book-to-modes/references/REFERENCE.md) — особенно §5 про Quick replies
- [.claude/skills/book-to-modes/references/PLATFORM_MAP.md](../.claude/skills/book-to-modes/references/PLATFORM_MAP.md) — верификационный SELECT после INSERT
- [.claude/skills/book-audit/SKILL.md](../.claude/skills/book-audit/SKILL.md) — **требует ревизии (C1)**

**Runbook:**
- [docs/runbooks/chat-message-formatting.md](./runbooks/chat-message-formatting.md) — канонический формат welcome/QR, не менять

---

## Prompt для нового чата

```
Прочитай docs/eq-2-0-handoff.md — там весь контекст что сделано + что осталось.

Начни с Фазы 2 блок C (ревизия и прогон book-audit):
1. C1 — прочитай .claude/skills/book-audit/SKILL.md + references/CHECKLIST.md,
   сверь с актуальным состоянием платформы (правила из book-to-modes после
   коммита 56780c9 — typed welcome_replies, усиленный QUICK REPLIES, локальные
   фото, \n\n в welcome). Обнови чеклист если отстал.

2. C2 — прогони обновлённый аудит по 6 книгам.

3. C3 — исправь найденное.

После C — согласуй переход к Фазе 3 (#4 contrast, #5 EQ hero, #6 eq_strategies
guard).

Правила из CLAUDE.md: русский язык, коммиты раздельные, обновляй документацию
при изменении паттернов. Деплой — см. memory (push в main без спрашивания).
```

---

## Проверка прода (для пользователя после деплоя)

- Открыть https://nice-guy-ai.vercel.app/program/eq-2-0 → фото Бредберри грузится.
- Открыть `/program/eq-2-0/chat/new?tool=eq_self_awareness` → welcome-сообщение с читаемыми абзацами и буллетами.
- Кликнуть любой quick-reply → перейти в чат → AI отвечает, внизу появляются 3 кнопки (а не plain-текст).
- Console в браузере не должна показывать CSP violations для картинок.
