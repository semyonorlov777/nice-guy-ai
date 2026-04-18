# Аудит: No More Mr. Nice Guy (Glover)

**Дата:** 2026-04-18
**Slug:** `nice-guy`
**Версия чеклиста:** 1.3
**Предыдущий аудит:** первый

## Сводка

| Статус | Количество |
|--------|-----------|
| ✅ Ок | 31 |
| ⚠️ Частично | 8 |
| ❌ Отсутствует | 2 |
| ⬜ Неприменимо | 0 |
| **Итого применимых** | **41** |
| **Оценка качества** | **75%** (✅ / применимых) |

## Детали

### A. Режимы и промпты

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| A1 | ≥7 режимов (без свободного/автора) | ✅ | 8: ng_my_syndrome, ng_relationships, ng_parents, exercises, ng_boundaries, ng_quiz, ng_theory, test_issp |
| A2 | Каждый режим имеет system_prompt | ✅ | Длины: 1218–4936 символов; self_work=0, но enabled=false |
| A3 | Секции РОЛЬ/КНИГА/ПРАВИЛА/ЛОГИКА/АНТИПАТТЕРНЫ | ⚠️ | author_chat использует другую структуру (СТИЛЬ/ЗНАНИЕ/ОГРАНИЧЕНИЯ) — формально нарушает шаблон, по сути адекватно |
| A4 | 60-80 слов, один вопрос, scaffolding fading 4→2→0 | ⚠️ | author_chat: «3-5 предложений», без scaffolding fading. Остальные ✅ |
| A5 | АНТИПАТТЕРНЫ перечислены явно | ✅ | Везде |
| A6 | Конкретные концепции из книги | ✅ | Терминология Гловера (toxic shame, covert contracts, victim triangle, enmesher/avoider, моногамия к матери) |
| A7 | Suggested replies с типами | ✅ | В промптах есть секция SUGGESTED REPLIES с примерами от первого лица |

### B. Welcome-сообщения

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| B1 | Welcome у каждого режима | ⚠️ | 7 режимов имеют только `welcome_message` (классический путь), `welcome_ai_message` = null. Hub-style недоступен — может ломать NewChatScreen, если он используется для них |
| B2 | Шаблон ЭМОДЗИ→ХУК→КАК→ЧТО ПОЛУЧИТЕ→REPLIES | ✅ | Все welcome_message следуют паттерну |
| B3 | ХУК продаёт результат | ✅ | «Большинство «славных парней» не знают, что живут по сценарию...» — продажа |
| B4 | Replies от первого лица | ❌ | ng_quiz и ng_theory имеют **пустые** welcome_replies — нет ни одной кнопки |
| B5 | Безопасный exit-reply | ⚠️ | exercises/free_chat/author_chat — все 3-4 reply с типом `normal`, нет ни одного `exit`. ng_quiz/ng_theory — пустые |
| B6 | Welcome ≤300 слов | ✅ | Все короткие (60–80 слов) |

### C. Техническая реализация

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| C1 | Уникальные key в mode_template | ✅ | 12 разных key |
| C2 | page.tsx для каждого route_suffix | ⚠️ | `/self-work` — page.tsx нет, но enabled=false, не ломается |
| C3 | Иконка в iconMap | ✅ | Все 10 icon (search, clock, heart, users, check, pen, shield, target, book, chat) есть в iconMap |
| C4 | sort_order корректен (нет дублей) | ❌ | **Дубли:** sort_order=2 (self_work И ng_relationships), sort_order=3 (test_issp И ng_parents). Если порядок sort_order → name, поведение зависит от вторичной сортировки |
| C5 | ≥1 free режим | ✅ | test_issp + free_chat |
| C6 | Нет «вечных coming soon» | ⚠️ | self_work disabled с marтa 2026, нет page.tsx — кандидат на удаление |
| C7 | chat_type === mode_template.key | ⚠️ | Легаси-исключения: exercises→exercise, free_chat→free, author_chat→author. Остальные ✅ |

