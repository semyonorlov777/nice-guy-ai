---
name: book-audit
description: "Аудит книги-программы на соответствие текущему стандарту платформы. Проверяет: промпты, welcome, кросс-связки, иконки, темы, тест-интеграцию, routes. Triggers: 'аудит книги', 'проверь книгу', 'book audit', 'аудит программы', 'проверка качества', 'что не хватает в книге', 'сравни с эталоном', 'audit book', 'check program quality', 'аудит', 'проверка книги'."
---

# Book-Audit: Аудит программы на соответствие стандарту

## Обзор

Этот скилл проверяет любую книгу-программу платформы на соответствие текущему стандарту качества. Выдаёт список «чего не хватает» с конкретными рекомендациями.

**Вход:** Slug программы (напр. `nice-guy`, `games-people-play`, `5-love-languages`)
**Выход:** Файл `findings/{slug}-audit.md` с оценками и рекомендациями

## Перед началом работы

1. Прочитай `docs/runbooks/chat-message-formatting.md` — **source of truth** по форматированию сообщений и quick replies. Все проверки секций A8–A10 и B7–B10 в чеклисте идут оттуда: parseQuickReplies regex, три уровня контента (программный/режим/тема), антипаттерны (plain-text рендер, дубль title, вложенные «ёлочки» и т.д.)
2. Прочитай `references/CHECKLIST.md` — эталонный чеклист (обновляемая база знаний)
3. Прочитай `.claude/skills/book-to-modes/references/PLATFORM_MAP.md` — техническая карта платформы
4. Просмотри `.claude/skills/book-to-modes/examples/` — что известно о книге из ретроспектив
5. Если есть `findings/{slug}-audit.md` от прошлого аудита — прочитай для сравнения

## Процесс (3 этапа)

### Этап 1: Сбор данных

Автоматический — собери ВСЮ информацию перед проверкой:

**Из БД (Supabase MCP):**

```sql
-- 1. Все режимы программы
SELECT mt.key, mt.name, mt.icon, mt.chat_type, mt.route_suffix,
       pm.sort_order, pm.access_type, pm.enabled,
       CASE WHEN pm.system_prompt IS NOT NULL THEN LENGTH(pm.system_prompt) ELSE 0 END as prompt_len,
       CASE WHEN pm.welcome_message IS NOT NULL THEN LENGTH(pm.welcome_message) ELSE 0 END as welcome_len
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
JOIN programs p ON p.id = pm.program_id
WHERE p.slug = '{SLUG}'
ORDER BY pm.sort_order;

-- 2. Темы программы (если есть)
SELECT key, title, recommended_route
FROM program_themes
WHERE program_id = (SELECT id FROM programs WHERE slug = '{SLUG}')
ORDER BY sort_order;

-- 3. Тест-конфигурация (если есть)
SELECT tc.slug, tc.title,
  jsonb_array_length(tc.questions) as q_count,
  jsonb_array_length(tc.scales) as scale_count,
  tc.interpretation_prompt IS NOT NULL as has_interpretation,
  p.test_system_prompt IS NOT NULL as has_test_system_prompt,
  p.features->>'test' as test_feature_flag,
  p.landing_data->'test' IS NOT NULL as has_landing_test
FROM programs p
LEFT JOIN test_configs tc ON tc.program_id = p.id
WHERE p.slug = '{SLUG}';

-- 4. Тест mode_template (хаб-карточка)
SELECT mt.key, mt.is_chat_based, mt.route_suffix, pm.enabled
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
JOIN programs p ON p.id = pm.program_id
WHERE p.slug = '{SLUG}'
  AND mt.route_suffix LIKE '/test/%';

-- 5. Темы с привязкой к тесту
SELECT key, title, test_scale_key
FROM program_themes
WHERE program_id = (SELECT id FROM programs WHERE slug = '{SLUG}')
  AND test_scale_key IS NOT NULL;
```

**Из кода:**

