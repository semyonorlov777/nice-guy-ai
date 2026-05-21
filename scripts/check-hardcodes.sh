#!/bin/bash
# Check for common hardcode violations in the codebase.
# Run: npm run check

FOUND=0

echo "=== Checking for hardcoded slugs ==="
SLUG_HITS=$(grep -rn '"nice-guy"' --include='*.ts' --include='*.tsx' . \
  | grep -v 'node_modules' \
  | grep -v '.claude/worktrees' \
  | grep -v 'lib/constants.ts' \
  | grep -v 'lib/anketa/' \
  | grep -v 'scripts/' \
  | grep -v '.next/')

if [ -n "$SLUG_HITS" ]; then
  echo "$SLUG_HITS"
  FOUND=1
else
  echo "  No hardcoded slugs found"
fi

echo ""
echo "=== Checking for hardcoded app URL ==="
URL_HITS=$(grep -rn 'nice-guy-ai\.vercel\.app' --include='*.ts' --include='*.tsx' . \
  | grep -v 'node_modules' \
  | grep -v '.claude/worktrees' \
  | grep -v 'lib/constants.ts' \
  | grep -v 'scripts/' \
  | grep -v '.next/')

if [ -n "$URL_HITS" ]; then
  echo "$URL_HITS"
  FOUND=1
else
  echo "  No hardcoded URLs found"
fi

echo ""
echo "=== Checking for direct supabase.from() in components ==="
SUPA_HITS=$(grep -rn 'supabase\.from(' --include='*.ts' --include='*.tsx' components/ 2>/dev/null)

if [ -n "$SUPA_HITS" ]; then
  echo "$SUPA_HITS"
  FOUND=1
else
  echo "  No direct supabase calls in components"
fi

echo ""
echo "=== Checking for stale brand strings (see docs/brand-glossary.md) ==="

# Папки и файлы, которые проверяем
SCAN_PATHS="scripts/seed-*.sql lib/platform-landing.ts components/landing/ app/page.tsx app/layout.tsx app/legal/ app/tests/ app/program/"

# Любое «AI-тренажёр» и «Книжный Спарринг по»/«Книжный Спарринг —» в видимых текстах.
# Ярлык карточки сравнения (`"name": "Книжный Спарринг"`) НЕ ловится — там после слова кавычка.
BRAND_AS_FORMAT_HITS=$(grep -rnE 'AI-тренажёр[аыуомеовамиях]*|Книжный Спарринг (по|—|,|\.|\()' \
  $SCAN_PATHS 2>/dev/null \
  | grep -v 'node_modules' \
  | grep -v '.next/' \
  | grep -v 'brand-glossary' \
  | grep -v 'docs/runbooks' \
  | grep -v 'docs/adr')

if [ -n "$BRAND_AS_FORMAT_HITS" ]; then
  echo "$BRAND_AS_FORMAT_HITS"
  echo "  ↳ Замени на «Онлайн-тренажёр по книге [Название]»"
  FOUND=1
fi

# Любые «ИИ-<существительное>» и «AI-<существительное>» в видимых текстах.
AI_PREFIX_HITS=$(grep -rnE '(AI|ИИ)-[А-Яа-яёЁ]+' \
  $SCAN_PATHS 2>/dev/null \
  | grep -v 'node_modules' \
  | grep -v '.next/' \
  | grep -vE '^\s*//' \
  | grep -vE '^\s*/\*' \
  | grep -vE '^\s*\*')

if [ -n "$AI_PREFIX_HITS" ]; then
  echo "$AI_PREFIX_HITS"
  echo "  ↳ Замени на «Система» (просто, без дефиса и дополнений)"
  FOUND=1
fi

# Одиночное слово «ИИ» в видимых текстах для пользователя.
# Не ловим в комментариях кода и в namespace-именах (AI SDK, AI Gateway).
SOLO_AI_HITS=$(grep -rnE '(^|[^A-Za-zА-Яа-я])ИИ([^A-Za-zА-Яа-я]|$)' \
  $SCAN_PATHS 2>/dev/null \
  | grep -v 'node_modules' \
  | grep -v '.next/' \
  | grep -vE '^\s*//' \
  | grep -vE '^\s*/\*')

