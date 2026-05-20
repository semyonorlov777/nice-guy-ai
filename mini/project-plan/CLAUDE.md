# CLAUDE.md — мини-проект `project-plan`

## Что это

Личный трекер задач владельца репозитория. Сейчас наполнен планом «Поездка в Россию» (12 секций, ~100 задач). Доступен по приватной ссылке `https://nice-guy-ai.vercel.app/project-plan` — без авторизации, но с `<meta robots="noindex, nofollow">` чтобы поисковики не индексировали (контент чувствительный: имена близких, медицинские планы, документы).

**Source of truth — `lib/tasks.ts`**. Чекбоксы в UI эфемерные (только `useState`, при перезагрузке возвращаются к коду). Изменения в задачах вносятся правкой `lib/tasks.ts` и деплоятся.

## Workflow редактирования (для будущих сессий)

Пользователь будет писать запросы вроде «добавь задачу X в раздел Y», «отметь задачу 52 как выполненную», «убери из плана задачу Z», «переименуй секцию», «измени приоритет на important», «новый раздел: путешествия».

Алгоритм без промежуточных вопросов:
1. Прочитать `mini/project-plan/lib/tasks.ts`.
2. Внести точечное изменение (Edit, не Write — массив длинный).
   - При добавлении новой задачи — следующий свободный `id` (текущий максимум — 83, бери `84`, `85`, …).
   - При новой секции — новый `id` в kebab-case.
3. Один коммит `feat(project-plan): <что сделал>` или `chore(project-plan): <что сделал>`.
4. Push → `gh pr create` → `gh pr merge --auto --squash` → Vercel деплоит сам.
5. Короткий отчёт строго 3 строки (коммит / что увидит / ссылка).

Не спрашивать «коммитить?» — это явно установленное правило для этого мини.

Помощь в приоритизации (`first` / `important` / без приоритета) — по запросу, можно предлагать proactively когда вижу что задач много а приоритетов мало.

## Жёсткие правила (изоляция)

Этот мини-проект — **изолированный**. Правила основного приложения (чат, режимы, портрет, скиллы `niceguy-design`/`chat-rules`/`book-to-modes`/`book-audit`) к нему **НЕ применяются**. Не открывай и не используй корневой `CLAUDE.md` как руководство — кроме раздела «Мини-проекты — критическое правило».

### Запреты
- ❌ `import` из `@/lib/*`, `@/components/*`, `@/contexts/*`, `@/hooks/*`, `@/types/*` основного приложения.
- ❌ `import` из других `@mini/<other-slug>/*` — мини-проекты не знают друг о друге.
- ❌ Использование классов из основного `app/globals.css` (`.nc-msg`, `.msg`, `.btn-primary` и т.д.). Свои стили — всегда с префиксом `.project-plan-*` в `mini/project-plan/styles.css`.
- ❌ Общие React-компоненты основного (`<SiteFooter>`, `<Sidebar>`, `<MobileTabs>`, `<AuthSheet>`).
- ❌ Запросы к Supabase — в этом мини их вообще нет.
- ❌ Авторизация — страница принципиально публичная (по ссылке, noindex). Не добавлять auth-стену.

### Разрешено
- ✅ Любые npm-зависимости из корневого `package.json`.
- ✅ Шрифты Literata + JetBrains Mono подключены через `@import` в `styles.css` (это намеренный визуальный выбор; не путать с тёмной эстетикой Onest/Cormorant основного).

## Структура

```
mini/project-plan/
├── CLAUDE.md           (этот файл)
├── README.md           (описание для людей)
├── styles.css          (все классы с префиксом .project-plan-*)
├── pages/
│   └── HomePage.tsx    (трекер; "use client" — нужен useState)
└── lib/
    └── tasks.ts        ★ SOURCE OF TRUTH: типы Task/Section + массив TASKS
```

Шим: `app/project-plan/page.tsx` → `export { default } from "@mini/project-plan/pages/HomePage"`.
Layout: `app/project-plan/layout.tsx` — импорт CSS + `metadata.robots = { index: false, follow: false }`.

## Маршруты

- `/project-plan` → `pages/HomePage.tsx`

Других страниц / API нет и не планируется. Если вдруг понадобится — добавить через `pages/XxxPage.tsx` + шим `app/project-plan/xxx/page.tsx`.

## Verification (перед коммитом)

- `npm run build` проходит без ошибок.
- `grep -rE "@/(lib|components|contexts|hooks|types)" mini/project-plan/` ничего не находит.
- `view-source:https://nice-guy-ai.vercel.app/project-plan` содержит `<meta name="robots" content="noindex,nofollow"/>`.