```
-- 6. Routes
Glob: app/program/[slug]/(app)/**/page.tsx

-- 7. Иконки
Read: components/hub/mode-icons.tsx → найти iconMap

-- 8. prepare-context.ts
Read: lib/chat/prepare-context.ts → найти appendTestScores()
```

**Из файлов скилла:**

```
-- 9. Ретроспектива
Read: .claude/skills/book-to-modes/examples/{slug}.md (если существует)
```

**Из промптов (глубокая проверка):**

Для КАЖДОГО режима с prompt_len > 0 — прочитать полный system_prompt:
```sql
SELECT mt.key, pm.system_prompt
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
JOIN programs p ON p.id = pm.program_id
WHERE p.slug = '{SLUG}' AND pm.system_prompt IS NOT NULL;
```

Проверить содержимое каждого промпта на наличие обязательных секций.

### Этап 2: Проверка по чеклисту

Пройди КАЖДЫЙ пункт из `references/CHECKLIST.md`. Для каждого:

- ✅ **Ок** — полностью соответствует стандарту
- ⚠️ **Частично** — есть, но неполно или устаревший формат
- ❌ **Отсутствует** — нужно добавить или исправить
- ⬜ **Неприменимо** — пункт не относится к этой программе (напр. «тест» для книги без теста)

Результат — таблица:

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| A1 | Кол-во режимов ≥ 7 | ✅/⚠️/❌ | Детали |

Посчитай сводку: сколько ✅, ⚠️, ❌ из общего числа применимых пунктов.

**⏸ СТОП. Покажи результаты пользователю. Дождись подтверждения перед рекомендациями.**

### Этап 3: Рекомендации

Для каждого ❌ и ⚠️ — конкретная рекомендация:

```
### [код пункта] — [название проверки]

**Статус:** ❌/⚠️
**Проблема:** Что не так (1-2 предложения)
**Решение:** Конкретное действие (SQL / код / файл)
**Трудозатраты:** Оценка (5 мин / 15 мин / 30 мин / 1 час)
**Приоритет:** 1 (критично) / 2 (улучшение) / 3 (косметика)
```

Сгруппируй по приоритету.

Сохрани результат в `findings/{slug}-audit.md`.

## Формат файла результатов

```markdown
# Аудит: {Название программы}

**Дата:** {дата}
**Slug:** {slug}
**Версия чеклиста:** {версия из CHECKLIST.md}
**Предыдущий аудит:** {дата или «первый»}

## Сводка

| Статус | Количество |
|--------|-----------|
| ✅ Ок | N |
| ⚠️ Частично | N |
| ❌ Отсутствует | N |
| ⬜ Неприменимо | N |
| **Итого применимых** | **N** |
| **Оценка качества** | **N%** (✅ / применимых) |

## Детали

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| A1 | ... | ... | ... |

## Рекомендации

### Приоритет 1 (критично)
...

### Приоритет 2 (улучшение)
...

### Приоритет 3 (косметика)
...

## Следующие шаги

1. ...
2. ...
```

## Обновление чеклиста

После КАЖДОГО аудита — проверь:

1. **Нашёл ли ты проблему, которой нет в CHECKLIST.md?** → Добавь новый пункт
2. **Есть ли пункт, который ВСЕГДА ✅ у всех книг?** → Возможно, избыточен — пометь для удаления
3. **Нужно ли разбить пункт на подпункты?** → Если проверка слишком широкая — разделяй
4. **Изменился ли стандарт платформы?** → Обнови критерии проверки

Если обновляешь CHECKLIST.md:
- Увеличь номер версии
- Добавь запись в «Лог изменений» в конце файла
- Укажи причину изменения

## Правила общения

- Отвечай на русском языке
- Обращайся на «ты»
- Не пропускай пункты чеклиста — проверяй ВСЕ
- При сомнении — ставь ⚠️, не ✅
- Промпты читай ПОЛНОСТЬЮ, не по первым строкам