if [ -n "$SOLO_AI_HITS" ]; then
  echo "$SOLO_AI_HITS"
  echo "  ↳ Замени одиночное «ИИ» на «Система»"
  FOUND=1
fi

# Роль «Ежедневная практика» — устарела.
BRAND_ROLE_HITS=$(grep -rnE '"?role"?\s*:\s*"Ежедневная практика"' \
  scripts/seed-*.sql \
  lib/platform-landing.ts \
  components/landing/ 2>/dev/null \
  | grep -v 'node_modules' \
  | grep -v '.next/')

if [ -n "$BRAND_ROLE_HITS" ]; then
  echo "$BRAND_ROLE_HITS"
  echo "  ↳ Замени \"role\": \"Ежедневная практика\" на \"role\": \"Практика\""
  FOUND=1
fi

# «Nice Guy AI» — старый бренд.
OLD_BRAND_HITS=$(grep -rn 'Nice Guy AI' \
  $SCAN_PATHS 2>/dev/null \
  | grep -v 'node_modules' \
  | grep -v '.next/')

if [ -n "$OLD_BRAND_HITS" ]; then
  echo "$OLD_BRAND_HITS"
  echo "  ↳ Замени «Nice Guy AI» на «Книжный Спарринг» или на «Онлайн-тренажёр»"
  FOUND=1
fi

if [ -z "$BRAND_AS_FORMAT_HITS" ] && [ -z "$AI_PREFIX_HITS" ] && [ -z "$SOLO_AI_HITS" ] && [ -z "$BRAND_ROLE_HITS" ] && [ -z "$OLD_BRAND_HITS" ]; then
  echo "  No stale brand strings found"
fi

echo ""
echo "=== Checking for hardcoded theme colors in CSS ==="
# Допускается hex только внутри объявлений токенов (--*: #...;) и
# определённых allowlisted блоков (.landing-v3 = forced light marketing,
# .auth-sheet-* = forced light auth, .funnel-root = forced dark funnel).
# В остальных местах все цвета — через CSS-переменные.

# 1. Запретить hardcoded хексы в gradient stops (radial/linear) вне объявлений токенов.
GRAD_HEX_HITS=$(grep -nE '(radial-gradient|linear-gradient)\([^)]*#[0-9a-fA-F]{3,6}' app/globals.css 2>/dev/null \
  | grep -vE ':\s+--[a-zA-Z-]+:' \
  | grep -vE '\.landing-v3|\.auth-sheet|\.funnel-')

if [ -n "$GRAD_HEX_HITS" ]; then
  echo "$GRAD_HEX_HITS"
  echo "  ↳ Используй var(--accent-grad-hi/mid/lo) или var(--accent-hover) вместо hardcoded hex"
  FOUND=1
fi

# 2. Snapshot-чек: число `color: #fff|white|#ffffff` в globals.css не должно расти.
# Текущее значение — 24 (все в forced-light зонах: .landing-v3, .auth-sheet-*,
# на var(--danger)/var(--success): .ib-action-btn states, .tc-error-toast,
# на брендинговых цветах OAuth, или поверх жёлтых градиентов обложек).
# Любые новые `background: var(--accent); color: #fff;` в app-зоне ловятся ростом счётчика.
CURRENT_WHITE_COUNT=$(grep -cE 'color:\s*(#fff|#ffffff|white)\b' app/globals.css 2>/dev/null)
ALLOWED_WHITE_COUNT=24
if [ "$CURRENT_WHITE_COUNT" -gt "$ALLOWED_WHITE_COUNT" ]; then
  echo "  ✗ color: #fff count = $CURRENT_WHITE_COUNT, allowed ≤ $ALLOWED_WHITE_COUNT"
  echo "  ↳ Если фон = var(--accent), используй color: var(--accent-on)."
  echo "  ↳ Если новое использование легитимно (на var(--danger), бренд OAuth, и т.д.),"
  echo "     обнови ALLOWED_WHITE_COUNT в scripts/check-hardcodes.sh."
  FOUND=1
fi

if [ -z "$GRAD_HEX_HITS" ] && [ "$CURRENT_WHITE_COUNT" -le "$ALLOWED_WHITE_COUNT" ]; then
  echo "  No hardcoded theme colors found"
fi

