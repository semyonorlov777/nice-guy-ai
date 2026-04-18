# Промпты

Каталог системных промптов, используемых в приложении. Физически промпты живут в БД (Supabase), здесь — их зеркало с историей изменений через git и связями между собой.

## Где что живёт в БД

| Промпт | Таблица/Поле |
|---|---|
| Системный промпт программы | `programs.system_prompt` |
| Чат с автором | `programs.author_chat_system_prompt` |
| Приветствие свободного чата | `programs.free_chat_welcome` |
| Приветствие чата с автором | `programs.author_chat_welcome` |
| Промпт режима | `mode_templates.system_prompt` |
| Приветствие упражнения | `exercises.welcome_message` |
| Анализ портрета | см. `lib/prompts/portrait-analyst.ts` |
| Мини-анализ теста | см. `lib/test-mini-prompt.ts` |

## Структура заметки о промпте

Рекомендуемая структура:

```markdown
---
book: glover
type: author-chat
version: v2
source_db: programs.author_chat_system_prompt (slug=nice-guy)
updated: 2026-04-17
---

# Glover — Author Chat v2

## Источник в книге
Ссылка на главу/концепт: [[nice-guy-glover#раздел]]

## Текст промпта
```
<сам текст промпта>
```

## История изменений
- v2 (2026-04-17): добавили инструкцию о границах чата
- v1 (2026-03-01): первая версия

## Связанные промпты
- [[prompt-glover-free-chat-v1]] — общий промпт программы
```

## Теги

Используй единообразно:
- `#book/glover`, `#book/berne`, `#book/chapman`
- `#type/system`, `#type/author-chat`, `#type/mode`, `#type/welcome`, `#type/analysis`
- `#version/v1`, `#version/v2`…

## Связанное

- [[../books/README|Книги]] — источник промптов
- [[../adr/README|ADR]] — архитектурные решения по работе с промптами
