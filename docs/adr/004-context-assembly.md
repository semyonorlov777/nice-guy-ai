# ADR-004: Context Assembly — слоёные системные промпты

**Статус:** accepted
**Дата:** 2026-03-28

> **Контекст для Claude Code:** Читай при добавлении нового типа чата, изменении промптов, или отладке неправильного поведения AI.

## Контекст

AI-чат должен учитывать множество контекстов одновременно:
- Какая книга (программа)
- Какой режим чата (свободный, автор, упражнение, тематический)
- Данные пользователя (портрет из прошлых разговоров)
- Результаты теста (баллы по шкалам)
- Тема текущего разговора

Если собрать промпт неправильно — AI "забудет" контекст книги или проигнорирует портрет пользователя.

## Решение

### Иерархия промптов (приоритет сверху вниз)

```
┌─────────────────────────────────────────┐
│ 1. Mode-level prompt                    │  ← program_modes.system_prompt
│    (наивысший приоритет)                │     Если есть — используется вместо program-level
├─────────────────────────────────────────┤
│ 2. Program-level prompt                 │  ← programs.system_prompt
│    (fallback если mode-level пуст)      │     ИЛИ programs.author_chat_system_prompt (для author)
├─────────────────────────────────────────┤
│ 3. Exercise context                     │  ← exercises.system_prompt
│    (ДОПОЛНЯЕТ, не заменяет)             │     Добавляется через \n\n---\nТЕКУЩЕЕ УПРАЖНЕНИЕ:
├─────────────────────────────────────────┤
│ 4. Portrait context                     │  ← portraits.content.ai_context
│    (ДОПОЛНЯЕТ)                          │     \n\n---\nКОНТЕКСТ ПОЛЬЗОВАТЕЛЯ:
├─────────────────────────────────────────┤
│ 5. Test scores                          │  ← test_results.scores_by_scale
│    (ДОПОЛНЯЕТ)                          │     \n\n---\nДАННЫЕ ТЕСТА ISSP:
├─────────────────────────────────────────┤
│ 6. Topic context                        │  ← передаётся клиентом
│    (ДОПОЛНЯЕТ)                          │     Контекст тематического чата
└─────────────────────────────────────────┘
```

### Логика в коде: `lib/chat/prepare-context.ts`

**Шаг 1 — Base prompt (замещение):**
```typescript
// Mode-level перекрывает program-level
if (chatType) {
  const modeRow = await supabase
    .from("program_modes")
    .select("system_prompt, welcome_message, mode_templates!inner(chat_type)")
    .eq("program_id", programId)
    .eq("mode_templates.chat_type", chatType)
    .maybeSingle();

  if (modeRow?.system_prompt) systemPrompt = modeRow.system_prompt;
}

// Fallback: program-level
if (!systemPrompt) {
  systemPrompt = chatType === "author" && program.author_chat_system_prompt
    ? program.author_chat_system_prompt
    : program.system_prompt;
}
```

**Шаг 2 — Обогащение (аддитивное):**
```typescript
// Exercise (если exerciseId передан)
if (exercise?.system_prompt) {
  systemPrompt += `\n\n---\nТЕКУЩЕЕ УПРАЖНЕНИЕ: ${exercise.title}\n${exercise.system_prompt}`;
}

// Portrait
systemPrompt = appendPortraitContext(systemPrompt, portrait);

// ISSP scores
systemPrompt = await appendIsspScores(supabase, systemPrompt, userId, programId);
```

### Welcome message — аналогичная иерархия

```
mode-level welcome → exercise welcome → program-level welcome
(program_modes.welcome_message → exercises.welcome_message → programs.free_chat_welcome)
```

### Где хранятся промпты

| Промпт | Таблица.поле | Приоритет |
|--------|-------------|-----------|
| Основной режима | `program_modes.system_prompt` | Высший |
| Основной программы | `programs.system_prompt` | Fallback |
| Автор-чат | `programs.author_chat_system_prompt` | Для chatType="author" |
| Упражнение | `exercises.system_prompt` | Аддитивный |
| Портрет (AI-контекст) | `portraits.content.ai_context` | Аддитивный |
| Тест-результаты | `test_results.scores_by_scale` | Аддитивный |
| Интерпретация теста | `test_configs.interpretation_prompt` | Для тест-анализа |

## Альтернативы

| Вариант | Почему отвергнут |
|---------|------------------|
| Один промпт на программу | Нельзя кастомизировать по режимам |
| Промпты в коде (файлах) | Нельзя менять без деплоя |
| Все слои в одном поле БД | Невозможно переиспользовать между режимами |
| Client-side сборка промпта | Утечка промптов, нет контроля |

## Последствия

**Плюсы:**
- Гибкость: один mode-level промпт переопределяет всё для конкретного режима
- Персонализация: портрет + тест-результаты делают ответы AI релевантными
- Data-driven: промпты меняются в БД, без деплоя
- Аддитивность: exercise/portrait не конфликтуют с base prompt

**Минусы / trade-offs:**
- Длина промпта растёт (base + exercise + portrait + scores) — больше токенов
- Неочевидный порядок сборки — легко сломать если не знать иерархию
- Кэш 60с для program_modes — изменения в БД не мгновенные

## Правила для нового кода

**DO:**
- Новый тип чата → добавь `mode_template` + `program_modes` в seed SQL
- Режим-специфичный промпт → в `program_modes.system_prompt`
- Общий промпт книги → в `programs.system_prompt`
- Дополнительный контекст → добавляй аддитивно через `\n\n---\n` разделитель
- Используй `loadProgramContext()` из `lib/chat/prepare-context.ts` — не собирай промпт вручную

**DON'T:**
- Не хардкодь промпты в коде — они в БД
- Не ломай порядок обогащения (exercise → portrait → scores)
- Не перезаписывай `systemPrompt` после шага 1 — только аддитивно
- Не забывай `chatType` при вызове — без него mode-level prompt не загрузится

## Связанные файлы

- `lib/chat/prepare-context.ts` — вся логика сборки (358 строк)
  - `parseBody()` — парсинг запроса
  - `loadProgramContext()` — base prompt + fallback
  - `loadChatContext()` — чат + история + портрет
  - `appendPortraitContext()` — обогащение портретом
  - `appendIsspScores()` — обогащение тест-результатами
  - `buildGeminiHistory()` — конвертация в формат Gemini
- `app/api/chat/route.ts` — вызывает все функции выше
