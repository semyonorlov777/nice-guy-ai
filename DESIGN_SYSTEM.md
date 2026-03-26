# DESIGN_SYSTEM.md — Nice Guy AI

## Справочник для разработчика. Читай перед каждой UI-задачей.

**Стек:** Next.js 16 + TypeScript + Tailwind 4 + Supabase
**Темы:** Light (по умолчанию) + Dark (`data-theme="dark"` на body)
**Переключение тем:** next-themes, три режима: light / dark / system

---

## 1. ТОКЕНЫ

> **Source of truth: `app/globals.css`.** Значения ниже — из кода. Если reference-документ предлагает другое — отмечено комментарием `<!-- design: -->`.

### 1.1 Фоны

| Токен | Light | Dark | Где |
|---|---|---|---|
| `--bg-main` | `#FAFAF5` | `#111318` | Фон страницы |
| `--bg-card` | `#FFFFFF` | `#1C1F26` | Карточки, модалки, баблы AI <!-- design: dark #191c21 / #1C1F26 --> |
| `--bg-elevated` | `#F5F3EE` | `#22262D` | Кнопки, hover, поднятые элементы <!-- design: dark #1e2126 / #22262D --> |
| `--bg-input` | `#FFFFFF` | `#1C1F26` | Поля ввода — ОБЯЗАТЕЛЬНО светлее bg-card в dark |
| `--bg-chat-zone` | `#FAFAF5` | `#111318` | Зона чата |
| `--bg-sidebar` | `#FFFFFF` | `#14161a` | Сайдбар |
| `--error-bg` | `#FFF9F0` | `rgba(212,165,69, 0.06)` | Ошибки (тёплый, НЕ красный) |

> **ЗАПРЕЩЕНО:** `#FFFFFF` как фон страницы, `#000000` как фон. Используй off-white / deep grey.

### 1.2 Текст

| Токен | Light | Dark | Роль |
|---|---|---|---|
| `--text-primary` | `#1A1917` | `#E8E6E1` | Основной текст, заголовки |
| `--text-secondary` | `#6B6860` | `#9A978F` | Подписи, вторичная информация |
| `--text-muted` | `#9E9B93` | `#5F5D57` | Неактивные элементы, плейсхолдеры |
| `--text-hint` | `#B5B2AA` | `#4A4843` | Самый тусклый текст, подсказки <!-- design: dark #6b6860 / #4A4843 --> |

> **ЗАПРЕЩЕНО в dark:** `#FFFFFF` как текст (halation). Используй `#E8E6E1`.

### 1.3 Акцент (amber/gold — per-book, меняется через semantic tokens)

| Токен | Light | Dark | Роль |
|---|---|---|---|
| `--accent` | `#C9963B` | `#D4A545` | Основной акцент (Nice Guy = amber) <!-- design: dark #D4A545 / #c9a84c --> |
| `--accent-dark` | `#8A6B24` | `#A07A2E` | Тёмный вариант (градиенты, hover) |
| `--accent-hover` | `#a8832e` | `#d4b35a` | Hover-состояние |
| `--accent-soft` | `rgba(201,150,59, 0.08)` | `rgba(212,165,69, 0.10)` | Мягкий фон (badges, active items, quick replies) |
| `--accent-border` | `rgba(201,150,59, 0.25)` | `rgba(212,165,69, 0.22)` | Бордеры акцентных элементов |
| `--accent-glow` | `rgba(201,150,59, 0.12)` | `rgba(212,165,69, 0.15)` | Свечение (тень обложки, pulse) |
| `--accent-medium` | `rgba(201,150,59, 0.15)` | `rgba(212,165,69, 0.18)` | Промежуточная прозрачность |
| `--accent-on` | `#FFFFFF` | `#1A1917` | Текст НА accent-кнопке (инверсия!) |

> **`--accent-on`** используется ТОЛЬКО на кнопках внутри теста (`.tc-btn-primary`). Кнопки чата, баланса, лендинга — `color: #fff` (hardcoded, не трогать).

### 1.4 Статусы

| Токен | Light | Dark |
|---|---|---|
| `--green` / `--success` | `#4A7A4A` | `#6AAE6A` |
| `--green-soft` / `--success-soft` | `rgba(74,122,74, 0.08)` | `rgba(106,174,106, 0.10)` |
| `--green-border` | `rgba(74,122,74, 0.25)` | `rgba(106,174,106, 0.25)` |
| `--danger` | `#C94C4C` | `#D46B6B` <!-- design: dark #dc5050 / #D46B6B --> |
| `--danger-text` | `#B85C5C` | `#C07070` |
| `--danger-soft` | `rgba(201,76,76, 0.08)` | `rgba(220,80,80, 0.10)` |
| `--danger-border` | `rgba(201,76,76, 0.25)` | `rgba(220,80,80, 0.25)` |
| `--status-done` | `#5a8c5a` | `#6aae6a` |
| `--status-done-bg` | `rgba(90,140,90, 0.10)` | `rgba(106,174,106, 0.12)` |
| `--status-active-bg` | `rgba(201,150,59, 0.12)` | `rgba(212,165,69, 0.12)` |

### 1.5 Бордеры

| Токен | Light | Dark |
|---|---|---|
| `--border` | `#E8E5DE` | `#2A2D33` |
| `--border-light` | `#EFEDE7` | `#232629` |

### 1.6 Тени и фокус

