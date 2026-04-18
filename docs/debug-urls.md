# Debug URLs — все состояния UI через query-параметры

Единая страница со ссылками для визуального тестирования всех состояний stateful-экранов. Параметры переопределяют автоматически вычисленную phase и работают на production (`nice-guy-ai.vercel.app`), preview-деплоях и локально (`localhost:3001`).

## Хаб программы

`?hub_state=<value>` — переопределяет AI-приветствие и видимость секций «Твои темы» / «Продолжить».

### games-people-play

- [Первый визит](https://nice-guy-ai.vercel.app/program/games-people-play/hub?hub_state=first)
- [Вернулся, тест пройден](https://nice-guy-ai.vercel.app/program/games-people-play/hub?hub_state=returning-test) — подставляет топ-2 темы в `{theme1}/{theme2}`
- [Вернулся, тест не пройден](https://nice-guy-ai.vercel.app/program/games-people-play/hub?hub_state=returning-notest)

### nice-guy

- [Первый визит](https://nice-guy-ai.vercel.app/program/nice-guy/hub?hub_state=first)
- [Вернулся, тест пройден](https://nice-guy-ai.vercel.app/program/nice-guy/hub?hub_state=returning-test)
- [Вернулся, тест не пройден](https://nice-guy-ai.vercel.app/program/nice-guy/hub?hub_state=returning-notest)

### 5-love-languages

- [Первый визит](https://nice-guy-ai.vercel.app/program/5-love-languages/hub?hub_state=first)
- [Вернулся, тест не пройден](https://nice-guy-ai.vercel.app/program/5-love-languages/hub?hub_state=returning-notest) — `returning-test` недоступен, у программы нет теста

## Welcome-экран теста

`?test_state=<value>` — переопределяет phase `TestCardFlow`, мокает тестовые результаты локально в компоненте (в БД ничего не пишет).

### games-people-play / gpp-test

- [Тест не пройден (welcome)](https://nice-guy-ai.vercel.app/program/games-people-play/test/gpp-test?test_state=welcome)
- [Один результат (history-single)](https://nice-guy-ai.vercel.app/program/games-people-play/test/gpp-test?test_state=history-single)
- [Много результатов с дельтой (history-multi)](https://nice-guy-ai.vercel.app/program/games-people-play/test/gpp-test?test_state=history-multi)

### nice-guy / issp

- [Тест не пройден (welcome)](https://nice-guy-ai.vercel.app/program/nice-guy/test/issp?test_state=welcome)
- [Один результат (history-single)](https://nice-guy-ai.vercel.app/program/nice-guy/test/issp?test_state=history-single)
- [Много результатов с дельтой (history-multi)](https://nice-guy-ai.vercel.app/program/nice-guy/test/issp?test_state=history-multi)

## Страница результатов теста

> **TODO:** на `/program/[slug]/test/results/[id]` пока нет debug-параметра. Чтобы увидеть разные дизайны (низкий / средний / высокий балл, с интерпретацией и без) нужны реальные прохождения теста в БД. Если нужен `?result_state=low|mid|high` — открыть задачу.

Пока работает только через реальные `id`:
- `/program/<slug>/test/results/<uuid>` — конкретный результат

## Локально (dev)

Все ссылки выше работают на `http://localhost:3001` — подставь вместо `nice-guy-ai.vercel.app`. Перед тестированием защищённых страниц — залогиниться через `/api/auth/dev-login`.

## Preview-деплой

Для текущей ветки feature-разработки URL имеет вид `nice-guy-ai-git-<branch>-<team>.vercel.app` — смотри в Vercel dashboard или в GitHub checks.

## Куда смотреть в коде

| Экран | Файл | Строка с overrides |
|---|---|---|
| Хаб | [app/program/[slug]/(app)/hub/page.tsx](../app/program/[slug]/(app)/hub/page.tsx) | `query.hub_state` / `override` |
| Welcome теста | [components/TestCardFlow.tsx](../components/TestCardFlow.tsx) | `rawDebugState = searchParams.get("test_state")` |
| Hook init-скипа | [components/test-flow/useTestInit.ts](../components/test-flow/useTestInit.ts) | `debugSkipInit` |

## Правило для новых stateful-экранов

Любой новый экран с ≥2 состояниями — добавлять `?<name>_state=<value>` override и обновлять эту страницу. Зафиксировано в [[../.claude/skills/book-audit/references/CHECKLIST|book-audit CHECKLIST]] v1.5 секция I.
