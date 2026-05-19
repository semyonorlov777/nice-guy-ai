# Аудит: Transdiagnostic Road Map to Case Formulation

**Дата:** 2026-05-19
**Slug:** `transdiagnostic-cbt`
**Версия чеклиста:** 1.6
**Предыдущий аудит:** первый
**Источники проверки:** production БД через MCP Supabase, файлы [scripts/seed-transdiagnostic-cbt.sql](../../../../scripts/seed-transdiagnostic-cbt.sql), [transdiagnostic_cbt_SYSTEM_PROMPTS.md](../../../../transdiagnostic_cbt_SYSTEM_PROMPTS.md), [transdiagnostic_cbt_MODE_DETAILS.md](../../../../transdiagnostic_cbt_MODE_DETAILS.md), [components/icons/theme-icon-map.tsx](../../../../components/icons/theme-icon-map.tsx), [components/hub/InstrumentList.tsx](../../../../components/hub/InstrumentList.tsx), [lib/chat/prepare-context.ts](../../../../lib/chat/prepare-context.ts), live лендинг https://nice-guy-ai.vercel.app/program/transdiagnostic-cbt.

## Контекст программы

Профессиональный учебный тренажёр по книге Frank & Davidson (2014) для practicing psychologists и advanced CBT students. Уникальная для платформы персона AI — «коллега-супервизор» (academic peer-level, на «ты», цитирует первоисточники). Safety-каркас расширен до 5 триггеров (включая confidentiality для identifiable case details и out-of-scope для children/psychosis/severe BPD/eating disorders с medical risk). Author chat от Jacqueline B. Persons (Forward к книге). Тест навыковый: higher_is_better, 25 вопросов, 5 шкал (Сбор данных, Идентификация механизмов, Сборка гипотезы, Выбор интервенций, Итеративный пересмотр), уровни Новичок → Развивающийся → Уверенный → Мастер (по Bennett-Levy DPR).

## Сводка

| Статус | Количество |
|--------|-----------|
| ✅ Ок | 56 |
| ⚠️ Частично / визуально не проверено | 6 |
| ❌ Отсутствует | 1 |
| ⬜ Неприменимо | 1 |
| **Итого применимых** | **63** |
| **Оценка качества** | **88.9%** (56/63) |

## Детали

### A. Режимы и промпты

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| A1 | Кол-во режимов ≥ 7 | ✅ | 7 tool-режимов: Словарь TDMs, Разбор кейса, Сборка гипотезы, Симуляция клиента, Treatment Plan, Экзамен, Кабинет супервизии. Плюс free_chat, author_chat, test mode_template — итого 10 строк в `program_modes`. |
| A2 | Каждый режим имеет `system_prompt` | ✅ | Все 7 tool-режимов: prompt_len 3781–5907 символов. `free_chat` и `author_chat` корректно наследуют `programs.system_prompt` / `programs.author_chat_system_prompt`. |
| A3 | Промпт содержит секции РОЛЬ/КНИГА/ПРАВИЛА/ЛОГИКА/АНТИПАТТЕРНЫ | ✅ | Все 7 промптов содержат секции. Проверено SQL-валидацией `has_antipatterns=true` для всех. |
| A4 | ПРАВИЛА: 60-80 слов, один вопрос, scaffolding fading 4→2→0 | ⚠️ | 6 из 7 имеют scaffolding и word_limit явно. `tdcbt_exam` — осознанное отступление: формат винетки 200-400 слов + feedback 100-150, и адаптивная сложность Bennett-Levy DPR вместо scaffolding fading. Это правильно по дизайну, но чеклист буквально не проходит. |
| A5 | АНТИПАТТЕРНЫ перечислены явно | ✅ | Все 7. |
| A6 | Конкретные концепции из книги | ✅ | TDMs, PDL, CCC-RS, vulnerability/response mechanisms, Tom/Linda/Jonah (кейсы), 9 категорий механизмов из Haarhoff 2011, terminology gap к Kuyken/Persons. |
| A7 | Suggested replies с типами (голос/сопротивление/навигация) | ✅ | Каждый промпт содержит секцию SUGGESTED REPLIES с разбивкой по фазам. |
| A8 | Блок «Quick replies — ФОРМАТ» в `program_modes.system_prompt` | ✅ | Все 7 содержат блок с буквальным примером, контрпримером склеивания через пробел, контрпримером `<вариант>`. |
| A9 | Тот же блок в `programs.system_prompt` и `author_chat_system_prompt` | ✅ | Оба содержат полный QR-блок. Также `anonymous_system_prompt`. |
| A10 | `free_chat_welcome` и `author_chat_welcome` заканчиваются 3-4 «ёлочками» | ✅ | `free_chat_welcome` — 4 ёлочки на отдельных строках. `author_chat_welcome` — 4 ёлочки. Парсер их подхватит как стартовые reply. |

