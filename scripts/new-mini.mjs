#!/usr/bin/env node
/**
 * scripts/new-mini.mjs
 *
 * Генератор скелета мини-проекта.
 *
 * Использование:
 *   npm run new-mini <slug>
 *   node scripts/new-mini.mjs <slug>
 *
 * Создаёт:
 *   - mini/<slug>/        — содержимое мини-проекта (лежит вне индексации Claude)
 *   - app/<slug>/         — тонкие шимы-реэкспорты для Next.js App Router
 *
 * Подробности — docs/runbooks/new-mini-project.md.
 */

import { mkdir, readdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..");

const TEMPLATE_ROOT = join(REPO_ROOT, "templates", "mini-project");
const PLACEHOLDER = "__SLUG__";

// Зарезервированные слаги — заняты основным приложением.
const RESERVED_SLUGS = new Set([
  "api",
  "auth",
  "program",
  "legal",
  "balance",
  "test",
  "profile",
  "chat",
  "chats",
  "exercise",
  "exercises",
  "portrait",
  "hub",
  "funnel", // уже занят существующим мини (см. CLAUDE.md, миграция отдельной задачей)
]);

const SLUG_PATTERN = /^[a-z][a-z0-9-]{2,30}$/;

// Бинарные расширения, в которых не делаем replace плейсхолдера.
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
  ".woff", ".woff2", ".ttf", ".otf",
  ".pdf", ".zip",
]);

function die(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function validateSlug(slug) {
  if (!slug) {
    die("Не указан slug. Пример: npm run new-mini volynsky-v2");
  }
  if (!SLUG_PATTERN.test(slug)) {
    die(
      `Невалидный slug "${slug}". Требования: kebab-case, 3-31 символ, ` +
        `только [a-z0-9-], начинается с буквы. Пример: volynsky-v2.`
    );
  }
  if (RESERVED_SLUGS.has(slug)) {
    die(
      `Slug "${slug}" зарезервирован основным приложением. ` +
        `Выбери другое имя.`
    );
  }
}

function getExt(name) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

async function copyTree(srcDir, dstDir, slug) {
  await mkdir(dstDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const renamedName = entry.name.replaceAll(PLACEHOLDER, slug);
    const dstPath = join(dstDir, renamedName);

    if (entry.isDirectory()) {
      await copyTree(srcPath, dstPath, slug);
      continue;
    }

    if (BINARY_EXTENSIONS.has(getExt(entry.name))) {
      const buf = await readFile(srcPath);
      await writeFile(dstPath, buf);
      continue;
    }

    const text = await readFile(srcPath, "utf8");
    const replaced = text.replaceAll(PLACEHOLDER, slug);
    await writeFile(dstPath, replaced);
  }
}

async function main() {
  const slug = process.argv[2];
  validateSlug(slug);

  if (!existsSync(TEMPLATE_ROOT)) {
    die(
      `Не найден шаблон ${relative(REPO_ROOT, TEMPLATE_ROOT)}. ` +
        `Сначала создай папку templates/mini-project/.`
    );
  }

  const miniDir = join(REPO_ROOT, "mini", slug);
  const appDir = join(REPO_ROOT, "app", slug);

  if (existsSync(miniDir)) {
    die(`Папка mini/${slug}/ уже существует. Выбери другой slug или удали её.`);
  }
  if (existsSync(appDir)) {
    die(`Папка app/${slug}/ уже существует. Выбери другой slug или удали её.`);
  }

  const templateMini = join(TEMPLATE_ROOT, "mini", PLACEHOLDER);
  const templateApp = join(TEMPLATE_ROOT, "app", PLACEHOLDER);

  if (!existsSync(templateMini) || !existsSync(templateApp)) {
    die(
      `Шаблон неполный: ожидается templates/mini-project/mini/${PLACEHOLDER}/ ` +
        `и templates/mini-project/app/${PLACEHOLDER}/.`
    );
  }

  await copyTree(templateMini, miniDir, slug);
  await copyTree(templateApp, appDir, slug);

  const url = `http://localhost:3000/${slug}`;
  console.log(`✓ Создан mini/${slug}/ и app/${slug}/ (шимы)\n`);
  console.log("Следующие шаги:");
  console.log(`  1. Заполни mini/${slug}/CLAUDE.md и README.md описанием задачи`);
  console.log(`  2. npm run dev и открой ${url}`);
  console.log(`  3. Реализуй логику в mini/${slug}/pages/ и mini/${slug}/lib/`);
  console.log(`  4. Для нового роута: добавь pages/XxxPage.tsx + app/${slug}/xxx/page.tsx (шим)`);
  console.log(`  5. Перед коммитом: npm run build + grep -rE "@/(lib|components|contexts|hooks|types)" mini/${slug}/ (должно быть пусто)`);
}

main().catch((err) => {
  console.error("✗ Ошибка:");
  console.error(err);
  process.exit(1);
});
