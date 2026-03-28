# Architecture Decision Records (ADR)

Здесь хранятся записи об архитектурных решениях проекта. Каждый ADR отвечает на вопрос **"почему так сделано?"** — то, что не видно из кода.

## Индекс

| # | Решение | Статус | Дата |
|---|---------|--------|------|
| [001](001-dual-ai-sdk.md) | Dual AI SDK (Vercel AI SDK + нативный Google SDK) | accepted | 2026-03-28 |
| [002](002-unified-oauth.md) | Unified OAuth (единый flow для всех провайдеров) | accepted | 2026-03-28 |
| [003](003-test-system.md) | Generic тест-система (dual-mode, per-book config) | accepted | 2026-03-28 |
| [004](004-context-assembly.md) | Context Assembly (слоёные системные промпты) | accepted | 2026-03-28 |

## Как создать новый ADR

1. Скопируй `_TEMPLATE.md` → `XXX-short-name.md`
2. Заполни все секции (особенно "Правила для нового кода")
3. Добавь запись в таблицу выше
4. Коммит: `docs: add ADR-XXX short description`
