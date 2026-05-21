# Design Tokens — Complete Reference

> **Source of truth: `app/globals.css`.** Values below are from code. Where design spec proposes different values, noted with `← design:`.

## Table of Contents
1. [Backgrounds](#backgrounds)
2. [Text](#text)
3. [Accent (Amber)](#accent)
4. [Status Colors](#status-colors)
5. [Borders](#borders)
6. [Shadows & Focus](#shadows)
7. [Chat Message Tokens](#chat-messages)
8. [Radii](#radii)
9. [Layout Tokens](#layout)
10. [Z-Index Scale](#z-index)
11. [Transition Tokens](#transitions)
12. [Auth Theme](#auth-theme)
13. [Test Results Theme](#test-results-theme)
14. [Typography Scale](#typography)
15. [Spacing](#spacing)
16. [Per-Book Theming](#per-book)
17. [Forbidden Colors](#forbidden)
18. [Token Architecture Rules](#rules)

---

## Backgrounds {#backgrounds}

Layered system: higher element = lighter in dark mode.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--bg-main` | `#FAFAF5` | `#111318` | Page background |
| `--bg-card` | `#FFFFFF` | `#1C1F26` | Cards, modals, AI bubbles |
| `--bg-elevated` | `#F5F3EE` | `#22262D` | Buttons, hover, raised elements |
| `--bg-input` | `#FFFFFF` | `#1C1F26` | Input fields — MUST be lighter than bg-card in dark |
| `--bg-chat-zone` | `#FAFAF5` | `#111318` | Chat area |
| `--bg-sidebar` | `#FFFFFF` | `#14161a` | Sidebar |
| `--error-bg` | `#FFF9F0` | `rgba(212,165,69, 0.06)` | Error cards (warm, NOT red) |

**ISSP test** overrides:
- `--bg-main`: `#FAFAF5` (light, warmer) / `#111318` (dark, slightly lighter than global)
- `--accent`: `#C9963B` (light, brighter) / `#c9a84c` (dark)

**FORBIDDEN:** `#FFFFFF` as page background, `#000000` as background. Use off-white / deep grey.

---

## Text {#text}

| Token | Light | Dark | Role |
|---|---|---|---|
| `--text-primary` | `#1A1917` | `#E8E6E1` | Primary text, headings |
| `--text-secondary` | `#6B6860` | `#9A978F` | Captions, secondary info |
| `--text-muted` | `#9E9B93` | `#5F5D57` | Inactive elements, placeholders |
| `--text-hint` | `#B5B2AA` | `#4A4843` | Dimmest text, hints. `← design: dark #6b6860 for APCA Lc 45+` |

**FORBIDDEN in dark:** `#FFFFFF` as text (halation — letters "glow"). Use `#E8E6E1`.

**Dark mode rule:** font-weight bump +1 step for small labels (12–13px) — light text on dark appears thinner.

---

## Accent (Amber — per-book, Nice Guy default) {#accent}

| Token | Light | Dark | Role |
|---|---|---|---|
| `--accent` | `#C9963B` | `#D4A545` | Primary accent. `← design: dark #D4A545 vs code #c9a84c` |
| `--accent-dark` | `#8A6B24` | `#A07A2E` | Gradient endpoint, darker variant |
| `--accent-hover` | `#a8832e` | `#d4b35a` | Hover state |
| `--accent-soft` | `rgba(201,150,59, 0.08)` | `rgba(212,165,69, 0.10)` | Soft bg (badges, active items, quick replies) |
| `--accent-border` | `rgba(201,150,59, 0.25)` | `rgba(212,165,69, 0.22)` | Accent borders |
| `--accent-glow` | `rgba(201,150,59, 0.12)` | `rgba(212,165,69, 0.15)` | Glow (cover shadow, pulse) |
| `--accent-medium` | `rgba(201,150,59, 0.15)` | `rgba(212,165,69, 0.18)` | Intermediate transparency |
| `--accent-on` | `#FFFFFF` | `#1A1917` | Text ON accent button (inverted!) |
| `--accent-grad-hi` | `#F0D68A` | `#E6C57A` | Light stop of radial gradients (book covers, orbs, sidebar logo) |
| `--accent-grad-mid` | `#a88a3a` | `#A07A2E` | Mid stop of linear gradients (logo icons, hub-header-book) |
| `--accent-grad-lo` | `#8B6914` | `#5C4A18` | Dark stop of radial gradients |

> **`--accent-on`** is the canonical text color on any element with `background: var(--accent)`. Light = `#FFFFFF`, dark = `#1A1917` — handles contrast in both themes automatically. Don't write `color: #fff` on accent buttons.
>
> **`--accent-grad-*`** replace hardcoded gradient stops (formerly `#F0D68A`/`#8B6914`/`#a88a3a`/`#B8860B`). Use them in `radial-gradient(...)` and `linear-gradient(...)` so covers/orbs adapt to dark mode.
>
> Forced-light zones (`.landing-v3`, `.auth-sheet-*`) retain `color: #fff` on accent buttons — that's correct because their `--accent` is always the light value.

---

## Status Colors {#status-colors}

| Token | Light | Dark |
|---|---|---|
| `--green` / `--success` | `#4A7A4A` | `#6AAE6A` |
| `--green-soft` / `--success-soft` | `rgba(74,122,74, 0.08)` | `rgba(106,174,106, 0.10)` |
| `--green-border` | `rgba(74,122,74, 0.25)` | `rgba(106,174,106, 0.25)` |
| `--danger` | `#C94C4C` | `#D46B6B` |
| `--danger-text` | `#B85C5C` | `#C07070` |
| `--danger-soft` | `rgba(201,76,76, 0.08)` | `rgba(220,80,80, 0.10)` |
| `--danger-border` | `rgba(201,76,76, 0.25)` | `rgba(220,80,80, 0.25)` |
| `--status-done` | `#5a8c5a` | `#6aae6a` |
| `--status-done-bg` | `rgba(90,140,90, 0.10)` | `rgba(106,174,106, 0.12)` |
| `--status-active-bg` | `rgba(201,150,59, 0.12)` | `rgba(212,165,69, 0.12)` |

### Color Roles
| Role | Token | Examples |
|---|---|---|
| **Accent (gold/amber)** | `--accent` | CTA buttons, progress, active elements, markdown headings, border-left quotes, streaming cursor, AI avatar gradient, balance badge, focus ring |
| **Green/Success** | `--green` | Sent state button (✓), "done" status, exercise completion |
| **Danger** | `--danger` | Recording state button, blinking rec dot. **NOT for errors** — errors use accent/muted |
| **Neutral** | `--text-muted`, `--text-hint` | Input errors (type B), inactive elements, placeholders |

---

## Borders {#borders}

| Token | Light | Dark |
|---|---|---|
| `--border` | `#E8E5DE` | `#2A2D33` |
| `--border-light` | `#EFEDE7` | `#232629` |

---

## Shadows & Focus {#shadows}

| Token | Light | Dark |
|---|---|---|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.04)` | `0 1px 3px rgba(0,0,0,0.2)` |
| `--shadow-focus` | `0 0 0 3px rgba(201,150,59,0.2)` | `0 0 0 3px rgba(212,165,69,0.15)` |
| `--scrim` | `rgba(26,25,23, 0.3)` | `rgba(0,0,0, 0.5)` |

**Dark mode:** shadows are invisible (merge with background). Use borders instead:
```css
[data-theme="dark"] .my-component {
  box-shadow: none;
  border: 1px solid var(--border);
}
```

### Additional shadows used in code
```css
/* Card shadow (light) */
box-shadow: 0 2px 8px rgba(0,0,0,0.06);

/* Accent glow */
box-shadow: 0 0 30px var(--accent-glow);

/* Quick reply lift */
box-shadow: 0 1px 2px rgba(0,0,0,0.04);

/* Input floating */
box-shadow: 0 1px 4px rgba(0,0,0,0.04);
```

---

## Chat Message Tokens {#chat-messages}

| Token | Light | Dark |
|---|---|---|
| `--msg-ai-bg` | `#FFFFFF` | `#1C1F26` |
| `--msg-ai-border` | `#E8E5DE` | `#2A2D33` |
| `--msg-user-bg` | `#F5F0E2` (warm amber-tinted) | `rgba(212,165,69, 0.08)` |
| `--msg-user-border` | `#E8DFC8` | `rgba(212,165,69, 0.15)` |

---

## Radii {#radii}

| Token | Value | Usage |
|---|---|---|
| `--radius` | `16px` | Main radius. `← design: 10px per-book Nice Guy` |
| `--radius-sm` | `12px` | Cards, small elements. `← design: 8px` |
| `--radius-xs` | `8px` | Code blocks, small chips. `← design: 4px` |
| `--radius-pill` | `100px` | Quick reply buttons, pills. `← design: 24px` |

> Radius is a semantic token — changes per-book.

---

## Layout Tokens {#layout}

| Token | Value | Usage |
|---|---|---|
| `--header-h` | `56px` | Header height |
| `--tabs-h` | `52px` | Bottom tabs height |
| `--sidebar-w` | `280px` | Sidebar width (desktop) |
| `--sidebar-collapsed-w` | `64px` | Collapsed sidebar |
| `--content-w` | `720px` | Max-width content zone |
| `--chat-w` | `640px` | Max-width chat/test/exercises |

---

## Z-Index Scale {#z-index}

| Token | Value | Usage |
|---|---|---|
| `--z-base` | `1` | Псевдоэлементы поверх своего контекста (`::before`, `::after`) |
| `--z-sticky` | `50` | Sticky overlays внутри страницы (`.tc-auth-overlay`, `.tc-auth-soft-prompt`) |
| `--z-overlay` | `100` | Fixed-элементы поверх контента: mobile-tabs, sticky header вне sidebar |
| `--z-dropdown` | `200` | Dropdowns: profile-dropdown, book-switcher-dropdown |
| `--z-sheet` | `500` | Bottom-sheet content (если есть; auth-sheet использует modal-уровень) |
| `--z-modal` | `1000` | Модальные диалоги, scrim'ы модалок, top-level toasts: balance-toast, auth-sheet-scrim |
| `--z-toast` | `1100` | Error toasts поверх модалок (`.tc-error-toast`) |

> AuthSheet content использует `calc(var(--z-modal) + 1)` чтобы перекрыть свой scrim. Локальные слои внутри одного фичи (например, scrim/header/panel в чате — 15/20/25) могут использовать сырые числа, потому что между ними важна точная относительная разница.

---

## Transition Tokens {#transitions}

| Token | Value | Usage |
|---|---|---|
| `--transition-fast` | `0.15s var(--ease)` | Hover-эффекты, focus state, opacity toggle |
| `--transition-normal` | `0.2s var(--ease)` | Дефолтная плавность для UI: background, border-color, transform |
| `--transition-slow` | `0.3s var(--ease)` | Сложные изменения: layout, opacity для крупных блоков |

> Easing — единый `var(--ease) = cubic-bezier(0.25, 0.1, 0.25, 1.0)`. Для нестандартных длительностей (250ms, 400ms) и нестандартных easings (Material `cubic-bezier(0.4, 0, 0.2, 1)`, `ease-out` для toast) — оставляй прямые значения, токены не натягивай.

---

## Auth Theme (AuthSheet) {#auth-theme}

Separate light theme for auth component. Prefix `--auth-*`.

| Token | Value |
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

---

## Test Results Theme (.test-results-page) {#test-results-theme}

Uses global tokens — no private `--tr-*` overrides. Works in both light and dark themes.

CSS classes use `.tr-*` prefix (e.g. `.tr-hero`, `.tr-radar-wrapper`, `.tr-scale-card`).

**Exception:** RadarChart SVG gradient `<stop stopColor>` uses hardcoded rgba values aligned with `--green`, `--accent`, `--danger` because SVG `stopColor` attribute doesn't support CSS custom properties or `color-mix()`.

---

## Typography Scale {#typography}

### Fonts
```css
--font-display: 'Cormorant Garamond', Georgia, serif   /* headings, book quotes */
--font-body:    'Onest', -apple-system, sans-serif      /* text, UI, chat */
```
Loading: `next/font/google`.

### Sizes & Weights

| Role | Size | Font | Weight |
|---|---|---|---|
| Screen heading (h1) | `clamp(24px, 4vw, 38px)` | Cormorant Garamond | 600 |
| Chapter heading (h2) | 20–24px | Cormorant Garamond | 600 |
| Exercise heading (h3) | 16–18px | Cormorant Garamond | 500 |
| Test question | `clamp(21px, 3.5vw, 26px)` | Cormorant Garamond | 500 |
| Welcome card title | 22px | Cormorant Garamond | 600 |
| Chat body text | min 16px | Onest | 400 |
| UI (buttons, labels) | 14–15px | Onest | 500–600 |
| Quick reply text | 14px | Onest | 500 |
| Metadata (time, author) | 13px | Onest | 400 |
| Small text, hints | 12px | Onest | 400 |
| Scale labels (uppercase) | 11px | Onest | 500, `letter-spacing: 1.2px` |
| Privacy label under input | 11px | Onest | 400 |

### Line-height
- Chat body text: **1.45–1.5** (for long AI responses)
- UI: **1.4**
- Descriptions: **1.6**

### Rules
- Russian text is 20–30% longer than English → flex containers, no fixed widths
- CSS `clamp()` for fluid typography
- `rem` with `clamp()`, never `px` for text (Dynamic Type support)
- Dark mode: font-weight +1 step for 12–13px labels — light text appears thinner
- `font-size < 16px` on mobile body text → iOS auto-zooms inputs, avoid

---

## Spacing {#spacing}

### Spacing tokens

| Token | Value | Typical usage |
|---|---|---|
| `--space-2xs` | `4px` | gap между мелкими inline-элементами, тонкие margin-top для микро-разделения |
| `--space-xs` | `8px` | gap в строках кнопок, padding мелких чипов, отступы внутри icon-button |
| `--space-sm` | `12px` | gap в плотных списках (sidebar items, list rows), padding кнопок |
| `--space-md` | `16px` | дефолтный отступ карточки/секции, padding контента на мобилке |
| `--space-lg` | `20px` | расширенный отступ карточки, padding hub-секций |
| `--space-xl` | `24px` | padding контента на десктопе, padding больших карточек |
| `--space-2xl` | `32px` | gap между крупными блоками лендинга, padding верхнего хедера экрана |
| `--space-3xl` | `48px` | вертикальный gap между секциями лендинга, отступы heading'ов |

> Применяется к `padding`/`margin`/`gap`. НЕ применять к `border-width`, `width/height` иконок, точечным позиционным смещениям (`top: 1px`), `letter-spacing`. Multi-value shorthand типа `padding: var(--space-md) var(--space-xl)` поддерживается.

### Padding Philosophy
"Resonant Stark Effect" — minimalism with emotional depth. "Air" is an active element, not emptiness.

| Context | Padding |
|---|---|
| Chat bubble inner | 14px 18px |
| Between messages (gap) | 14px |
| Content area sides | 16px mobile, 24px desktop |
| Quick reply buttons | 12px 20px |
| Cards | 16px–24px |

### Viewport & Safe Area
```css
height: 100dvh;       /* NOT 100vh */
overscroll-behavior-y: contain;  /* disable pull-to-refresh */
padding-bottom: env(safe-area-inset-bottom);
```

### Meta tags
```html
<meta name="theme-color" content="#FAFAF5" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#0b0c0e" media="(prefers-color-scheme: dark)" />
```

---

## Per-Book Theming {#per-book}

When entering a book, 15–25 semantic CSS variables change. UI code stays the same.

| Book Theme | Accent | Radius | Tone |
|---|---|---|---|
| Self-esteem / confidence (Nice Guy) | Amber `#C9963B` | 10px | Structured |
| Relationships / attachment | Rose `#C88A94` | 14px | Soft |
| Anxiety / stress | Blue `#7BAACC` | 12px | Airy |
| Depression / mood | Teal `#53A3A3` | 8px | Gentle progression |
| Mindfulness / meditation | Lavender `#B8A3CC` | 16px | Spacious |
| Productivity / habits | Blue `#3373BF` | 8px | Clear |
| Trauma / healing | Forest `#42856B` | 6px | Grounded |

Rule: minimum 15° separation on color wheel between books in the same cluster.

---

## Forbidden Colors {#forbidden}

- `#FFFFFF` as page background → use `#FAFAF5`
- `#000000` as background → use `#0b0c0e`–`#111318`
- `#FFFFFF` as text on dark → use `#E8E6E1`
- Purple — gender-divisive (22% of men hate it)
- Pink — gender-coded
- Bright orange / Bright yellow — danger/warning in Russian culture
- `filter: invert()` for dark mode

---

## Token Architecture Rules {#rules}

1. **Three levels:** primitive → semantic → component. Only semantic changes per book.
2. **No private tokens.** Override globals, don't create new.
3. **All colors via `var(--token-name)`**, never hex directly (except inside token-declaration blocks or forced-zone overrides — see Theme Switching below).
4. **`data-theme="dark"`** attribute on `<html>` for dark mode (NOT `<body>`).
5. **Manual theme switching** via `lib/theme.ts` (`useTheme` hook) + `public/theme-init.js` (anti-FOUC inline script). No `next-themes` library.
6. **Accent palette generation:** From a single hex using `@material/material-color-utilities`.
7. **Role-based naming:** `--accent`, `--surface-brand` — not `--primary`, `--secondary`.

---

## Theme Switching {#theme-switching}

**Three zones with different rules:**

| Zone | Default | Override mechanism |
|------|---------|-------------------|
| **App** (`/program/*`, `/balance`, `/profile`, chats) | User-driven (light/dark/system) | `[data-theme="dark"]` on `<html>` |
| **Marketing** (`/`, landings, `/auth`) | Forced light | `.landing-v3` class override + `--auth-*` token set |
| **Funnel** (`/funnel`, `mini/funnel/*`) | Forced dark | `.funnel-root` local token snapshot + `color-scheme: dark` |

**Invariants:**

- All programmatic theme changes go through `useTheme()` from `lib/theme.ts`. Do **not** call `document.documentElement.setAttribute("data-theme", ...)` directly anywhere else.
- `public/theme-init.js` and `lib/theme.ts` must produce identical DOM state (read same `localStorage.theme` key, set same `data-theme` attribute, same `(prefers-color-scheme: dark)` fallback). If you change one, change the other.
- Forced-light zones (`.landing-v3`, `--auth-*`) override CSS variables — they intentionally do NOT follow `[data-theme="dark"]`. This is a marketing decision; keep it.
- Forced-dark funnel uses CSS-only isolation (`.funnel-root` snapshot + `body:has(.funnel-root)` background + `color-scheme: dark`). No JS theme switching inside the funnel.

**Hardcode hex allowed only inside:**
- Token-declaration blocks: `:root { ... }`, `[data-theme="dark"] { ... }`, `.landing-v3 { ... }`, `.funnel-root { ... }`.
- Brand colors on OAuth providers (Telegram blue `#2AABEE`, Yandex red `#FC3F1D`, MAX blue `#1c3d7a`, Google `#dadce0`).
- Text on red/green status backgrounds (`var(--danger)` / `var(--success)`) — `color: white` is fine.
- Text on yellow gradient overlays (book cover titles).

Everywhere else: `var(--token-name)`. `scripts/check-hardcodes.sh` enforces this via grep + snapshot count of `color: #fff`.

**SVG `stopColor` limitation:** Most browsers don't resolve CSS variables in `<stop stop-color="...">`. RadarChart in `components/test-results/RadarChart.tsx` uses inline hex — known issue, out of scope for this audit.