### B. Welcome-сообщения

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| B1 | Каждый режим имеет `welcome_ai_message` | ✅ | Все 9 чат-режимов: welcome_ai_len 602–861 (тест-mode_template исключение — он не чат). |
| B2 | Шаблон: ЭМОДЗИ+название → ХУК → КАК → ЧТО → REPLIES | ✅ | Структура: книжная отсылка → «Что мы будем делать» → буллет-список «Что ты получишь» через `•`. Без эмодзи в title (см. B8). |
| B3 | ХУК продаёт результат, не процесс | ✅ | Например: «Frank & Davidson выделяют две большие категории Transdiagnostic Mechanisms... Это будет одной из тем нашего разбора». Адекватный для ЦА хук — научный, не «продающий». |
| B4 | Suggested replies — от первого лица | ✅ | «Не уверен(а) в различении…», «Принёс данные из Разбора…», «Хочу про safety behaviours» — все от первого лица. |
| B5 | Есть exit-reply | ✅ | Все 9 режимов имеют последний reply с `type:"exit"`. |
| B6 | Welcome ≤ ~300 слов | ✅ | welcome_ai_len 602-861 символов = 80-130 слов — далеко не стена. |
| B7 | Нет markdown в `welcome_ai_message` | ✅ | `has_md_bold=false`, `has_md_heading=false` для всех 9. Буллеты через символ `•` (валидно). |
| B8 | Не начинается с эмодзи + **Title** | ✅ | Все welcome начинаются с содержательной фразы, не с дубля title. |
| B9 | `welcome_replies` — массив объектов `{text, type}`, последний exit | ✅ | Все 9: `replies_type="array"`, последний `type="exit"`. |
| B10 | Нет вложенных «ёлочек» и trailing-пунктуации | ✅ | `has_nested_yolochki=false`, `has_outer_punct=false` для всех 9. |

### C. Техническая реализация

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| C1 | Уникальные `mode_template.key` | ✅ | `tdcbt_tdm_dictionary`, `tdcbt_case_review`, `tdcbt_hypothesis_builder`, `tdcbt_client_simulation`, `tdcbt_treatment_plan`, `tdcbt_exam`, `tdcbt_supervision`, `test_tdcbt-mastery` — уникальные. |
| C2 | Для каждого `route_suffix` есть `page.tsx` | ✅ | Все 7 tool-режимов имеют route_suffix=`/chat` → обрабатывается через `app/program/[slug]/(app)/chat/new/page.tsx` + `?tool=` параметр (см. InstrumentList toolKey derivation). `/author-chat`, `/test/tdcbt-mastery` — есть. |
| C3 | Иконка существует в `INSTRUMENT_ICON_MAP` | ⚠️ | Все 9 icons (book-open, search, pen, drama, target, check, users, chat, book) присутствуют. **НО:** `tdcbt_exam.icon="check"` и `test_tdcbt-mastery.icon="check"` — дубль. На хабе появятся две карточки (Экзамен и Тест) с одной иконкой ✓. Не баг чеклиста, но потенциальная UX-проблема. |
| C4 | Корректный `sort_order` | ✅ | 5, 10, 20, 30, 40, 50, 60, 70, 80, 90 — без дублей, логично (тест → инструменты по road map → свободный → автор). |
| C5 | Хотя бы 1 free режим | ✅ | `tdcbt_tdm_dictionary` (paid → опечатка в данных? Нет, проверено — free), `free_chat=free`, `test_tdcbt-mastery=free`. Три точки входа без оплаты. |
| C6 | Нет `enabled:false` режимов | ✅ | Все `enabled=true`. |
| C7 | `chat_type` совпадает с `mode_template.key` | ✅ | Для 7 tool-режимов `chat_type = key`. `free_chat→free`, `author_chat→author` — shared template, корректно. |