| Токен | Light | Dark |
|---|---|---|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.04)` | `0 1px 3px rgba(0,0,0,0.2)` |
| `--shadow-focus` | `0 0 0 3px rgba(201,150,59,0.2)` | `0 0 0 3px rgba(212,165,69,0.15)` |
| `--scrim` | `rgba(26,25,23, 0.3)` | `rgba(0,0,0, 0.5)` |

<!-- design: --shadow-sm light = 0 2px 8px rgba(0,0,0,0.08) -->

> **Dark mode:** тени невидимы. Использовать бордеры вместо теней. Если есть `box-shadow` — добавь `[data-theme="dark"] { box-shadow: none; }`.

### 1.7 Сообщения (чат)

| Токен | Light | Dark |
|---|---|---|
| `--msg-ai-bg` | `#FFFFFF` | `#1C1F26` |
| `--msg-ai-border` | `#E8E5DE` | `#2A2D33` |
| `--msg-user-bg` | `#F5F0E2` | `rgba(212,165,69, 0.08)` |
| `--msg-user-border` | `#E8DFC8` | `rgba(212,165,69, 0.15)` |

### 1.8 Радиусы

| Токен | Значение | Где |
|---|---|---|
| `--radius` | `16px` | Основной радиус <!-- design: 10px (Nice Guy per-book) --> |
| `--radius-sm` | `12px` | Карточки, мелкие элементы <!-- design: 8px --> |
| `--radius-xs` | `8px` | Code-блоки, мелкие чипы <!-- design: 4px --> |
| `--radius-pill` | `100px` | Quick reply кнопки, pills <!-- design: 24px --> |

> Радиус — semantic token, может меняться per-book.

### 1.9 Layout

| Токен | Значение | Где |
|---|---|---|
| `--header-h` | `56px` | Высота header |
| `--tabs-h` | `52px` | Высота нижних табов <!-- design: ~56px --> |
| `--sidebar-w` | `280px` | Ширина сайдбара (десктоп) |
| `--sidebar-collapsed-w` | `64px` | Ширина свёрнутого сайдбара <!-- design: 0 --> |
| `--content-w` | `720px` | Max-width контентной зоны <!-- design: 640px --> |
| `--chat-w` | `640px` | Max-width чата |

### 1.10 Auth-тема (AuthSheet)

Отдельная светлая тема для компонента авторизации. Префикс `--auth-*`.

| Токен | Значение |
|---|---|
| `--auth-bg` | `#FAFAF5` |
| `--auth-bg-card` | `#FFFFFF` |
| `--auth-bg-elevated` | `#F5F3EE` |
| `--auth-border` | `#E8E5DE` |
| `--auth-border-light` | `#EFEDE7` |
| `--auth-text` | `#1A1917` |
| `--auth-text-secondary` | `#6B6860` |
| `--auth-text-muted` | `#9E9B93` |
| `--auth-text-hint` | `#B5B2AA` |
| `--auth-accent` | `#C9963B` |
| `--auth-accent-soft` | `rgba(201,150,59, 0.08)` |
| `--auth-accent-border` | `rgba(201,150,59, 0.25)` |
| `--auth-accent-glow` | `rgba(201,150,59, 0.12)` |
| `--auth-green` | `#4A7A4A` |
| `--auth-green-soft` | `rgba(74,122,74, 0.08)` |
| `--auth-tg-blue` | `#2AABEE` |
| `--auth-tg-blue-hover` | `#229ED9` |
| `--auth-ya-red` | `#FC3F1D` |
| `--auth-ya-red-hover` | `#E5391A` |
| `--auth-ease` | `cubic-bezier(0.25, 0.1, 0.25, 1.0)` |

### 1.11 Тема результатов теста (.test-results-page)

Страница использует глобальные токены из §1.1–1.6. Приватных `--tr-*` переменных нет.

CSS-классы сохраняют префикс `.tr-*` (`.tr-hero`, `.tr-radar-wrapper`, `.tr-scale-card`).

**Исключение:** RadarChart SVG gradient `<stop stopColor>` использует hardcoded rgba, выровненные с `--green`, `--accent`, `--danger` — SVG-атрибут `stopColor` не поддерживает CSS custom properties и `color-mix()`.

---

## 2. ТИПОГРАФИКА

### 2.1 Шрифты

```
--font-display: 'Cormorant Garamond', Georgia, serif   → заголовки, цитаты из книг
--font-body:    'Onest', -apple-system, sans-serif      → текст, UI, чат
```

Подключение: `next/font/google`.

### 2.2 Размеры и веса

| Роль | Размер | Шрифт | Вес |
|---|---|---|---|
| Заголовок экрана (h1) | `clamp(24px, 4vw, 38px)` | Cormorant Garamond | 600 |
| Заголовок главы (h2) | 20–24px | Cormorant Garamond | 600 |
| Заголовок упражнения (h3) | 16–18px | Cormorant Garamond | 500 |
| Вопрос теста | `clamp(21px, 3.5vw, 26px)` | Cormorant Garamond | 500 |
| Название welcome card | 22px | Cormorant Garamond | 600 |
| Чат body text | min 16px | Onest | 400 |
| UI (кнопки, лейблы) | 14–15px | Onest | 500–600 |
| Quick reply текст | 14px | Onest | 500 |
| Метаданные (время, автор) | 13px | Onest | 400 |
| Подсказки, мелкий текст | 12px | Onest | 400 |
| Scale labels (uppercase) | 11px | Onest | 500, `letter-spacing: 1.2px` |
| Privacy label под инпутом | 11px | Onest | 400 |

