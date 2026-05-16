#!/usr/bin/env tsx
/**
 * Проверка качества фото авторов в public/authors/.
 *
 * Правило (после аудита seven-principles 2026-05): фото автора должно быть
 * ≥100 КБ. Wikipedia thumbnails ~30-50 КБ — запрещены: мутное, читается на
 * лендинге как «постер на стене», а не как фото эксперта.
 *
 * Запуск:
 *   npx tsx scripts/check-author-photos.ts          # warning-only (для CI)
 *   npx tsx scripts/check-author-photos.ts --strict # exit 1 если есть фото <100 КБ
 *   npm run check:author-photos                     # warning-only
 *
 * Exit code:
 *   0 — нет фото / все ≥100 КБ / есть малые но без --strict (warning)
 *   1 — есть фото <100 КБ И флаг --strict
 *   2 — каталог public/authors не читается
 *
 * Прецедент: seven-principles — первая итерация Готтмана с Wikipedia
 * thumbnail 38 КБ; пришлось переснимать.
 *
 * Дизайн: warning-only по умолчанию — чтобы CI на main не падал из-за
 * старых фото книг (bakirov 5 КБ, bern 6 КБ, ilyahov 23 КБ и т.п.).
 * Эти фото можно переснять отдельной задачей. --strict — для разработчика
 * новой книги: «не выпускаем книгу с маленьким фото».
 */
import { readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const AUTHORS_DIR = resolve(process.cwd(), "public", "authors");
const MIN_SIZE_BYTES = 100 * 1024; // 100 КБ

function main() {
  const strict = process.argv.includes("--strict");

  let files: string[];
  try {
    files = readdirSync(AUTHORS_DIR);
  } catch (err) {
    console.error(`❌ cannot read ${AUTHORS_DIR}:`, (err as Error).message);
    process.exit(2);
  }

  const photos = files.filter((f) => /\.(jpg|jpeg|webp|png)$/i.test(f));
  if (photos.length === 0) {
    console.log("✅ no author photos in public/authors/ — nothing to check");
    process.exit(0);
  }

  const tooSmall: Array<{ name: string; bytes: number }> = [];
  for (const f of photos) {
    const fullPath = join(AUTHORS_DIR, f);
    const size = statSync(fullPath).size;
    if (size < MIN_SIZE_BYTES) {
      tooSmall.push({ name: f, bytes: size });
    }
  }

  if (tooSmall.length === 0) {
    console.log(`✅ all ${photos.length} author photos pass ≥100 KB check`);
    process.exit(0);
  }

  const icon = strict ? "❌" : "⚠️";
  console.log("\n── Author photos below 100 KB ──");
  for (const item of tooSmall) {
    const kb = (item.bytes / 1024).toFixed(1);
    console.log(`${icon} ${item.name} — ${kb} KB`);
  }
  console.log(
    `\nTotal: ${tooSmall.length} photo(s) below 100 KB. ` +
      `Re-source from author's institute/university/publisher page (NOT Wikipedia thumbnails). ` +
      `See .claude/skills/book-to-modes/SKILL.md → Этап 4.5h «Author».`,
  );
  if (strict) {
    console.log("\nFailing because of --strict flag.");
    process.exit(1);
  }
  // Без --strict — exit 0 (CI не падает, но видно где косяки).
  process.exit(0);
}

main();