### D. Кросс-режимные связки

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| D1 | Промпты упоминают данные других режимов | ✅ | Использование `{{cross_mode_data}}`, `test_scores_by_scale`, `current_case_id`, `working_hypothesis_narrative`, `weakest_tdm_categories`, `pre_simulation_hypothesis`. |
| D2 | В MODE_DETAILS описаны связки ПЕРЕДАЁТ/ПОЛУЧАЕТ | ✅ | Каждый из 7 режимов имеет секцию «Cross-mode hooks» в [transdiagnostic_cbt_MODE_DETAILS.md](../../../../transdiagnostic_cbt_MODE_DETAILS.md). |
| D3 | Анализ → Практика | ✅ | Разбор кейса (анализ) → Симуляция клиента (ролевая) через `current_case_id`. Сборка гипотезы → Симуляция → Кабинет супервизии. |
| D4 | Нет «сирот» | ✅ | Каждый из 7 tool-режимов либо ПЕРЕДАЁТ либо ПОЛУЧАЕТ хотя бы одну переменную. |
| D5 | Переменные ПЕРЕДАЁТ реально используются в ПОЛУЧАЕТ | ✅ | Проверка по промптам: `working_hypothesis_narrative` упомянут в Сборке (передаёт) и в Treatment Plan + Симуляция (получают). `current_case_id`, `tdm_*_hypotheses` — также. |
| D6 | Сводная таблица в MODE_DETAILS совпадает с промптами | ✅ | Таблица «Сводная таблица кросс-режимных связок» в MODE_DETAILS согласуется с КРОСС-РЕЖИМНАЯ СВЯЗКА в каждом system_prompt. |

### E. Интеграция с тестом

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| E1 | `appendTestScores()` инжектит scores в контекст | ✅ | Хардкод в [lib/chat/prepare-context.ts:423](../../../../lib/chat/prepare-context.ts:423) — `scores_by_scale` подмешивается в system_prompt. |
| E2 | Маппинг шкала → режим задокументирован | ✅ | В MODE_DETAILS таблица «Маппинг тем → режимы»: assessment→Разбор, mechanism→Словарь TDMs, hypothesis→Сборка, intervention→Treatment Plan, revision→Кабинет супервизии. 1:1. |
| E3 | Промпты используют test_scores | ✅ | Промпты Словарь TDMs, Разбор кейса, Симуляция, Treatment Plan, Экзамен — все ссылаются на `test_scores_by_scale.tdcbt_*`. |
| E4 | AI не зачитывает баллы | ✅ | Хардкод в `appendTestScores`: «НЕ зачитывай числовые баллы пользователю». Дополнительные упоминания в промптах не требуются (v1.4). |
| E5 | `test_configs` запись валидна | ✅ | 25 вопросов, 5 шкал, scoring `{answer_range:[1,5], level_labels:[Новичок,Развивающийся,Уверенный,Мастер], score_direction:higher_is_better, level_thresholds:[25,50,75]}`, interpretation_prompt 2054 chars, ui_config.welcome_title с `<br/>` и `<span>`, questions_per_block=5. |
| E6 | `programs.test_system_prompt` заполнен | ✅ | test_len=1209. |
| E7 | `features.test=true` | ✅ | |
| E8 | `landing_data.test` заполнен | ✅ | Секция test есть на лендинге. |
| E9 | mode_template для теста: `is_chat_based=false`, `route_suffix` начинается с `/test/` | ✅ | `test_tdcbt-mastery`: is_chat_based=false, route_suffix=`/test/tdcbt-mastery`. |
| E10 | `program_mode` для теста создан, `enabled=true` | ✅ | sort_order=5, enabled=true, access_type=free. |
| E11 | `program_themes.test_scale_key` заполнен | ✅ | Все 5 тем имеют test_scale_key, маппинг 1:1 с шкалами теста. |
| E12 | Сортировка тем по баллам работает | ✅ | Код в `lib/queries/themes.ts` и `InstrumentList.tsx` — присутствует и используется. Runtime-проверка требует прохождения теста. |
| E13 | `hub_messages` содержит first, returning_test, returning_notest | ✅ | Все три ключа присутствуют. Тексты с `<strong>` (рендерится через dangerouslySetInnerHTML в HubHero). |
| E14 | HistoryScreen теста использует `testConfig.ui_config.welcome_title` | ⚠️ | В БД `ui_config.welcome_title = "Тест мастерства case formulation<br /><span>5 шкал road map Frank & Davidson</span>"` и `welcome_badge = "Самооценка"`. Код фиксит хардкод, но визуальную проверку через `/program/transdiagnostic-cbt/test/tdcbt-mastery?test_state=history-multi` не сделал — для этого нужен dev-login на боевом домене или локально. |
| E15 | Карточка теста на хабе зелёная | ✅ | Forced в [InstrumentList.tsx:104](../../../../components/hub/InstrumentList.tsx:104): `colorClass: (isTestMode ? "green" : (mode.color_class ?? "accent"))`. |

