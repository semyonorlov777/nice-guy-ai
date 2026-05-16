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

# Ярлык бренда «AI-тренажёр» / «AI-ассистент» в карточке сравнения landing_data.
# Ловим оба формата: JSON ("name": "...") и JS/TS (name: "...").
BRAND_NAME_HITS=$(grep -rnE '"?name"?\s*:\s*"(AI-тренажёр|AI-ассистент)"' \
  scripts/seed-*.sql \
  lib/platform-landing.ts \
  components/landing/ 2>/dev/null \
  | grep -v 'node_modules' \
  | grep -v '.next/')

if [ -n "$BRAND_NAME_HITS" ]; then
  echo "$BRAND_NAME_HITS"
  echo "  ↳ Замени \"name\": \"AI-тренажёр|AI-ассистент\" на \"name\": \"Книжный Спарринг\""
  FOUND=1
fi

# Роль «Ежедневная практика» — устарела. Ловим JSON и JS/TS форматы.
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

# hero_tag — устаревшая фраза. Ловим JSON и JS/TS форматы.
HERO_TAG_HITS=$(grep -rnE '"?hero_tag"?\s*:\s*"AI-тренажёр' \
  scripts/seed-*.sql \
  lib/platform-landing.ts 2>/dev/null \
  | grep -v 'node_modules' \
  | grep -v '.next/')

if [ -n "$HERO_TAG_HITS" ]; then
  echo "$HERO_TAG_HITS"
  echo "  ↳ Замени \"hero_tag\": \"AI-тренажёр по книге\" на \"hero_tag\": \"Книжный Спарринг\""
  FOUND=1
fi

if [ -z "$BRAND_NAME_HITS" ] && [ -z "$BRAND_ROLE_HITS" ] && [ -z "$HERO_TAG_HITS" ]; then
  echo "  No stale brand strings found"
fi

echo ""
if [ "$FOUND" -eq 0 ]; then
  echo "Clean ✅"
else
  echo "⚠️  Found hardcodes — see above"
  exit 1
fi
