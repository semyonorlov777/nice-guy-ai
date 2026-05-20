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
if [ "$FOUND" -eq 0 ]; then
  echo "Clean ✅"
else
  echo "⚠️  Found hardcodes — see above"
  exit 1
fi
