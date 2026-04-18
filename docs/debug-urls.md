# Debug URLs — все состояния UI через query-параметры

Единая страница с паттернами ссылок для визуального тестирования stateful-экранов. Параметры переопределяют автоматически вычисленную phase и работают на production (`nice-guy-ai.vercel.app`), preview-деплоях и локально (`localhost:3001`).

## Программы и тесты

| Программа | `{slug}` | Тест | `{testSlug}` |
|---|---|---|---|
| Нет больше мистера Хорошего (Glover) | `nice-guy` | ИССП | `issp` |
| Игры, в которые играют люди (Berne) | `games-people-play` | Какие игры ты играешь? | `gpp-test` |
| 5 языков любви (Chapman) | `5-love-languages` | — | — |

Ниже подставляй `{slug}` и `{testSlug}` в шаблоны URL.

## Хаб программы

`?hub_state=<value>` — переопределяет AI-приветствие и видимость секций «Твои темы» / «Продолжить». Работает для любой программы.

| Состояние | URL-шаблон |
|---|---|
| Первый визит | `/program/{slug}/hub?hub_state=first` |
| Вернулся, тест пройден | `/program/{slug}/hub?hub_state=returning-test` |
| Вернулся, тест не пройден | `/program/{slug}/hub?hub_state=returning-notest` |

> `returning-test` даёт полноценный дизайн только если у программы есть `program_themes` с `test_scale_key`. Иначе плейсхолдеры `{theme1}/{theme2}` стрипаются и выводится `returning-notest`.

## Welcome-экран теста

`?test_state=<value>` — переопределяет phase `TestCardFlow`, мокает тестовые результаты локально (в БД ничего не пишет). Работает только на страницах с тестом.

| Состояние | URL-шаблон |
|---|---|
| Тест не пройден | `/program/{slug}/test/{testSlug}?test_state=welcome` |
| Один результат | `/program/{slug}/test/{testSlug}?test_state=history-single` |
| Много результатов с дельтой | `/program/{slug}/test/{testSlug}?test_state=history-multi` |

## Страница результатов теста

> **TODO:** на `/program/{slug}/test/results/{id}` пока нет debug-параметра. Чтобы увидеть разные дизайны (низкий / средний / высокий балл, с интерпретацией и без) нужны реальные прохождения теста в БД. Если нужен `?result_state=low|mid|high` — отдельная задача.

## Окружения

- **Production:** `https://nice-guy-ai.vercel.app/{path}`
- **Preview (текущая ветка):** `nice-guy-ai-git-<branch>-<team>.vercel.app` — смотри в Vercel dashboard
- **Локально:** `http://localhost:3001/{path}` — перед тестированием залогинься через `/api/auth/dev-login`

## Куда смотреть в коде

| Экран | Файл | Место override |
|---|---|---|
| Хаб | [app/program/[slug]/(app)/hub/page.tsx](../app/program/[slug]/(app)/hub/page.tsx) | `query.hub_state` |
| Welcome теста | [components/TestCardFlow.tsx](../components/TestCardFlow.tsx) | `searchParams.get("test_state")` |
| Skip init-хука | [components/test-flow/useTestInit.ts](../components/test-flow/useTestInit.ts) | `debugSkipInit` |

## Правило для новых экранов

Любой новый stateful-экран (≥2 состояний) — добавлять `?<name>_state=<value>` override и дописывать сюда. Зафиксировано в [[../.claude/skills/book-audit/references/CHECKLIST|book-audit CHECKLIST]] v1.5 секция I.