### 2.3 Line-height

- Чат body text: **1.45–1.5** (для длинных AI-ответов)
- UI: **1.4**
- Descriptions: **1.6**

### 2.4 Правила

- Русский текст на 20–30% длиннее английского → `flex`-контейнеры, никаких фиксированных ширин
- CSS `clamp()` для fluid typography
- `rem` с `clamp()`, никогда `px` для текста (поддержка Dynamic Type)
- Dark mode: font-weight bump +1 ступень для мелких labels (12–13px) — светлый текст выглядит тоньше

---

## 3. КОМПОНЕНТЫ

### 3.1 Баблы чата

**Файл:** `components/ChatWindow.tsx`

**AI-бабл** (`.msg-ai`):
- Фон: `--msg-ai-bg` + border `1px solid var(--msg-ai-border)`
- Padding: **14px 18px**
- Border-radius: **16px**
- Max-width: **85%** (мобильный), **75%** (десктоп)
- Хвостик: **нет**
- Аватар AI слева: gradient-сфера 28×28px

**User-бабл** (`.msg-user`):
- Фон: `--msg-user-bg` + border `1px solid var(--msg-user-border)`
- Те же padding, radius, max-width
- Расположение: справа (`flex-direction: row-reverse`)
- Аватар справа: круг «Я» 28×28px или OAuth-фото

**Расстояние между сообщениями:** `gap: 14px`

**Анимация появления (`msgIn`):** fade-in + translateY(6px→0), **250ms**, `--ease`

**CSS-классы:** `.msg`, `.msg-ai`, `.msg-user`, `.msg-avatar`, `.msg-avatar.ai`, `.msg-avatar.user`, `.msg-avatar-img`, `.msg-bubble`

### 3.2 AI-аватар (gradient-сфера)

- 28×28px, `border-radius: 50%`
- `background: linear-gradient(145deg, var(--accent), var(--accent-dark))`
- `box-shadow: 0 1px 4px var(--accent-glow)`
- `margin-top: 2px` (выровнен с первой строкой)
- Цвет градиента меняется per-book через `--accent`

### 3.3 User-аватар («Я»)

- 28×28px, `border-radius: 50%`
- Фон: `var(--bg-elevated)`, border `1.5px solid var(--border)`
- Текст: «Я», 12px, weight 600, цвет `var(--text-muted)`
- Если есть OAuth-фото — показывать `<img>` вместо буквы (`.msg-avatar-img`)

### 3.4 Quick Replies

**Файл:** `components/ChatWindow.tsx`

- Фон: `var(--accent-soft)`, border `1px solid var(--accent-border)`
- Текст: `var(--accent)`, 14px, weight 500
- Border-radius: pill (`--radius-pill`)
- Min-height: **44px**, padding: **12px 20px**
- Layout: **вертикальный стек** (column), max 3–4 кнопки. НЕ горизонтальный скролл
- Расположение: под AI-баблом
- Без эмодзи (кроме точечных action-эмодзи типа ✍️)
- **Подсказка-лейбл** (`.quick-reply-label`): «Выбери вариант или напиши своё», 12px `--text-muted`

**При нажатии:**
- Flash: `--accent` фон 120ms, текст белый
- Текст кнопки → user-сообщение
- Остальные кнопки: fade-out 200ms

**Анимация появления (`quickReplyIn`):** stagger 100ms между кнопками, fade-in + slideY(4px→0), 200ms

**CSS-классы:** `.quick-replies`, `.quick-reply-btn`, `.quick-reply-btn.quick-reply-enter`, `.quick-reply-label`

### 3.5 Welcome Card

**Файл:** `components/chat/NewChatScreen.tsx`

- Обложка книги по центру, `border-radius: 3px 10px 10px 3px` (форма книги)
- Тень обложки + amber glow `var(--accent-glow)`
- Название: `--font-display`, 22px, weight 600
- Автор + описание: 13px, `--text-muted`
- Карточка исчезает (`.wc-exit`) при начале чата

**CSS-классы:** `.wc`, `.wc.wc-exit`, `.wc-book`, `.wc-mode`, `.wc-title`, `.wc-sub`

### 3.6 Typing Indicator

**Файл:** `components/ChatWindow.tsx`

- Мини-бабл + аватар gradient-сфера слева
- Три точки (`.thinking-dot`): 6px, `border-radius: 50%`, цвет `--text-hint`
- Анимация (`typingPulse`): **opacity pulse** (0.25→0.9→0.25), цикл 1200ms, `ease-in-out`, delay между точками 200ms
- **НЕ bounce** (слишком весёлый для терапии)
- Текст «думаю» убран

**CSS-классы:** `.thinking-indicator`, `.thinking-bubble`, `.thinking-dot`

### 3.7 Streaming Cursor

**Файл:** `components/ChatWindow.tsx`

- Символ: `▊`
- Цвет: `var(--accent)`
- Анимация (`blink`): 800ms `step-end` infinite
- Font-weight: 300

**CSS-класс:** `.streaming-cursor`

### 3.8 Scroll FAB

**Файл:** `components/ChatWindow.tsx`