### F. Интеграция с темами

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| F1 | `welcome_ai_message` и `welcome_replies` тем заполнены | ✅ | Все 5 тем: welcome_ai_len 554-630, replies_count=4, last_reply_type=exit. Markdown отсутствует. |
| F2 | `welcome_system_context` заполнен (или маршрут переопределён) | ✅ | Все 5 тем имеют welcome_system_context (sys_ctx_len 219-326). `ctx_has_qr_rules=false` — корректно (правила QR в programs.system_prompt, не дублируются). |
| F3 | Маппинг тема → шкала логичен | ✅ | tdcbt_assessment → tdcbt_assessment, tdcbt_mechanism → tdcbt_mechanism, ... — 1:1 по семантике. |

### G. Ретроспектива и документация

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| G1 | Файл `examples/{slug}.md` существует | ❌ | `.claude/skills/book-to-modes/examples/transdiagnostic-cbt.md` НЕ существует. Заказчик упомянул его в брифе — но Glob показывает только 10 файлов examples (от 100-notes до seven-principles). Ретроспектива не написана. |
| G2 | Содержит секции: что сработало, изобретали, специфика, уроки | ⬜ | Зависит от G1. |
| G3 | `{SLUG}_SYSTEM_PROMPTS.md` существует | ✅ | `transdiagnostic_cbt_SYSTEM_PROMPTS.md` в корне репозитория — 39193 токенов, полные тексты всех промптов. |
| G4 | `{SLUG}_MODE_DETAILS.md` существует | ✅ | `transdiagnostic_cbt_MODE_DETAILS.md` в корне — детализация 9 режимов + safety-каркас + кросс-связки + 5 тем + сводные таблицы. |

### H. Качество контента промптов

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| H1 | Персона AI соответствует типу книги | ✅ | «Коллега-супервизор» — точное попадание для CBT case formulation для практикующих психологов. Не «бережный наставник», не «коуч». Academic peer-level, на «ты», цитирование первоисточников по фамилии и году. Это **новая для платформы персона**. |
| H2 | Тон единообразен | ✅ | Все 7 промптов имеют одинаковый «Кирпич А» (ОБРАЩЕНИЕ), одинаковый запрет приветствий, единый тон. |
| H3 | Промпты не содержат хардкод на пользователя/ситуацию | ✅ | Используются placeholders `{{user_name}}`, `{{user_context}}`, `{{cross_mode_data}}`. |
| H4 | Ролевые: setup, маркер обратной связи, дебрифинг | ✅ | Симуляция клиента имеет: pre-session calibration (фаза 1) + симуляция (фаза 2) + завершение (фаза 3) + DPR-debrief с pre/post comparison (фаза 4). Маркер 💡 заменён на структурированные секции DECLARATIVE/PROCEDURAL/REFLECTIVE — приемлемая адаптация под профильную аудиторию. |
| H5 | Экзамен: адаптивная сложность, metacognitive calibration, фидбэк через концепции | ✅ | Bennett-Levy DPR-stages (Novice → Mastery), 18 типизированных винеток с привязкой к T1.1-T5.4 точкам сложности, feedback цитирует Eells/Persons/Kuyken. |
| H6 | Лекционные используют сократовский метод | ✅ | Словарь TDMs: 5 фаз с вопросами «Приведи пример из практики», «Где формулировка точная, где спутана» — не монологи, а диалог. Дополнительно — терминологическая кросс-таблица (Frank&Davidson ↔ Kuyken ↔ Persons). |

