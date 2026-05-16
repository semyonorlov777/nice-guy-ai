#!/bin/bash
# Check for common hardcode violations in the codebase.
# Run: npm run check

FOUND=0

echo "=== Checking for hardcoded slugs ==="
SLUG_HITS=$(grep -rn '"nice-guy"' --include='*.ts' --include='*.tsx' . \
  | grep -v 'node_modules' \
  | grep -v '.claude/worktrees' \
  | grep -v 'lib/constants.ts' \
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
echo "=== Checking for stale brand strings in landing/seed (see docs/brand-glossary.md) ==="

# Любое «AI-тренажёр» в любом падеже — в seed-SQL и компонентах фронтенда.
AI_TRAINER_HITS=$(grep -rnE 'AI-тренажёр[аыуомеовамиях]*' \
  scripts/seed-*.sql \
  lib/platform-landing.ts \
  components/landing/ \
  app/ 2>/dev/null \
  | grep -v 'node_modules' \
  | grep -v '.next/')

if [ -n "$AI_TRAINER_HITS" ]; then
  echo "$AI_TRAINER_HITS"
  echo "  ↳ Замени AI-тренажёр (любые падежи) на «Книжный Спарринг»"
  FOUND=1
fi

# Любые AI-<существительное> кроме служебных комментариев и SDK-имён.
AI_PREFIX_HITS=$(grep -rnE 'AI-[А-Яа-яё]+' \
  scripts/seed-*.sql \
  lib/platform-landing.ts \
  components/landing/ \
  app/legal/ \
  app/program/ 2>/dev/null \
  | grep -v 'node_modules' \
  | grep -v '.next/' \
  | grep -v '^[^:]*:[^:]*://' \
  | grep -vE '^\s*//' \
  | grep -vE '^\s*/\*' \
  | grep -vE '^\s*\*')

if [ -n "$AI_PREFIX_HITS" ]; then
  echo "$AI_PREFIX_HITS"
  echo "  ↳ Замени AI- (с кириллическим существительным) на ИИ-"
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
  scripts/seed-*.sql \
  lib/platform-landing.ts \
  components/landing/ \
  app/ 2>/dev/null \
  | grep -v 'node_modules' \
  | grep -v '.next/')

if [ -n "$OLD_BRAND_HITS" ]; then
  echo "$OLD_BRAND_HITS"
  echo "  ↳ Замени \"Nice Guy AI\" на \"Книжный Спарринг\""
  FOUND=1
fi

if [ -z "$AI_TRAINER_HITS" ] && [ -z "$AI_PREFIX_HITS" ] && [ -z "$BRAND_ROLE_HITS" ] && [ -z "$OLD_BRAND_HITS" ]; then
  echo "  No stale brand strings found"
fi

echo ""
if [ "$FOUND" -eq 0 ]; then
  echo "Clean ✅"
else
  echo "⚠️  Found hardcodes — see above"
  exit 1
fi