- Круг **40px**, фон `--bg-card`, border `1px solid var(--border)`
- Иконка: стрелка вниз 16px, `--text-secondary`
- Позиция: по центру, **16px** над инпут-баром
- Появление: при скролле ≥ 200px от низа
- Анимация: scale(0.8→1) + opacity(0→1), 250ms ease-out
- При нажатии: smooth scroll, **max 500ms**
- **Без** badge непрочитанных

**CSS-классы:** `.scroll-fab`, `.scroll-fab.visible`

### 3.9 ChatHeader

**Файл:** `components/ChatHeader.tsx`

```
←  [обложка 32×44]  Название режима        [⊞]  ⚡847
                     Название книги
```

- Обложка: 32×44px, `border-radius: 3px 5px 5px 3px`, pseudo-element корешка (3px)
- Первая строка (`.chat-header-mode`): 14px bold (название текущего режима)
- Вторая строка (`.chat-header-book`): 11px `--text-muted` (название книги)
- Кнопка «←» (`.chat-header-back`): возвращает в hub

**Кнопка переключения режимов** (`.chat-header-switcher`):
- 34×34px, `border-radius: 8px`
- Фон: `--bg-elevated`, border `1px solid var(--border)`
- Hover: border→`--accent-border`, цвет→`--accent`
- Active: фон→`--accent-soft`, border→`--accent`, иконка→`--accent`

**Dropdown-панель режимов** (`.mode-panel`):
- Slide-down 250ms + fade (`panelSlide`)
- Scrim (`.mode-panel-scrim`), клик закрывает
- Текущий режим: accent-фон + ✓ (`.mode-panel-check`)
- Платные: искра ★ (`.mode-panel-badge`)
- Внизу: «Все режимы и прогресс» → hub (`.mode-panel-hub-link`)

**CSS-классы:** `.chat-header`, `.chat-header-back`, `.chat-header-cover`, `.chat-header-info`, `.chat-header-mode`, `.chat-header-book`, `.chat-header-switcher`, `.chat-header-balance`, `.mode-panel-scrim`, `.mode-panel`, `.mode-panel-title`, `.mode-panel-list`, `.mode-panel-item`, `.mode-panel-icon`, `.mode-panel-body`, `.mode-panel-name`, `.mode-panel-desc`, `.mode-panel-badge`, `.mode-panel-check`, `.mode-panel-arrow`, `.mode-panel-hub-link`

### 3.10 InputBar

**Файлы:** `components/InputBar/InputBar.tsx`, `components/InputBar/useInputBar.ts`

Единый компонент: `.input-container` — pill-контейнер, внутри textarea + rec-bar + error-bar + action button.

**Textarea** (`.input-textarea`):
- `min-height: 44px` (мобилка) / `52px` (десктоп)
- `max-height: 140px`, auto-resize
- `font-size: 15–16px`, `line-height: 1.5`
- Фокус: `border-color: var(--accent)`, `box-shadow: var(--shadow-focus)`

**Action Button** (`.ib-action-btn`) — 6 состояний:

| Состояние | CSS-класс | Фон | Иконка | Когда |
|---|---|---|---|---|
| Idle | (default) | `--bg-elevated` + border | `.ib-ico-mic` микрофон | поле пустое |
| Typing | `.s-typing` | accent | `.ib-ico-send` стрелка | есть текст |
| Recording | `.s-recording` | danger + pulse | `.ib-ico-stop` квадрат | push-to-talk |
| Locked | `.s-locked` | danger, без pulse | `.ib-ico-stop` квадрат | hands-free (64px) |
| Sent | `.s-sent` | success | `.ib-ico-check` галочка | после отправки |
| Error | `.s-error` | shake→idle | возврат к mic | ошибка |

**Recording Bar** (`.ib-rec-bar`): при recording/locked вместо textarea:
- Красная мигающая точка (`.ib-rec-dot`, `ib-rec-dot-blink` 1s)
- Таймер (`.ib-rec-timer`, `font-variant-numeric: tabular-nums`, MM:SS)
- Waveform: `.ib-rec-wave` с полосками `.ib-rec-wave-bar`
- Кнопка «Отмена» (`.ib-rec-cancel`)
- Свайп-подсказка (`.ib-rec-swipe-hint`)

**Error Bar** (`.ib-error-bar`): иконка + текст + dismiss, 2500ms auto-hide + 500ms fade

**Input wrap:** `background: transparent` (без border-top!), инпут «плавает» с собственной тенью

**Privacy label** (`.ib-footer`): `🔒 Диалог анонимизирован и зашифрован`, 11px, `--text-hint`, постоянно видна

**Жесты (pointer events):**
- Desktop: click toggle record (hands-free lock)
- Touch: hold 200ms = push-to-talk, release = send
- Swipe up 40px during recording → lock
- Swipe left 60px → cancel

### 3.11 Error States

**Тип A — в потоке чата** (inline-карточка, `.error-card`):
- Фон: `var(--error-bg)` (тёплый, НЕ красный)
- Border-left: `3px solid var(--accent)` (НЕ красный)
- Текст: `--text-secondary`, 14px, `line-height: 1.6`
- Кнопка «↻ Повторить» (`.error-retry-btn`): pill, accent, `min-height: 36px`
- Лимит сообщений → «Перейти к тарифам →» (`.error-link-btn`, outline pill), **без модалок**

**Тип B — под инпутом** (`.input-validation-hint`):
- 11px, `--text-muted`
- **НЕ красный, НЕ danger**, не shake, не highlight на инпуте

