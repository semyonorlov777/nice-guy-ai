# Runbook: Тюнинг системных промптов

**Когда использовать:** При изменении поведения AI в чате, тесте или портрете.
**Время выполнения:** ~15-30 минут на один промпт
**Требования:** Supabase SQL Editor или Supabase Dashboard (Table Editor)
**Связанный ADR:** [ADR-004](../adr/004-context-assembly.md)

## Предварительные проверки

- [ ] Понимаешь иерархию промптов (mode > program > exercise) — см. [ADR-004](../adr/004-context-assembly.md)
- [ ] Знаешь какой именно промпт менять (и в какой таблице)
- [ ] Текущий промпт сохранён (для отката)

## Где живут промпты

| Промпт | Таблица | Поле | Приоритет |
|--------|---------|------|-----------|
| Режим (free_chat, author, тема) | `program_modes` | `system_prompt` | **Высший** — перекрывает program-level |
| Программа (free_chat fallback) | `programs` | `system_prompt` | Fallback если mode пуст |
| Автор-чат fallback | `programs` | `author_chat_system_prompt` | Для chatType="author" если mode пуст |
| Анонимный чат (лендинг) | `programs` | `anonymous_system_prompt` | Для `/api/chat/anonymous` |
| Упражнение | `exercises` | `system_prompt` | Аддитивный (добавляется к base) |
| Портрет | `programs` | `portrait_prompt` | Для `lib/gemini-portrait.ts` |
| Интерпретация теста | `test_configs` | `interpretation_prompt` | Для AI-анализа результатов |

### Важно: Mode vs Program

```
Если program_modes.system_prompt НЕ пуст → используется ОН
Если program_modes.system_prompt ПУСТ   → fallback на programs.system_prompt
```

Большинство промптов сейчас живут в `program_modes.system_prompt`. Проверь:

```sql
SELECT mt.chat_type, pm.system_prompt IS NOT NULL as has_mode_prompt
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
WHERE pm.program_id = (SELECT id FROM programs WHERE slug = '{slug}');
```

## Шаги

### 1. Сохранить текущий промпт (для отката)

```sql
-- Для mode-level промпта:
SELECT pm.system_prompt
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
WHERE pm.program_id = (SELECT id FROM programs WHERE slug = '{slug}')
  AND mt.chat_type = '{chat_type}';

-- Для program-level промпта:
SELECT system_prompt FROM programs WHERE slug = '{slug}';
```

Скопируй результат — это твой backup.

### 2. Обновить промпт

```sql
-- Mode-level (рекомендуется):
UPDATE program_modes pm
SET system_prompt = E'{новый промпт}'
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '{slug}')
  AND mt.chat_type = '{chat_type}';

-- Program-level:
UPDATE programs
SET system_prompt = E'{новый промпт}'
WHERE slug = '{slug}';
```

> ⚠️ Используй E-строку (E'...') для escape-символов (\n).

**Ожидаемый результат:** `UPDATE 1`.

### 3. Дождаться обновления кэша

Кэш `lib/config.ts` — **60 секунд TTL**. Два варианта:

- **Подождать 60 секунд** — кэш протухнет автоматически
- **Рестартнуть dev-сервер** — кэш сбрасывается при старте

> В production кэш всегда 60с. Если нужно мгновенное обновление — это можно сделать только рестартом serverless function (новый деплой).

### 4. Проверить в чате

```bash
npm run dev
# http://localhost:3000/api/auth/dev-login
# http://localhost:3000/program/{slug}/chat
```

Задай вопрос и проверь что AI отвечает в соответствии с новым промптом.

## Верификация

1. ✅ AI отвечает согласно новому промпту
2. ✅ Стиль, тон, длина ответа соответствуют ожиданиям
3. ✅ Welcome message не сломался (если менял mode-level)
4. ✅ Другие режимы той же программы не затронуты
5. ✅ Анонимный чат на лендинге работает (если менял anonymous_system_prompt)

## Откат

```sql
-- Вставь сохранённый промпт обратно:
UPDATE program_modes pm
SET system_prompt = E'{старый промпт}'
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '{slug}')
  AND mt.chat_type = '{chat_type}';
```

Подожди 60 секунд для протухания кэша.

## Частые ошибки

| Симптом | Причина | Решение |
|---------|---------|---------|
| AI отвечает по-старому | Кэш 60с не протух | Подожди 60с или рестартни dev-сервер |
| AI игнорирует промпт | Обновил `programs.system_prompt`, но `program_modes.system_prompt` не пуст | Mode-level перекрывает program-level. Обнови mode-level |
| Escape-ошибка в SQL | Одинарная кавычка внутри промпта | Экранируй: `'` → `''` (или используй `$$` dollar-quoting) |
| Welcome message пропал | Обновил mode, но обнулил `welcome_message` | Проверь что UPDATE не затрагивает другие поля |
| Промпт слишком длинный | Gemini лимит на system instruction | Сократи до ~4000 токенов |

## Советы по промптам

1. **Структурируй** — используй `═══ СЕКЦИЯ ═══` разделители (как в существующих промптах)
2. **Ограничения в конце** — AI лучше следует последним инструкциям
3. **Конкретные примеры** — "Отвечай 2-4 абзаца, потом вопрос" лучше чем "отвечай коротко"
4. **Тестируй пограничные случаи** — попробуй вопросы не по теме, грубость, попытки jailbreak
5. **Перечитай ADR-004** — убедись что промпт работает в контексте всех слоёв
