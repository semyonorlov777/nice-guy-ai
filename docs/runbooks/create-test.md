# Runbook: Создание теста для программы

**Когда использовать:** При добавлении нового психологического теста к программе.
**Время выполнения:** ~1-2 часа (вопросы + конфигурация + тестирование)
**Требования:** Supabase SQL Editor, вопросы теста с привязкой к шкалам
**Связанный ADR:** [ADR-003](../adr/003-test-system.md)

## Предварительные проверки

- [ ] Программа уже создана (см. [add-new-book.md](add-new-book.md))
- [ ] Вопросы теста составлены с привязкой к шкалам
- [ ] Определены шкалы: key, name, пороги уровней
- [ ] Определён scoring: direction (lower/higher is better), answer range
- [ ] Написан interpretation_prompt для AI-анализа результатов

## Шаги

### 1. Подготовить конфигурацию теста

Референс: `scripts/seed-games-people-play-test.sql`

Вся конфигурация — одна строка в `test_configs`:

```sql
INSERT INTO test_configs (
  program_id,
  slug,               -- URL: /program/{prog-slug}/test/{test-slug}
  title,
  questions,          -- JSONB массив
  scales,             -- JSONB массив
  scoring,            -- JSONB объект
  ui_config,          -- JSONB объект (настройки UI)
  system_prompt,      -- System prompt для тестового чата
  interpretation_prompt -- Промпт для AI-интерпретации результатов
) VALUES (
  (SELECT id FROM programs WHERE slug = '{program-slug}'),
  '{test-slug}',
  '{Название теста}',
  -- questions, scales, scoring, ui_config, prompts (см. ниже)
);
```

### 2. Структура questions

```json
[
  {
    "q": 1,
    "scale": "assertiveness",
    "type": "direct",
    "text": "Мне легко говорить «нет», когда меня просят о чём-то, что мне не подходит."
  },
  {
    "q": 2,
    "scale": "assertiveness",
    "type": "reverse",
    "text": "Я часто соглашаюсь на вещи, которые мне не нравятся, чтобы не обидеть."
  }
]
```

- `q` — номер вопроса (1-based)
- `scale` — ключ шкалы (должен совпадать с `scales[].key`)
- `type` — `"direct"` (высокий ответ = высокий балл) или `"reverse"` (инверсия)
- `text` — текст вопроса

### 3. Структура scales

```json
[
  {
    "key": "assertiveness",
    "name": "Ассертивность",
    "order": 1,
    "exercises": [3, 7, 12],
    "radar_label": ["Ассерт-", "ивность"]
  }
]
```

- `key` — уникальный ключ (snake_case)
- `name` — отображаемое название
- `order` — порядок на radar-диаграмме
- `exercises` — номера связанных упражнений (опционально)
- `radar_label` — label для radar-диаграммы (массив строк для переноса)

### 4. Структура scoring

```json
{
  "answer_range": [1, 5],
  "score_direction": "higher_is_better",
  "level_thresholds": [25, 50, 75],
  "level_labels": ["Низкий", "Умеренный", "Выраженный", "Высокий"]
}
```

- `answer_range` — диапазон ответов Likert (обычно `[1, 5]`)
- `score_direction` — `"lower_is_better"` или `"higher_is_better"`
- `level_thresholds` — пороги в процентах (N порогов → N+1 уровней)
- `level_labels` — названия уровней (на 1 больше чем порогов)

### 5. Структура ui_config

```json
{
  "questions_per_block": 7,
  "auth_wall_question": 33,
  "welcome_title": "Тест: Название",
  "welcome_subtitle": "X вопросов · Y минут",
  "welcome_description": "Описание теста...",
  "welcome_badge": "Бесплатно",
  "welcome_cta": "Начать тест",
  "welcome_meta": "~Y минут",
  "welcome_stats": [
    { "num": "35", "label": "вопросов" },
    { "num": "7", "label": "шкал" }
  ],
  "block_insights": [
    "Блок 1: Самовосприятие",
    "Блок 2: Отношения"
  ],
  "quick_answer_labels": [
    "Совсем не про меня",
    "Скорее нет",
    "Не уверен",
    "Скорее да",
    "Точно про меня"
  ],
  "radar_labels": {
    "assertiveness": ["Ассерт-", "ивность"]
  },
  "analyzing_stages": [
    {
      "title": "Анализ ответов",
      "substeps": ["Обработка данных", "Подсчёт баллов"]
    }
  ]
}
```

