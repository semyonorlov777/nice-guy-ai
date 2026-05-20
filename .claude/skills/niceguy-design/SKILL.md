---
name: niceguy-design
description: Дизайн-система Nice Guy AI — токены, темы (light/dark), компоненты, антипаттерны. Триггеры — любые UI-правки, упоминания темы, дизайна, CSS-переменных, токенов, цветов, контраста, тёмной/светлой темы, обложек, градиентов, кнопок, скриншоты UI, жалобы на мерцание/FOUC/конфликты тем.
---

# niceguy-design

Источник истины по дизайн-системе Nice Guy AI. Подключается автоматически по UI-триггерам и при правках `app/globals.css`, `components/**`, `app/**/*.tsx`.

## Что внутри

- `references/tokens.md` — токены (фоны, текст, акцент, статус, градиенты), правила архитектуры, **Theme Switching** (раздел про три зоны: App / Marketing / Funnel).

## Three theme zones (важно при любых UI-правках)

| Зона | Дефолт | Где живёт |
|------|--------|-----------|
| **App** | user-driven | `[data-theme="dark"]` на `<html>`, переключение через `useTheme()` из `lib/theme.ts` |
| **Marketing** | forced light | `.landing-v3` (главная, лендинги программ), `--auth-*` (auth-страницы и попап) |
| **Funnel** | forced dark | `.funnel-root` в `mini/funnel/funnel.css`, изоляция через `body:has` |

## Базовые инварианты

1. **Все цвета через `var(--*)`.** Хардкод хексов разрешён только в объявлениях токенов и в брендинговых цветах OAuth-провайдеров. Проверяется `scripts/check-hardcodes.sh`.
2. **`color: var(--accent-on)`** — единственный правильный текст на `background: var(--accent)`. Не пиши `color: #fff`.
3. **Градиенты обложек/орбов** — через `var(--accent-grad-hi/mid/lo)`, не через зашитые `#F0D68A`/`#8B6914`/`#a88a3a`/`#B8860B`.
4. **Переключение темы** — только через `useTheme()` из `lib/theme.ts`. Не вызывай `document.documentElement.setAttribute("data-theme", ...)` где-либо ещё.
5. **`public/theme-init.js`** (anti-FOUC inline) и `lib/theme.ts` обязаны давать идентичный DOM state. Меняешь одно — меняй второе.
6. **Forced-light зоны** (`.landing-v3`, `.auth-sheet-*`) намеренно НЕ следуют `[data-theme="dark"]`. Это маркетинговое решение. Не «чини» это.

## Антипаттерны (как ловится)

- `background: var(--accent); color: #fff` вне `.landing-v3` / `.auth-sheet-*` → грейлист в `scripts/check-hardcodes.sh` через snapshot-счётчик.
- `radial-gradient(... #F0D68A ...)` вне объявлений токенов → grep-чек в `scripts/check-hardcodes.sh`.
- Установка `data-theme` на `<body>` или `<div>` (вместо `<html>` или изолированной зоны) → визуально проявляется как рассинхрон `color-scheme` (светлый scrollbar на тёмном контенте).
- Дублирование логики `applyTheme(mode)` в новых компонентах → используй `useTheme()` хук из `lib/theme.ts`.

## SVG `stopColor` — известное ограничение

`<stop stop-color="...">` в SVG не резолвит CSS-переменные в большинстве браузеров. `components/test-results/RadarChart.tsx` использует inline hex — не пытайся это «починить» через `var(--*)`, заведи `style={{ stopColor: ... }}` через `useTheme()` если нужна тёмная тема для радар-диаграммы.

## Чеклист перед коммитом UI-правки

Перед коммитом любой правки, которая трогает `app/globals.css`, `app/**/*.tsx`, `components/**/*.tsx`, `mini/funnel/funnel.css`:

- [ ] **Цвета через токены.** Нет `style={{ color: '#...' }}` и нет новых хардкод-хексов в CSS-селекторах. Если нужен новый цвет — добавь токен в `:root` + `[data-theme="dark"]`.
- [ ] **Текст на `background: var(--accent)`** — через `color: var(--accent-on)`. Не `#fff`.
- [ ] **Градиенты** — через `var(--accent-grad-{hi,mid,lo})`. Не зашитые `#F0D68A` и т.п.
- [ ] **Переключение темы** — через `useTheme()` из `lib/theme.ts`. Нет прямых вызовов `documentElement.setAttribute('data-theme', ...)`.
- [ ] **Если правил `lib/theme.ts`** — синхронно обнови `public/theme-init.js` (anti-FOUC inline). Они обязаны давать идентичный DOM-state.
- [ ] **`npm run check`** проходит. Если намеренно добавил легитимное `color: #fff` (на `var(--danger)`/OAuth-бренде) — обнови `ALLOWED_WHITE_COUNT` в `scripts/check-hardcodes.sh` в том же коммите.
- [ ] **Визуально проверил обе темы** (через ProfileMenu → переключатель темы или `localStorage.theme='dark'/'light'` в DevTools):
  - App-страницы (`/program/.../balance`, чат, портрет, профиль) меняются.
  - Лендинги (`/`, `/program/[slug]`) остаются светлыми.
  - `/auth` остаётся светлым.
  - `/funnel` остаётся тёмным.
- [ ] **Если правил `tokens.md` или ввёл новое правило** — синхронно обнови SKILL.md (этот файл) и, если нужно, добавь чек в `scripts/check-hardcodes.sh`.

## Когда обновлять этот скилл

- Добавил новую CSS-переменную → строка в `tokens.md`.
- Добавил новую forced-* зону → раздел Theme Switching в `tokens.md` + правило здесь.
- Поменял правило в `lib/theme.ts` → синхронно правь `public/theme-init.js` и инвариант здесь.
- Нашёл новый антипаттерн → правило в антипаттернах + чек в `scripts/check-hardcodes.sh` + строка в чеклисте выше.