### I. Дебаг UI-состояний

| # | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| I1 | Hub-состояния через `?hub_state=` | ⚠️ | Не проверено визуально — `/program/transdiagnostic-cbt/hub` за middleware, требует dev-login. `programs.hub_messages` содержит все три ключа (см. E13), значит код хаба не упадёт. Финальная визуальная проверка — отдельная задача. |
| I2 | Test-состояния через `?test_state=` | ⚠️ | Тест-страница публичная, но WebFetch вернул SSR-пустоту (контент клиент-рендеренный). Manual через preview/dev-сервер — отдельная задача. |
| I3 | Новый stateful-экран = новый `?<name>_state=` override | ⬜ | Не применимо: новых stateful-экранов не добавляли. |

---

## Дополнительные находки (вне чеклиста)

### Лендинг (https://nice-guy-ai.vercel.app/program/transdiagnostic-cbt)

**Что есть:**
- Hero, social proof (4 карточки), personas (4 типа), problem (4 болевые карточки), outcomes (8 пунктов), comparison (3 колонки), how it works (4 шага), author (Persons с фото), test секция, chat header — всё рендерится.
- Author photo `/authors/persons.jpg` — файл на месте.
- Footer с реквизитами, контактами, юр. ссылками.
- 86% метрика Kendjelic & Eells 2007, ссылки на 200+ эмпирических источников.
- Английские термины упомянуты: Transdiagnostic, case formulation, Vulnerability, Response, Working hypothesis, PDL, CCC-RS, procedural knowledge, Treatment Plan, Persons, Kuyken, Eells, Bennett-Levy, Tom/Linda/Jonah.

**Что НЕ удалось проверить:**
- Anonymous quick-replies на лендинге — WebFetch вернул SSR без них (рендерятся клиентом). Подтверждено только что `programs.anonymous_quick_replies` валиден в БД: массив из 4 объектов `{text, type}`, последний exit.
- Видимость cover-изображения — URL `/covers/transdiagnostic-roadmap.jpg` присутствует в HTML, но **файл в `public/covers/` не существует** → в браузере покажется broken-image (alt-текста тоже нет в коде). См. рекомендацию ниже.
- Русские имена кейсов (Марина, Игорь, Анна, Дмитрий) — упомянуты в outcomes.items и library кейсов в промптах, но WebFetch их не показал. Возможно они под cut-off `5+ русифицированных`.

### Safety-каркас (расширение)

В `programs.system_prompt` (для free_chat и тем) присутствуют триггеры:
- ✅ Анонимизация identifiable details (confidentiality)
- ✅ Out-of-scope (children/psychosis/severe BPD)
- ✅ Кризис / суицид
- ❌/⚠️ Триггер #1 «У меня самого такие симптомы» (self-referent) — не найден явно
- ❌/⚠️ Триггер #3 «Не вижу разницы между собой и клиентом» — не найден явно

В `program_modes.system_prompt` (для tool-режимов) — все 5 триггеров присутствуют (общий Safety-каркас, плюс особые акценты per-mode).

Это **средний риск** — для свободного чата и тем триггеры self-referent неполные. ЦА профильная (психологи), вероятность инцидента ниже, но не нулевая.

### Дубль иконок: tdcbt_exam vs test_tdcbt-mastery

Оба используют `icon="check"`. На хабе будут две карточки в секции «Инструменты» с одной иконкой:
- Тест мастерства (зелёная, isTestMode forced)
- Экзамен (accent/golden)

Цветовая дифференциация частично нивелирует проблему, но семантически — обе карточки про «оценку», и иконка не помогает их различить.

### Cover image — broken

`landing_data.book.cover_url = "/covers/transdiagnostic-roadmap.jpg"`, но `public/covers/transdiagnostic-roadmap.jpg` отсутствует. На production лендинг показывает иконку broken-image (или ничего, если alt-текст пустой).

---

## Рекомендации

### Приоритет 1 (критично)

#### G1 — Ретроспектива в `book-to-modes/examples/`