- `auth_wall_question` — 0-based индекс вопроса для auth wall (null = без wall)
- `questions_per_block` — сколько вопросов между анимациями перехода
- `quick_answer_labels` — подписи для кнопок Likert (должно быть 5 для range [1,5])

### 6. Написать interpretation_prompt

Промпт для AI-генерации текстовой интерпретации результатов. Получает баллы по шкалам.

Ключевые правила (из `lib/test-mini-prompt.ts`):
1. **Нормализация** — все уровни нормальны, это не диагноз
2. **Поведение, не личность** — "замечаете паттерн", не "вы такой человек"
3. **Осознание = достижение** — сам факт прохождения теста ценен
4. **Причина, не диагноз** — объясняй откуда паттерн, не навешивай ярлык
5. **Ресурс в минусе** — низкий балл = потенциал роста
6. **Язык движения** — "можно начать", не "нужно исправить"
7. **Без патологизации** — никаких "проблема", "дефицит", "нарушение"

### 7. Выполнить SQL

```bash
# В Supabase SQL Editor:
# 1. Выполни seed-{book-slug}-test.sql
```

**Ожидаемый результат:** Новая запись в `test_configs`:
```sql
SELECT slug, title,
  jsonb_array_length(questions) as q_count,
  jsonb_array_length(scales) as scale_count
FROM test_configs
WHERE slug = '{test-slug}';
```

### 8. Включить тест в features программы

```sql
UPDATE programs
SET features = features || '{"test": true}'::jsonb
WHERE slug = '{program-slug}';
```

### 9. Проверить в приложении

```bash
npm run dev
# Тест: http://localhost:3000/program/{prog-slug}/test/{test-slug}
```

Пройди полный flow:
1. Welcome screen → "Начать тест"
2. Ответить на несколько вопросов
3. Auth wall (если настроен) → авторизоваться
4. Дойти до конца → "Анализируем..."
5. Результаты → radar-диаграмма, интерпретация

## Верификация

1. ✅ Welcome screen показывает данные из `ui_config`
2. ✅ Вопросы отображаются с правильными labels
3. ✅ Block transitions работают (каждые N вопросов)
4. ✅ Auth wall появляется на нужном вопросе
5. ✅ После финального ответа — экран анализа
6. ✅ Результаты появляются (polling, 5-30 сек)
7. ✅ Radar-диаграмма рендерится с правильными шкалами
8. ✅ AI-интерпретация адекватная (проверь тон)
9. ✅ Публичная ссылка на результаты работает

## Откат

```sql
-- Удалить тест
DELETE FROM test_configs WHERE slug = '{test-slug}';

-- Отключить тест в features
UPDATE programs
SET features = features || '{"test": false}'::jsonb
WHERE slug = '{program-slug}';
```

## Частые ошибки

| Симптом | Причина | Решение |
|---------|---------|---------|
| Тест не найден (404) | Slug не совпадает или `features.test = false` | Проверь slug в URL и features |
| Вопрос без текста | `questions[].text` пуст | Проверь JSON |
| Неправильные баллы | `type: "reverse"` на direct вопросе (или наоборот) | Перепроверь type каждого вопроса |
| Radar-диаграмма кривая | `scales[].order` дублируется или пропущен | Убедись что order уникален и последователен |
| AI-интерпретация пустая | `interpretation_prompt` не заполнен | Добавь промпт в test_configs |
| Auth wall не появляется | `ui_config.auth_wall_question` = null | Установи 0-based индекс |
| Labels кнопок не те | `quick_answer_labels` не совпадает с `answer_range` | 5 labels для range [1,5] |
