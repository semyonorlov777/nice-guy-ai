# project-plan

Личный трекер задач владельца репозитория. Изолированный мини-проект (см. `CLAUDE.md`).

## Маршрут на продакшене

https://nice-guy-ai.vercel.app/project-plan

Страница доступна без авторизации, но имеет `<meta robots="noindex, nofollow">` — поисковики не индексируют. Это «privacy by URL»: контент видит только тот, кому дали ссылку.

## Как редактируется

Source of truth — `lib/tasks.ts` (массив `TASKS`). Изменения вносятся правкой этого файла, потом — коммит, push, авто-merge в `main`, Vercel деплоит сам. Чекбоксы в UI эфемерные (клики не сохраняются между сессиями).

Подробный workflow — в `CLAUDE.md`.

## Локальный запуск

```bash
npm run dev
# открыть http://localhost:3000/project-plan
```

## Структура

См. `CLAUDE.md`.