### D. Кросс-режимные связки

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| D1 | `{{cross_mode_data}}` в промптах | ✅ | Все основные режимы имеют секцию КРОСС-РЕЖИМНАЯ СВЯЗКА с {{cross_mode_data}} |
| D2 | Связки описаны в MODE_DETAILS/ретроспективе | ✅ | `no_more_mr_nice_guy_MODE_DETAILS.md` содержит подробный маппинг |
| D3 | Аналитики → практики | ✅ | ng_my_syndrome → ng_boundaries (resistance_points), ng_relationships → ng_boundaries (identified_contract) |
| D4 | Нет «сирот» | ✅ | Каждый режим либо ПЕРЕДАЁТ, либо ПОЛУЧАЕТ хотя бы одну переменную |
| D5 | Переменные реально используются | ✅ | Проверено: identified_contract, main_pattern, mother_bond_type, identified_shame_origin, resistance_points, growth_areas — встречаются в промптах-получателях |
| D6 | Сводная таблица совпадает с промптами | ✅ | MODE_DETAILS совпадает с фактическими промптами |

### E. Интеграция с тестом

#### E.I — Данные и контекст

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| E1 | `appendTestScores()` инжектит scores_by_scale | ✅ | `lib/chat/prepare-context.ts:318` — функция существует, читает test_results.scores_by_scale |
| E2 | Маппинг шкала→режим задокументирован | ✅ | `no_more_mr_nice_guy_MODE_DETAILS.md` — таблица шкал. exercises промпт — маппинг шкала→номера упражнений |
| E3 | Промпты используют test scores | ✅ | Все основные режимы содержат «Если есть issp_scores → используй» |
| E4 | AI не зачитывает баллы | ⚠️ | Правило явно прописано **только в ng_my_syndrome**. В остальных промптах риск, что AI зачитает JSON из appendTestScores |

#### E.II — Конфигурация

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| E5 | test_configs полный | ✅ | q=35, scales=7, scoring/ui_config/interpretation_prompt заполнены |
| E6 | programs.test_system_prompt заполнен | ✅ | 19356 символов |
| E7 | features.test = true | ✅ | "true" |
| E8 | landing_data.test заполнен | ✅ | Заполнено |
| E9 | mode_template: is_chat_based=false, /test/... | ✅ | test_issp: is_chat_based=false, /test/issp |
| E10 | program_mode enabled=true | ✅ | enabled=true, access_type=free |

#### E.III — Темы и сортировка

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| E11 | program_themes.test_scale_key заполнен | ✅ | 7/7 тем имеют test_scale_key (1:1 с scales) |
| E12 | Сортировка тем по баллам работает | ✅ | `lib/queries/themes.ts:48` — `getThemesOrdered()`, используется в `app/program/[slug]/(app)/hub/page.tsx:95` |

### F. Темы

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| F1 | program_themes.recommended_route | ⚠️ | **Колонки нет в БД** — чеклист устарел. Темы реально ведут через `welcome_*` поля и роутятся через `/chat/new?topic=` |
| F2 | Тема ведёт в конкретный режим | ⚠️ | Все темы ведут в `/chat/new?topic={key}` (свободный чат). MODE_DETAILS описывает «должно вести в конкретный режим» — не реализовано |
| F3 | Маппинг темы→шкалы логичен | ✅ | «Перестать угождать»→approval, «Не обижаться молча»→contracts и т.д. — каждая тема 1:1 с шкалой |

### G. Ретроспектива и документация

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| G1 | examples/{slug}.md актуален | ✅ | Существует, включает v1→v2, что сработало, специфика, уроки |
| G2 | Содержит обязательные секции | ✅ | Все секции |
| G3 | SYSTEM_PROMPTS.md существует | ✅ | `no_more_mr_nice_guy_SYSTEM_PROMPTS.md` |
| G4 | MODE_DETAILS.md существует | ✅ | `no_more_mr_nice_guy_MODE_DETAILS.md` |