### 3.12 Markdown в сообщениях

**Blockquote (цитаты из книги):**
- `border-left: 3px solid var(--accent)`
- Фон: `var(--accent-soft)`
- Padding: `12px 16px`
- `border-radius: 0 8px 8px 0`
- **Шрифт: italic, `--font-display` (Cormorant Garamond)**

**Заголовки h1-h3:**
- Шрифт: `--font-display`, цвет: `--accent`, weight 600
- h3: 17px

**Списки:** `padding-left: 1.4em`, `margin: 6px 0`
**Inline code:** фон `--bg-elevated`, padding `1px 5px`, radius 4px
**Pre:** фон `--bg-elevated`, border `1px solid var(--border)`, padding `10px 12px`
**Ссылки:** цвет `--accent`, underline

### 3.13 Test Flow (ISSP)

**Файл:** `components/TestCardFlow.tsx` + `components/test/*`

**Progress Bar:** сегментированный
- "**N** из 35" + горизонтальная полоска из K сегментов
- Никаких процентов

**Quick Reply кнопки (тест):**
- 5 кнопок в ряд: числа Cormorant 17px, лейблы 8px
- Визуально secondary: `--bg-elevated`, тонкий бордер, compact padding 8px
- При тапе: flash 120ms accent → selected → auto-advance 250ms

**Переход между вопросами:**
- Текущий: `opacity: 0, translateX(-12px)` за 280ms
- Новый (`tcQEnter`): `opacity: 0→1, translateX(16px→0)` за 350ms

**CSS-префикс:** `.tc-*` (`.tc-page`, `.tc-question`, `.tc-btn-primary`, `.tc-spin`)

### 3.14 Hub

**Файлы:** `components/hub/*`

**HubScreen** (`components/hub/HubScreen.tsx`):
- Оркестратор с state: "first" | "returning-test" | "returning-notest"
- Содержит: HubMobileHeader → HubHero → HubContinueCard → AIMessage → CTA → ThemeCardsGrid → InstrumentList → HubInputBar

**HubHero** (`.hub-hero`):
- Обложка книги + title/author
- Compact-вариант (`.hub-hero-compact`) для returning users

**HubContinueCard** (`.hub-continue`):
- Карточка «Продолжить: [режим]» со ссылкой на последний активный чат
- PlayIcon + ArrowRightIcon

**AIMessage** (`.hub-ai-msg`):
- AI-приветствие с gradient-аватаром (`.hub-ai-avatar`)
- HTML из API через `dangerouslySetInnerHTML`

**InstrumentCard** (`.hub-instrument`):
- Иконка (`.inst-icon.accent` / `.inst-icon.green`) + название + описание + badge/progress
- Done-состояние: `.inst-check` (CheckIcon)

**InstrumentList** (`.hub-instruments`):
- Маппинг mode → иконка через `INSTRUMENT_ICON_MAP`
- Динамические описания (количество упражнений, статус теста)

**ThemeCard** (`.hub-theme-card`):
- Иконка из `THEME_ICON_MAP` + title + description
- Состояния: `.engaged`, `.recommended`

**ThemeCardsGrid** (`.hub-themes`):
- CSS grid, max 6 карточек

**HubInputBar** (`.hub-input-wrap`):
- Текстовое поле → redirect на `/chat/new?tool=free-chat&initialMessage=...`
- Privacy label (`.hub-privacy`)

**HubMobileHeader** (`.hub-header`):
- Обложка/название книги + subtitle + баланс (⚡)

**CSS-префикс:** `.hub-*`

### 3.15 Sidebar

**Файл:** `components/Sidebar.tsx`

- Десктоп-навигация для авторизованных
- Collapsible: состояние в `localStorage` (`sidebar-collapsed`)
- Навигация: Hub (HomeIcon), Chats (ChatIcon), Portrait (PortraitIcon)
- Кнопка «Новый чат» (`.sidebar-new-chat`)
- Список недавних чатов (`.sidebar-chat-list`, до 30 шт)
- Profile footer: ProfileMenu

**CSS-префикс:** `.sidebar-*`, `.sb-chat*`

### 3.16 MobileTabs

**Файл:** `components/MobileTabs.tsx`

- 3 таба: Hub (HomeIcon), Chats (ChatIcon), Profile (PortraitIcon)
- Active detection через URL pathname

**CSS-классы:** `.mobile-tabs`, `.mobile-tab`, `.mobile-tab.active`, `.mobile-tab-icon`, `.mobile-tab-label`

### 3.17 MobileChatHeader

**Файл:** `components/MobileChatHeader.tsx`

- Минимальный header: back (←) + title + actions (✏️ / +)

**CSS-классы:** `.mobile-chat-header`, `.mobile-header-btn`, `.mobile-header-title`

### 3.18 ChatListPage

**Файл:** `components/chat/ChatListPage.tsx`

- Список всех чатов с группировкой по дате
- Empty state с CTA на hub
- Plus-кнопка для нового чата

**CSS-классы:** `.cl-page`, `.cl-scroll`, `.cl-empty`, `.cl-empty-orb`, `.cl-empty-title`, `.cl-empty-desc`, `.cl-empty-btn`, `.cl-date-label`

### 3.19 ChatListItemFull

**Файл:** `components/chat/ChatListItemFull.tsx`

- Иконка по типу чата (exercise→ExercisesIcon, author→AuthorIcon, free→FreechatIcon, test→TestIcon)
- Color class: `.cl-icon.i-{colorClass}`

