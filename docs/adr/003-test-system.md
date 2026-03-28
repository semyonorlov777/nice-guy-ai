# ADR-003: Generic тест-система — dual-mode, per-book конфигурация

**Статус:** accepted
**Дата:** 2026-03-28

> **Контекст для Claude Code:** Читай при создании нового теста, переносе теста на другую книгу, или изменении flow тестирования.

## Контекст

Изначально тест-система была создана только для ISSP (Indications of the Nice Guy Syndrome Profile) — 35 вопросов привязанных к книге "No More Mr. Nice Guy". При расширении на другие книги нужна была generic-система:

1. Каждая книга может иметь свой тест (или не иметь)
2. Тесты должны работать для анонимных пользователей (конверсия)
3. Конфигурация (вопросы, шкалы, скоринг) должна храниться в БД, не в коде
4. UI должен быть единым, data-driven

## Решение

### Архитектура: slug-based routing + JSON config в БД

```
URL: /program/{slug}/test/{testSlug}
     /program/nice-guy/test/issp
     /program/games-people-play/test/gpp-test
```

### Конфигурация теста — таблица `test_configs`

Вся конфигурация одного теста — одна строка в `test_configs`:

```typescript
// lib/test-config.ts — типы (не данные!)
interface TestConfig {
  id: string;
  program_id: string;
  slug: string;                    // "issp", "gpp-test"
  title: string;
  questions: TestQuestion[];       // [{q: 1, scale: "assertiveness", type: "direct", text: "..."}]
  scales: TestScale[];             // [{key: "assertiveness", name: "Ассертивность", order: 1}]
  scoring: TestScoringConfig;      // {answer_range: [1,5], level_thresholds: [25,50,75]}
  ui_config: TestUIConfig;         // Welcome screen, labels, анимации
  interpretation_prompt: string;   // Промпт для AI-интерпретации
  system_prompt: string;           // System prompt теста
}
```

### Dual-mode: анонимный + авторизованный

| Аспект | Анонимный | Авторизованный |
|--------|-----------|----------------|
| Хранение | `test_sessions` (ephemeral) | `chats` с `chat_type: "test"` |
| ID | `session_id` (UUID, клиент) | `chat_id` (UUID, сервер) |
| Лимит | Rate limit по IP | Нет лимита |
| Миграция | → auth wall на Q34 → миграция | Сохранено в профиле |
| Результат | Доступен по public URL | + привязан к профилю |

### Flow: от вопроса до результата

```
1. Клиент → POST /api/test
   body: { test_slug, message | answer_type + answer }

2. Сервер определяет mode:
   - user есть? → handleAuthenticated() → chats + messages
   - user нет? → handleAnonymous() → test_sessions

3. Типизированный ответ (Likert 1-5):
   - handleTypedAnswer() → парсинг, сохранение, следующий вопрос

4. Финальный ответ (последний вопрос):
   - handleFinalAnswer() → подсчёт баллов → запуск AI-анализа (background)

5. Клиент polling: GET /api/test/result?session_id=X
   - Ждёт status: "ready" с результатами
```

### Auth wall

На вопросе N (настраивается в `ui_config.auth_wall_question`) анонимный пользователь видит AuthSheet. После авторизации:

1. `POST /api/test/migrate` — переносит `test_sessions` → `chats`
2. Тест продолжается как авторизованный

### Scoring

```typescript
// lib/test-scoring.ts
// Direct question: ответ = балл (1→1, 5→5)
// Reverse question: ответ инвертируется (1→5, 5→1)
// Формула: (сумма баллов шкалы / макс) * 100 → процент → уровень по thresholds
```

## Альтернативы

| Вариант | Почему отвергнут |
|---------|------------------|
| Хардкод вопросов в коде | Нельзя добавлять тесты без деплоя |
| Только авторизованные тесты | Потеря анонимной конверсии (70%+ трафика) |
| Отдельный route.ts на каждый тест | Дублирование, не масштабируется |
| SSE вместо polling для результатов | Сложнее, polling надёжнее для mobile |

## Последствия

**Плюсы:**
- Новый тест = одна строка в `test_configs` (seed SQL), zero code changes
- UI полностью data-driven (welcome screen, labels, анимации — всё из `ui_config`)
- Анонимные тесты → высокая конверсия в авторизацию
- Миграция анонимных сессий бесшовная

**Минусы / trade-offs:**
- `test_configs` содержит большие JSON (вопросы, промпты) — сложно диффить в SQL
- Polling результатов добавляет задержку (3-5 сек после финального ответа)
- Auth wall привязан к индексу вопроса — если порядок меняется, wall смещается

## Правила для нового кода

**DO:**
- Новый тест → seed SQL в `scripts/seed-{book}-test.sql` с INSERT INTO `test_configs`
- Используй `getTestConfig(slug)` или `getTestConfigByProgram(programSlug)` из `lib/queries/test-config.ts`
- UI-настройки теста → в `ui_config` JSON, не в коде компонентов
- Scoring-конфиг → в `scoring` JSON, не хардкодь пороги

**DON'T:**
- Не создавай отдельный API route для нового теста — всё через `/api/test/`
- Не хардкодь slug теста (типа `"issp"`) — передавай через URL params
- Не модифицируй `lib/test-scoring.ts` для нового теста — меняй только конфиг в БД
- Не забывай `interpretation_prompt` — без него AI-анализ не работает

## Связанные файлы

- `app/api/test/route.ts` — главный handler (GET restore + POST answer)
- `app/api/test/_handlers/` — модули: anonymous.ts, authenticated.ts, typed-answer.ts, final-answer.ts
- `lib/test-config.ts` — типы TestConfig, TestQuestion, TestScale, TestScoringConfig
- `lib/test-scoring.ts` — подсчёт баллов (direct/reverse, проценты, уровни)
- `lib/test-interpretation.ts` — AI-генерация интерпретации
- `lib/queries/test-config.ts` — `getTestConfig()`, `getTestConfigByProgram()` (кэш 60с)
- `components/TestCardFlow.tsx` — UI-оркестратор тест-flow
- `components/test-flow/` — хуки: useTestInit, useTestSession, useTestAnswers, useResultPolling
- Runbook: [docs/runbooks/create-test.md](../runbooks/create-test.md)