**Статус:** ❌
**Проблема:** Файл `.claude/skills/book-to-modes/examples/transdiagnostic-cbt.md` не существует. Следующая профессиональная книга (если будет) не получит уроки от этой реализации. Особенно критично потому, что это **первая программа с новой персоной AI «коллега-супервизор»** и **первой расширенной safety-моделью (5 триггеров)** — без ретроспективы это знание не переносится.
**Решение:** Создать `.claude/skills/book-to-modes/examples/transdiagnostic-cbt.md` со структурой:
- Что сработало (персона коллеги-супервизора, terminology gap как учебный элемент, библиотека кейсов Tom/Linda/Jonah + русифицированные, DPR pre/post в Симуляции, CCC-RS как rubric)
- Что изобретали (5-триггерный safety, академический жаргон без перевода, цитирование Eells/Persons/Kuyken по фамилии-году)
- Специфика книги (профильная ЦА, scope-limit для специализированных популяций)
- Уроки (например, дубль иконок check у теста и экзамена; cover не приложен в первой итерации; safety self-referent неполный в programs.system_prompt)
**Трудозатраты:** 1 час
**Приоритет:** 1

### Приоритет 2 (улучшение)

#### Cover image отсутствует

**Проблема:** `public/covers/transdiagnostic-roadmap.jpg` не существует. На production лендинг показывает broken-image в HeroSection.
**Решение:** Скачать обложку с New Harbinger Publications (https://www.newharbinger.com/) или Amazon, положить в `public/covers/transdiagnostic-roadmap.jpg`. Целевой размер ~300-400 КБ, формат JPEG, пропорции книжной обложки (~2:3).
**Трудозатраты:** 10 минут
**Приоритет:** 2 (визуальный, не функциональный)

#### Safety triggers self-referent в `programs.system_prompt`

**Статус:** ⚠️
**Проблема:** Триггеры #1 «У меня самого такие симптомы» и #3 «Не вижу разницы между собой и клиентом» отсутствуют в `programs.system_prompt` (для free_chat и тем). В режимных промптах они есть, но free_chat и темы наследуют программный, не режимный. На профильной ЦА риск средний, но для compliance с APA Code лучше дополнить.
**Решение:** В `programs.system_prompt` секцию `## SAFETY` дополнить триггерами 1 и 3 из общего Safety-каркаса (см. [transdiagnostic_cbt_SYSTEM_PROMPTS.md](../../../../transdiagnostic_cbt_SYSTEM_PROMPTS.md) «Safety-каркас (общий для всех режимов)»). SQL-апдейт через MCP Supabase.
**Трудозатраты:** 15 минут
**Приоритет:** 2

#### A4 — `tdcbt_exam` без scaffolding fading / word_limit

**Статус:** ⚠️
**Проблема:** Чеклист буквально требует scaffolding fading 4→2→0 и word limit 60-80 слов в каждом промпте. У `tdcbt_exam` это сознательно отсутствует — экзамен имеет другой формат (винетка 200-400 слов + feedback 100-150) и адаптивную сложность Bennett-Levy DPR вместо scaffolding.
**Решение:** Не менять промпт. Внести **исключение в CHECKLIST.md** — для режимов с `mode_template.key LIKE '*exam*'` правила A4 неприменимы. Или переименовать в A4-tools и добавить A4-exam с другими критериями.
**Трудозатраты:** 5 минут (правка чеклиста)
**Приоритет:** 2

### Приоритет 3 (косметика)

#### C3 — дубль иконки `check` (тест и экзамен)

**Статус:** ⚠️
**Проблема:** `test_tdcbt-mastery.icon="check"` и `tdcbt_exam.icon="check"`. На хабе обе карточки с одной иконкой ✓. Цветовая дифференциация (тест зелёный, экзамен accent) частично помогает, но семантически плохо.
**Решение:** Сменить `tdcbt_exam.icon` на что-то другое из INSTRUMENT_ICON_MAP (например, `target`, `flask`, `layout`). SQL: `UPDATE mode_templates SET icon='flask' WHERE key='tdcbt_exam';`. Альтернатива — поменять `test_tdcbt-mastery.icon`.
**Трудозатраты:** 5 минут
**Приоритет:** 3

#### E14 / I1 / I2 — визуальная проверка stateful-экранов

**Статус:** ⚠️
**Проблема:** Не проверено визуально: хаб (`?hub_state=first|returning-test|returning-notest`) и тест (`?test_state=welcome|history-single|history-multi`). Все данные в БД на месте, но скриншоты не сняты.
**Решение:** После dev-login (`/api/auth/dev-login` локально или на превью) пройти 6 состояний через query-параметры. Снять скриншоты в `docs/screenshots/transdiagnostic-cbt/` (если папка не существует — создать).
**Трудозатраты:** 30 минут
**Приоритет:** 3

---

## Следующие шаги

1. **(P1)** Написать ретроспективу `.claude/skills/book-to-modes/examples/transdiagnostic-cbt.md` с фокусом на персону «коллега-супервизор» и 5-триггерный safety.
2. **(P2)** Скачать и положить обложку книги в `public/covers/transdiagnostic-roadmap.jpg`.
3. **(P2)** Дополнить `programs.system_prompt` триггерами self-referent #1 и #3 через MCP Supabase.
4. **(P2)** Решить судьбу A4 для tdcbt_exam — либо адаптировать чеклист, либо обойти исключение в комментарии.
5. **(P3)** Сменить иконку `tdcbt_exam` на отличную от `check`.
6. **(P3)** Визуальная проверка hub_state и test_state через dev-login.

---

## Новые правила для CHECKLIST.md (на рассмотрение заказчику)

Эти кандидаты найдены в ходе аудита; решение об добавлении в `references/CHECKLIST.md` — за заказчиком.

### Кандидат 1: Дубли иконок внутри одной программы

**Текущее покрытие:** C3 проверяет только что иконка существует в `INSTRUMENT_ICON_MAP`. Дубли не отлавливаются.
**Предлагаемая проверка:** «C3a (новый): В пределах одной программы нет двух `program_modes` с одинаковым `mode_template.icon` (кроме случая, когда они дифференцированы цветовой схемой и при этом семантически разнопрофильные)».
**SQL для проверки:**
```sql
SELECT mt.icon, array_agg(mt.key) as duplicates
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
JOIN programs p ON p.id = pm.program_id
WHERE p.slug = '{SLUG}' AND pm.enabled = true
GROUP BY mt.icon
HAVING COUNT(*) > 1;
```
**Прецедент:** tdcbt_exam + test_tdcbt-mastery оба с `check`.

### Кандидат 2: Safety-триггер self-referent в `programs.system_prompt`

**Текущее покрытие:** A9 проверяет только наличие QR-блока в `programs.system_prompt`. Safety-триггеры отдельно не проверяются.
**Предлагаемая проверка:** «Для книг с тегом "клиническая работа" / "терапия" / "профессиональная" — `programs.system_prompt` должен содержать ВСЕ safety-триггеры, не только те которые есть в режимных промптах. Free_chat и темы наследуют программный».
**Прецедент:** В режимных промптах transdiagnostic-cbt safety полный (5 триггеров), а в programs.system_prompt — только 3 из 5.

### Кандидат 3: Адаптация A4 для не-стандартных режимов

**Текущее покрытие:** A4 требует scaffolding fading и word_limit для всех режимов.
**Предлагаемая проверка:** Разбить A4 на:
- **A4a:** для tool-режимов (Лекция/Анализ/Воркшоп/Ролевая/Свободный) — scaffolding 4→2→0, word limit 60-80.
- **A4b:** для Экзамена — адаптивная сложность по DPR/Bjork и явный word limit для винетки и feedback.
**Прецедент:** tdcbt_exam с осознанным отступлением.

---

## Подтверждение деплоя

✅ Программа активна на production: https://nice-guy-ai.vercel.app/program/transdiagnostic-cbt — лендинг 200 OK, все секции рендерятся.
✅ Тест задеплоен: 25 вопросов, 5 шкал, navykovy формат higher_is_better, уровни Новичок→Мастер.
✅ 10 program_modes в БД (1 test + 7 tool + free_chat + author_chat), все enabled.
✅ 5 program_themes с маппингом 1:1 на test_scale_key.
✅ Все critical промпты содержат блок Quick replies + ОБРАЩЕНИЕ + Запрет приветствий.
✅ Welcome-сообщения всех 9 режимов и 5 тем — без markdown, с exit-reply, без вложенных «ёлочек».
✅ Иконки 5 новых tdcbt_* ключей в `THEME_ICON_MAP` — переиспользование существующих SVG (BookOpenIcon, CompassIcon, LightbulbIcon, TargetIcon, SparklesIcon) — семантически адекватно.