**CSS-классы:** `.cl-item`, `.cl-icon`, `.cl-body`, `.cl-name`, `.cl-preview`, `.cl-meta`, `.cl-time`

### 3.20 NewChatScreen

**Файл:** `components/chat/NewChatScreen.tsx`

- Welcome → Quick Replies → Conversation transition
- Welcome card с обложкой (исчезает при первом сообщении)
- AI-приветствие (`.nc-ai-msg`)
- Quick replies (`.nc-reply`) с exit-анимацией
- Стриминг из `/api/chat`
- Typing indicator (`.nc-typing`, 3 dot animation)
- Error card (`.nc-error`) с retry

**CSS-префикс:** `.nc-*`

### 3.21 AuthSheet

**Файл:** `components/AuthSheet.tsx`

- Два режима: sheet (bottom sheet) / fullscreen (карточка по центру)
- Три контекста: test / chat / default (контекстные заголовки)
- Методы: Telegram OIDC, Яндекс OAuth popup, Email Magic Link
- Использует `--auth-*` переменные (см. §1.10)

---

## 4. ИКОНКИ

### 4.1 Общие правила

- **Только SVG**, никогда emoji (кроме 🔒 в privacy label)
- Стандартный размер: **18px** (UI), **16px** (мелкие), **24px** (action)
- `stroke-width: 1.5–2.5`
- Цвет через `currentColor` → наследует от родителя

### 4.2 Реестр иконок

**Файл:** `components/icons/hub-icons.tsx` (29 иконок)

| Группа | Иконки |
|---|---|
| ISSP-шкалы | `ApprovalIcon`, `ContractsIcon`, `SuppressionIcon`, `ControlIcon`, `BoundariesIcon`, `MasculinityIcon`, `AttachmentIcon` |
| Инструменты | `ExercisesIcon`, `SelfcheckIcon`, `TestIcon`, `AuthorIcon`, `FreechatIcon` |
| Навигация | `HomeIcon`, `ChatIcon`, `UserIcon`, `PortraitIcon`, `PlusIcon` |
| UI | `ArrowRightIcon`, `PlayIcon`, `CheckIcon`, `LockIcon`, `SendIcon`, `CollapseIcon`, `CollapseBackIcon`, `CreditCardIcon`, `LogoutIcon` |
| Тема | `SunIcon`, `MoonIcon`, `MonitorIcon` |

Экспорт: `THEME_ICON_MAP` — маппинг ключей на иконки ISSP-шкал.

**Файл:** `components/hub/mode-icons.tsx` (9 иконок)

`PenIcon`, `ClockIcon`, `CheckIcon`, `BookIcon`, `ChatIcon`, `ArrowRightIcon`, `PlayIcon`, `SessionsIcon`, `TimeIcon`

Экспорт: `getModeIcon(iconKey)` — возвращает компонент или ChatIcon fallback.

### 4.3 Где какая иконка

| Контекст | Иконка | Размер |
|---|---|---|
| Кнопка «назад» | `←` (стрелка влево) | 18px |
| Переключатель режимов | Сетка 2×2 (⊞) | 18px |
| Баланс | `⚡` молния | 14px |
| Typing indicator | 3 точки (CSS circles) | 6px каждая |
| Scroll FAB | Стрелка вниз | 16px |
| Send (typing) | `.ib-ico-send` стрелка | 18px |
| Mic (idle) | `.ib-ico-mic` микрофон | 18px |
| Stop (recording) | `.ib-ico-stop` квадрат | 18px |
| Checkmark (sent) | `.ib-ico-check` галочка | 18px |
| Lock icon | 🔒 | Inline text |

---

## 5. ЦВЕТОВЫЕ РОЛИ

### 5.1 Когда какой цвет

| Роль | Токен | Примеры |
|---|---|---|
| **Accent (gold/amber)** | `--accent` | CTA-кнопки, прогресс, активные элементы, заголовки в markdown, border-left цитат, streaming cursor, AI-аватар gradient, badge баланса, focus ring |
| **Green/Success** | `--green` / `--success` | Sent state кнопки (✓), статус «сделано», завершение упражнения |
| **Danger** | `--danger` | Recording state кнопки, мигающая точка записи. **НЕ для ошибок** — ошибки используют accent/muted |
| **Neutral** | `--text-muted`, `--text-hint` | Ошибки ввода (тип B), неактивные элементы, плейсхолдеры |

### 5.2 Правила ошибок

- **Ошибки в чате:** `--error-bg` (тёплый off-white) + `border-left: --accent`. НЕ красный.
- **Ошибки под инпутом:** `--text-muted`, 11px. НЕ красный, НЕ shake.
- **Ошибки голосового ввода:** shake + toast (отдельная логика в InputBar).

### 5.3 Per-book акценты

| Тема книги | Акцент | Radius |
|---|---|---|
| Самооценка (Nice Guy) | `#C9963B` amber | 10px |
| Отношения | `#C88A94` rose | 14px |
| Тревога / стресс | `#7BAACC` синий | 12px |
| Депрессия | `#53A3A3` teal | 8px |
| Mindfulness | `#B8A3CC` lavender | 16px |
| Продуктивность | `#3373BF` синий | 8px |
| Травма / исцеление | `#42856B` forest | 6px |

---

## 6. АНИМАЦИИ

