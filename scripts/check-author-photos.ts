#!/usr/bin/env tsx
/**
 * Проверка качества фото авторов в public/authors/.
 *
 * Правило 1 (после аудита seven-principles 2026-05): фото автора должно быть
 * ≥100 КБ. Wikipedia thumbnails ~30-50 КБ — запрещены: мутное, читается на
 * лендинге как «постер на стене», а не как фото эксперта.
 *
 * Правило 2 (после аудита borba-za-vnimanie 2026-05, правило
 * `author-photo-equals-cover`): фото автора не должно быть идентично обложке
 * книги. Когда автор изображён на обложке, легко скопировать тот же файл в
 * `public/authors/` — на лендинге появляются две одинаковые картинки в
 * секциях «О книге» и «Об авторе». Проверка через md5.
 *
 * Запуск:
 *   npx tsx scripts/check-author-photos.ts          # warning-only (для CI)
 *   npx tsx scripts/check-author-photos.ts --strict # exit 1 если есть проблемы
 *   npm run check:author-photos                     # warning-only
 *
 * Exit code:
 *   0 — нет фото / все ок / есть warnings но без --strict
 *   1 — есть проблемы И флаг --strict
 *   2 — каталог public/authors не читается
 *
 * Прецеденты:
 *   - seven-principles 2026-05: Wikipedia thumbnail Готтмана 38 КБ, переснимали.
 *   - borba-za-vnimanie 2026-05: обложка Белоусова скопирована как фото автора,
 *     заметили только во время аудита.
 *
 * Дизайн: warning-only по умолчанию — чтобы CI на main не падал из-за
 * старых фото книг (bakirov 5 КБ, bern 6 КБ, ilyahov 23 КБ и т.п.).
 * --strict — для разработчика новой книги: «не выпускаем книгу с проблемами».
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const PUBLIC_DIR = resolve(process.cwd(), "public");
const AUTHORS_DIR = join(PUBLIC_DIR, "authors");
const BOOKS_DIR = join(PUBLIC_DIR, "books");
const MIN_SIZE_BYTES = 100 * 1024; // 100 КБ

function md5(path: string): string {
  return createHash("md5").update(readFileSync(path)).digest("hex");
}

/** Собрать все cover.* из public/books/<slug>/. Возвращает map md5 → "<slug>/cover.<ext>". */
function collectBookCoverHashes(): Map<string, string> {
  const map = new Map<string, string>();
  let bookSlugs: string[];
  try {
    bookSlugs = readdirSync(BOOKS_DIR);
  } catch {
    return map; // нет каталога books — нечего сравнивать
  }
  for (const slug of bookSlugs) {
    const slugDir = join(BOOKS_DIR, slug);
    try {
      const stat = statSync(slugDir);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }
    let entries: string[];
    try {
      entries = readdirSync(slugDir);
    } catch {
      continue;
    }
    for (const f of entries) {
      if (!/^cover\.(jpg|jpeg|webp|png)$/i.test(f)) continue;
      const fullPath = join(slugDir, f);
      try {
        map.set(md5(fullPath), `${slug}/${f}`);
      } catch {
        // unreadable — пропускаем
      }
    }
  }
  return map;
}

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

  const coverHashes = collectBookCoverHashes();

  const tooSmall: Array<{ name: string; bytes: number }> = [];
  const equalsCover: Array<{ name: string; coverPath: string }> = [];
  for (const f of photos) {
    const fullPath = join(AUTHORS_DIR, f);
    const size = statSync(fullPath).size;
    if (size < MIN_SIZE_BYTES) {
      tooSmall.push({ name: f, bytes: size });
    }
    if (coverHashes.size > 0) {
      try {
        const hash = md5(fullPath);
        const coverPath = coverHashes.get(hash);
        if (coverPath) {
          equalsCover.push({ name: f, coverPath });
        }
      } catch {
        // unreadable — пропускаем
      }
    }
  }

  const hasIssues = tooSmall.length > 0 || equalsCover.length > 0;
  if (!hasIssues) {
    console.log(
      `✅ all ${photos.length} author photos pass ≥100 KB and md5≠cover checks`,
    );
    process.exit(0);
  }

  const icon = strict ? "❌" : "⚠️";

  if (tooSmall.length > 0) {
    console.log("\n── Author photos below 100 KB ──");
    for (const item of tooSmall) {
      const kb = (item.bytes / 1024).toFixed(1);
      console.log(`${icon} ${item.name} — ${kb} KB`);
    }
    console.log(
      `Total: ${tooSmall.length} photo(s) below 100 KB. ` +
        `Re-source from author's institute/university/publisher page (NOT Wikipedia thumbnails).`,
    );
  }

  if (equalsCover.length > 0) {
    console.log("\n── Author photos identical to book cover (author-photo-equals-cover) ──");
    for (const item of equalsCover) {
      console.log(`${icon} authors/${item.name} ≡ books/${item.coverPath} (md5 match)`);
    }
    console.log(
      `Total: ${equalsCover.length} photo(s) duplicate a book cover. ` +
        `Author photo must be a SEPARATE file, even if the author appears on the cover. ` +
        `Prevents the same image showing up twice on the landing page. ` +
        `Precedent: borba-za-vnimanie 2026-05.`,
    );
  }

  console.log(
    `\nDetails: .claude/skills/book-to-modes/SKILL.md → Этап 4.5h «Author».`,
  );

  if (strict) {
    console.log("\nFailing because of --strict flag.");
    process.exit(1);
  }
  // Без --strict — exit 0 (CI не падает, но видно где косяки).
  process.exit(0);
}

main();