### H. Качество промптов

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| H1 | Персона соответствует типу | ✅ | «Бережный наставник» во всех — соответствует терапии |
| H2 | Тон единообразен | ✅ | «ты», тёплый/прямой, без менторства, без похвалы личности — везде |
| H3 | Нет хардкода на пользователя | ✅ | Промпты говорят про «жена/партнёрша», «отец/мать» нейтрально |
| H4 | Ролевые: setup/💡/дебрифинг | ✅ | ng_boundaries: setup → симуляция → 💡 → дебрифинг |
| H5 | Экзамены: адаптивная сложность, metacog calibration | ✅ | ng_quiz: «Адаптивная сложность», «Metacognitive calibration: 1-10» |
| H6 | Лекции: сократовский метод | ✅ | ng_theory: «СОКРАТОВСКИЙ», «НИКОГДА не начинай с объяснения» |

---

## Рекомендации

### Приоритет 1 (критично)

#### B4 — Пустые welcome_replies в ng_quiz и ng_theory

**Статус:** ❌
**Проблема:** Welcome-экраны режимов «Славный парень или нет?» и «Теория книги» не имеют ни одной suggested reply. Пользователь видит welcome_message, но кнопок-подсказок нет — приходится придумывать первое сообщение с нуля. Это снижает engagement, особенно для новичков.
**Решение:** Добавить 3-4 reply от первого лица для каждого режима:
- ng_quiz: «Готов к кейсу», «Начни с простого», «Расскажи про метод», «Мне сложно сформулировать» (exit)
- ng_theory: «Расскажи про синдром», «Что такое скрытый контракт», «Объясни своими словами», «Мне сложно сформулировать» (exit)

SQL:
```sql
UPDATE program_modes SET welcome_replies = '[...]'::jsonb
WHERE program_id = (SELECT id FROM programs WHERE slug='nice-guy')
  AND mode_template_id = (SELECT id FROM mode_templates WHERE key='ng_quiz');
```
**Трудозатраты:** 15 мин
**Приоритет:** 1

#### C4 — Дубли в sort_order

**Статус:** ❌
**Проблема:** sort_order=2 у двух режимов (self_work + ng_relationships), sort_order=3 у двух (test_issp + ng_parents). При сортировке `ORDER BY sort_order` поведение зависит от вторичной сортировки PostgreSQL — порядок карточек на хабе непредсказуем.
**Решение:** Перенумеровать. Если self_work удаляется (см. C6) — освободит sort_order=2. Иначе:
```sql
UPDATE program_modes SET sort_order = 4 WHERE mode_template_id = (SELECT id FROM mode_templates WHERE key='ng_parents');
UPDATE program_modes SET sort_order = 5 WHERE mode_template_id = (SELECT id FROM mode_templates WHERE key='exercises');
-- и так далее, проверить весь порядок
```
**Трудозатраты:** 15 мин (включая ручную проверку порядка после фикса)
**Приоритет:** 1

### Приоритет 2 (улучшение)

#### B1 — Hub-режимы без welcome_ai_message

**Статус:** ⚠️
**Проблема:** 7 из 9 режимов nice-guy имеют только классический `welcome_message`, но `welcome_ai_message` = null. Согласно чеклисту v1.1 и `niceguy-design`, для Hub/NewChatScreen нужен структурированный путь. Если NewChatScreen используется для этих режимов — welcome-экран будет пустым.
**Решение:** Проверить, какой компонент рендерит welcome для ng_my_syndrome/ng_relationships/etc. Если ChatWindow — оставить как есть. Если NewChatScreen — заполнить welcome_ai_message + welcome_title + welcome_subtitle + welcome_mode_label по образцу exercises/free_chat/author_chat.
**Трудозатраты:** 30 мин на проверку + 1 час на заполнение если нужно
**Приоритет:** 2

#### B5 — Нет exit-reply в exercises/free_chat/author_chat