### 6.1 Easing

```css
--ease: cubic-bezier(0.25, 0.1, 0.25, 1.0);           /* основной — асимметричная декелерация */
--ease-bounce: cubic-bezier(0.175, 0.885, 0.32, 1.275); /* popIn элементы (checkmarks, badges) */
```

### 6.2 Тайминги (терапевтические — медленнее стандарта)

| Что | Длительность | Заметки |
|---|---|---|
| Hover кнопки | 150ms | |
| Crossfade иконок | 150ms | opacity + transform scale |
| Появление контента | 250–400ms | fade-in + translateY |
| Transition между экранами | 500ms | |
| Exit вопроса (тест) | 280ms | opacity + translateX(-12px) |
| Enter вопроса (тест) | 350ms | opacity + translateX(16px→0) |
| Quick reply flash | 120ms | |
| Quick reply selected hold | 250ms | |
| Stagger между quick replies | 100ms | delay между кнопками |
| Success state (sent button) | 1200ms hold → reset | |
| Error shake | 400ms | |
| Error bar auto-hide | 2500ms + 500ms fade | |
| Typing indicator cycle | 1200ms | |
| Typing indicator dot delay | 200ms | между точками |
| Streaming cursor blink | 800ms | step-end |
| Scroll FAB appear | 250ms | scale + opacity, ease-out |
| Smooth scroll to bottom | max 500ms | |
| Dropdown appear | 250ms | slide-down + fade |
| Dark↔Light transition | 200ms | НЕ на первой загрузке |
| Onboarding pulse инпута | 2 × 1500ms | amber glow, затухает |

### 6.3 Keyframes (из кода)

| Анимация | Описание |
|---|---|
| `fadeIn` | opacity 0→1 + translateY(-4px→0) |
| `msgIn` | opacity 0→1 + translateY(6px→0) |
| `welcomeMsgIn` | opacity 0→1 + translateY(6px→0) |
| `quickReplyIn` | opacity 0→1 + translateY(4px→0) |
| `blink` | opacity 1→0→1 (cursor) |
| `typingPulse` | opacity 0.25→0.9→0.25 |
| `inputPulseGlow` | box-shadow pulse с accent-glow |
| `spin` | rotate 360° |
| `toastIn` | opacity + translateY(8px→0) |
| `scrimIn` | opacity 0→1 |
| `panelSlide` | opacity + translateY(-8px→0) |
| `hintFade` | opacity 0→1 |
| `tcScreenIn` | opacity + translateY(6px→0) |
| `tcQEnter` | opacity + translateX(16px→0) |
| `tcBtnPulse` | box-shadow pulse accent |
| `tcPopIn` | scale(0→1) + opacity |
| `tcFadeInUp` | opacity + translateY(6px→0) |
| `analyzingOrbPulse` | scale + opacity pulse |
| `analyzingOrbGlow` | scale(0.8→1.5) + opacity fade |
| `analyzingDotPulse` | box-shadow pulse |
| `analyzingWaitPulse` | opacity 0.5→1→0.5 |
| `tcDoneOrbPulse` | scale + box-shadow pulse |
| `ib-rec-breathe` | recording button glow pulse |
| `ib-rec-breathe-dark` | dark theme variant |
| `ib-shake` | translateX shake (-4→4→-3→2→0) |
| `ib-rec-bar-in` | opacity + scaleX(0.95→1) |
| `ib-rec-dot-blink` | opacity 1→0.3→1 |
| `welcomeFadeOnly` | opacity 0→1 (reduced motion) |
| `tcQuestionFade` | opacity 0→1 (reduced motion) |

### 6.4 Что НЕ анимировать

- Зацикленные фоновые анимации
- Confetti / celebration (subtle glow вместо)
- Skeleton screens в чате
- Autoplay видео
- Эффекты, не инициированные пользователем

### 6.5 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  /* slide/scale → только fade 150ms */
  /* stagger → все одновременно */
  /* pulse → отключить */
  /* typing indicator → статичный текст «Ассистент печатает...» */
}
```

---

## 7. RESPONSIVE

### 7.1 Layout

```css
max-width: 640px;   /* контент: тест, чат, упражнения (--chat-w) */
margin: 0 auto;     /* центрирование на десктопе */
width: 100%;        /* мобилка — полный экран */
```

### 7.2 Mobile-first

- **80%+ пользователей на телефоне**
- `height: 100dvh` (НЕ 100vh)
- VisualViewport API для iOS-клавиатуры
- `viewport-fit=cover` + `env(safe-area-inset-*)` для iPhone notch
- `overscroll-behavior-y: contain` (pull-to-refresh отключён)
- `-webkit-tap-highlight-color: transparent`

### 7.3 Touch Targets

- Primary actions (Send, Voice): **44×44px** minimum
- Quick reply кнопки: min-height **44px**
- Все интерактивные: minimum **44px**

### 7.4 Баблы

- Мобильный max-width: **85%**
- Десктоп max-width: **75%**

### 7.5 InputBar

- Мобильный min-height: **44px**
- Десктоп min-height: **52px**

### 7.6 Safe Area

```css
padding-bottom: env(safe-area-inset-bottom);
```

На iOS standalone PWA нет кнопки «назад» — навигация только через UI.

### 7.7 Meta

```html
<meta name="theme-color" content="#FAFAF5" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#0b0c0e" media="(prefers-color-scheme: dark)" />
```

---

## 8. ПРАВИЛА ИМЕНОВАНИЯ CSS

### 8.1 Префиксы

| Область | Префикс | Пример |
|---|---|---|
| Hub | `.hub-*` | `.hub-hero`, `.hub-mode-card` |
| Sidebar | `.sidebar-*` | `.sidebar-item` |
| Chat (layout) | `.cl-*` | `.cl-page`, `.cl-item` |
| Portrait | `.pd-*` | `.pd-card` |
| Message | `.msg-*` | `.msg-ai`, `.msg-user` |
| Test | `.tc-*` | `.tc-question`, `.tc-btn-primary` |
| Test Results | `.tr-*` | `.tr-card` |
| Input | `.input-*`, `.ib-*` | `.input-container`, `.ib-action-btn` |
| New Chat | `.nc-*` | `.nc-screen`, `.nc-reply` |
| Welcome Card | `.wc-*` | `.wc-book`, `.wc-title` |
| Auth | `.auth-*` | (CSS-переменные) |

### 8.2 Tailwind 4 + CSS Layers

```css
@layer base {
  :root { /* light tokens */ }
  [data-theme="dark"] { /* dark tokens */ }
}

