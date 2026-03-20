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
if [ "$FOUND" -eq 0 ]; then
  echo "Clean ✅"
else
  echo "⚠️  Found hardcodes — see above"
  exit 1
fi