**Статус:** ⚠️
**Проблема:** В этих режимах все reply имеют тип `normal` — нет «безопасного выхода» для пользователей, не знающих что выбрать.
**Решение:** Добавить четвёртый reply типа `exit` с текстом «Мне сложно сформулировать» / «Не знаю с чего начать».
**Трудозатраты:** 5 мин
**Приоритет:** 2

#### E4 — Правило «не зачитывай баллы» только в одном промпте

**Статус:** ⚠️
**Проблема:** appendTestScores инжектит JSON `scores_by_scale` в system prompt всех чатов. Только ng_my_syndrome содержит «НЕ зачитывай баллы пользователю». Остальные режимы могут случайно процитировать «у тебя 4.2 по approval». Это ломает терапевтическую дистанцию.
**Решение:** Добавить инструкцию в `appendTestScores()` (на уровне инжекции, не в каждый промпт):
```typescript
return systemPrompt + `\n\n---\nРЕЗУЛЬТАТЫ ТЕСТА (не зачитывай числа вслух — используй для навигации):\n${JSON.stringify(...)}`;
```
**Трудозатраты:** 5 мин
**Приоритет:** 2

#### C6 — Удалить self_work или восстановить

**Статус:** ⚠️
**Проблема:** self_work режим disabled, нет page.tsx, занимает sort_order=2 (создавая дубль с ng_relationships). По ретроспективе — заменён 3 анализами + экзаменом.
**Решение:** Удалить из program_modes для nice-guy. Освободит sort_order=2:
```sql
DELETE FROM program_modes
WHERE program_id = (SELECT id FROM programs WHERE slug='nice-guy')
  AND mode_template_id = (SELECT id FROM mode_templates WHERE key='self_work');
```
**Трудозатраты:** 5 мин
**Приоритет:** 2

### Приоритет 3 (косметика)

#### F1/F2 — Чеклист устарел: program_themes.recommended_route

**Статус:** ⚠️
**Проблема:** В БД нет колонки `recommended_route` — чеклист F1 проверяет несуществующее поле. Темы реально ведут через `/chat/new?topic={key}` (всегда в свободный чат).
**Решение:** Обновить CHECKLIST.md v1.4 — заменить F1/F2 на актуальную модель: проверка что `welcome_*` поля темы заполнены (или добавить колонку recommended_route, если такая навигация планируется).
**Трудозатраты:** 15 мин
**Приоритет:** 3 (для скилла)

#### A3/A4 — author_chat не следует общему шаблону

**Статус:** ⚠️
**Проблема:** Промпт author_chat использует структуру СТИЛЬ/ЗНАНИЕ/ОГРАНИЧЕНИЯ вместо РОЛЬ/КНИГА/ПРАВИЛА ОТВЕТА/ЛОГИКА ДИАЛОГА/АНТИПАТТЕРНЫ. Длина 3-5 предложений вместо 60-80 слов. Это специфика «AI-в-роли-автора», но формально нарушает шаблон.
**Решение:** Либо реструктурировать author_chat под общий шаблон (с пояснением что «АНТИПАТТЕРНЫ» одинаковые), либо обновить чеклист — добавить специфику для author-режимов как исключение.
**Трудозатраты:** 30 мин
**Приоритет:** 3

#### C7 — chat_type не совпадает с key

**Статус:** ⚠️
**Проблема:** exercises→exercise, free_chat→free, author_chat→author — легаси из v1. В v2 эти 3 режима — единственные исключения.
**Решение:** Не трогать — сейчас работает, миграция переименования рискованная (потребует переписать API и storage). Зафиксировать как «known legacy» в чеклисте.
**Трудозатраты:** -
**Приоритет:** 3

---

## Следующие шаги

1. ✅ Аудит зафиксирован
2. ⏭ Ждать аудит games-people-play (для сравнения и нахождения общих паттернов)
3. ⏭ Sync-точка с пользователем — обсудить приоритеты фиксов перед UI-прогоном
4. ⏭ UI-прогон по плану `vast-jingling-balloon.md` Этап 2