@layer components {
  .my-component { /* стили */ }
  [data-theme="dark"] .my-component { /* dark overrides */ }
}
```

> **ВСЕ стили внутри `@layer`.** Стили вне `@layer` получают другой приоритет каскада в Tailwind 4 → непредсказуемое поведение.

### 8.3 Токены: нет приватных

- ✅ Переопределение глобального: `.my-page { --bg-main: #FAFAF5; }`
- ❌ Приватный токен: `.my-page { --my-page-bg: #FAFAF5; }`

---

## 9. АНТИПАТТЕРНЫ

### 9.1 Визуальные

- ❌ **Emoji вместо SVG** — баги рендеринга, несоответствие стилю
- ❌ **font-size < 16px** для body text на мобилке — iOS зумит инпуты
- ❌ **`overflow` без `hidden`** в collapsed элементах — контент вылезает
- ❌ **`#FFFFFF` как фон страницы** — используй `#FAFAF5`
- ❌ **`#000000` как фон** — halation, OLED smearing
- ❌ **`#FFFFFF` как текст в dark** — halation
- ❌ **`filter: invert()`** для dark mode
- ❌ **Фиксированные ширины для текста** — русский на 20–30% длиннее
- ❌ **Фиксированные высоты для чат-баблов** — flex-контейнеры
- ❌ **`100vh`** — используй `100dvh`
- ❌ **Стили вне `@layer`** в Tailwind 4
- ❌ **Приватные CSS-переменные** (`--my-page-bg`) вместо глобальных

### 9.2 UX

- ❌ **Skeleton screens в чате** — нарушают диалоговую метафору
- ❌ **Confetti / celebration** — subtle glow вместо
- ❌ **Модалки в момент уязвимости** (попап «купи токены»)
- ❌ **Badge непрочитанных** на Scroll FAB — давление
- ❌ **Принудительный автоскролл** — если пользователь скроллит, отпустить
- ❌ **Красный для ошибок ввода** — используй `--text-muted`
- ❌ **Shake/highlight на инпуте** при ошибке (кроме голосового)
- ❌ **Горизонтальный скролл** для quick replies
- ❌ **Дизлайк-кнопка** — «Попробовать иначе» вместо
- ❌ **Bounce-анимация** для typing indicator — opacity pulse вместо
- ❌ **Текст «Записал как N из 5»** — никогда показывать числовую интерпретацию
- ❌ **История вопросов в тесте** — один вопрос на экране
- ❌ **Стрики, бейджи, лидерборды, XP**
- ❌ **Уведомления с давлением** («Ты пропустил 3 дня!»)

### 9.3 Accessibility

- ❌ **Контраст текста < 4.5:1** (WCAG AA)
- ❌ **Touch target < 44px** для primary actions
- ❌ **Нет `@media (prefers-reduced-motion: reduce)`** для анимаций
- ❌ **Нет `role="log"`** на зоне сообщений чата
- ❌ **Нет `aria-live="polite"`** на зоне сообщений
- ❌ **Нет `aria-busy="true"`** во время стриминга

---

## 10. ACCESSIBILITY QUICK REFERENCE

```html
<!-- Chat zone -->
<div role="log" aria-live="polite" aria-relevant="additions">
  <article role="article"><!-- каждое сообщение --></article>
</div>

<!-- Streaming message -->
<article aria-busy="true">...</article>  <!-- снять при завершении -->

<!-- Color scheme -->
:root { color-scheme: light; }
[data-theme="dark"] { color-scheme: dark; }
```

- APCA Lc 75+ для body chat text
- APCA Lc 60+ для UI labels
- APCA Lc 40+ для hint/placeholder
- WCAG AA 4.5:1 для текста (legal compliance)

---

## 11. ПЛАНИРУЕТСЯ

Компоненты из дизайн-системы, ещё не реализованные в коде:

- **Message Actions** — кнопки copy / like / retry на отдельных сообщениях (clipboard, thumbs-up, refresh icons, touch target 30×30px)
- **Voice Overlay** — отдельный полноэкранный оверлей записи (вне InputBar)
- **Recording Bar (полный UX)** — полная версия с waveform 32 полоски + rаndомные высоты анимация 0.8s (текущая реализация в InputBar — базовая)