echo ""
echo "=== Checking for hardcoded z-index in CSS ==="
# Snapshot-чек: число `z-index: <digit>` (числовой литерал) не должно расти.
# Все НОВЫЕ z-index должны идти через var(--z-base/sticky/overlay/dropdown/sheet/modal/toast).
# Текущее значение — 13 (локальные слои внутри chat-кластера: scrim/header/panel/input,
# tooltip в sidebar, низкие 1/2/10 у псевдоэлементов).
CURRENT_ZINDEX_COUNT=$(grep -cE 'z-index:\s*[0-9]+' app/globals.css 2>/dev/null)
ALLOWED_ZINDEX_COUNT=13
if [ "$CURRENT_ZINDEX_COUNT" -gt "$ALLOWED_ZINDEX_COUNT" ]; then
  echo "  ✗ z-index hardcode count = $CURRENT_ZINDEX_COUNT, allowed ≤ $ALLOWED_ZINDEX_COUNT"
  echo "  ↳ Используй var(--z-base/sticky/overlay/dropdown/sheet/modal/toast) вместо числа."
  echo "  ↳ Если новое использование легитимно (локальный слой внутри кластера),"
  echo "     обнови ALLOWED_ZINDEX_COUNT в scripts/check-hardcodes.sh."
  FOUND=1
else
  echo "  z-index OK (≤ $ALLOWED_ZINDEX_COUNT)"
fi

echo ""
echo "=== Checking for hardcoded transition timings in CSS ==="
# Snapshot-чек: число `transition: ... 0.15s|0.2s|0.3s` не должно расти.
# Все НОВЫЕ transitions должны идти через var(--transition-fast/normal/slow).
# Текущее значение — 80 (legacy transitions без var(--ease), оставлены как есть,
# т.к. default browser easing визуально неотличим от --ease).
CURRENT_TRANS_COUNT=$(grep -cE 'transition:[^;]*\b0\.(15|2|3)s\b' app/globals.css 2>/dev/null)
ALLOWED_TRANS_COUNT=80
if [ "$CURRENT_TRANS_COUNT" -gt "$ALLOWED_TRANS_COUNT" ]; then
  echo "  ✗ transition hardcode count = $CURRENT_TRANS_COUNT, allowed ≤ $ALLOWED_TRANS_COUNT"
  echo "  ↳ Используй var(--transition-fast/normal/slow) вместо 0.15s/0.2s/0.3s."
  echo "  ↳ Если новое использование легитимно (нестандартный easing/duration),"
  echo "     обнови ALLOWED_TRANS_COUNT в scripts/check-hardcodes.sh."
  FOUND=1
else
  echo "  transitions OK (≤ $ALLOWED_TRANS_COUNT)"
fi

echo ""
echo "=== Checking for legacy 100vh in chat CSS ==="
# После перехода на контейнерный скролл (PR scroll-refactor 2026-05) все
# высоты на странице чата используют 100dvh. 100vh ломает layout на iOS Safari
# с виртуальной клавиатурой и сворачивающейся address bar.
VH_HITS=$(grep -nE '\b100vh\b' app/globals.css 2>/dev/null)
if [ -n "$VH_HITS" ]; then
  echo "$VH_HITS"
  echo "  ↳ Используй 100dvh (Baseline 2025) вместо 100vh."
  FOUND=1
else
  echo "  No 100vh in globals.css"
fi

echo ""
echo "=== Checking for manual scrollTop assignment in chat code ==="
# Использовать useStickToBottom (use-stick-to-bottom) вместо ручного
# el.scrollTop = el.scrollHeight. См. components/ChatWindow.tsx как образец.
SCROLL_HITS=$(grep -rnE '\.scrollTop\s*=\s*[^;]*scrollHeight' \
  --include='*.ts' --include='*.tsx' \
  components/ hooks/ app/ 2>/dev/null \
  | grep -v 'node_modules' \
  | grep -v '.next/')
if [ -n "$SCROLL_HITS" ]; then
  echo "$SCROLL_HITS"
  echo "  ↳ Используй useStickToBottom из use-stick-to-bottom вместо ручного scrollTop."
  FOUND=1
else
  echo "  No manual scrollTop assignments"
fi

echo ""
if [ "$FOUND" -eq 0 ]; then
  echo "Clean ✅"
else
  echo "⚠️  Found hardcodes — see above"
  exit 1
fi
