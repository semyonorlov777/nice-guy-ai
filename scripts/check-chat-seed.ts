#!/usr/bin/env tsx
/**
 * SQL-линтер чатовых полей в продакшен-БД Supabase.
 *
 * Проверяет каждую программу (programs), каждый режим (program_modes) и
 * каждую тему (program_themes) на соответствие runbook-чеклисту
 * (docs/runbooks/chat-message-formatting.md).
 *
 * Запуск:
 *   npx tsx scripts/check-chat-seed.ts
 *   npm run check:chats
 *
 * Exit code:
 *   0 — всё ok
 *   1 — найдены нарушения (печатаются в stderr)
 *   2 — ошибка конфигурации (нет .env, нет SUPABASE_SERVICE_ROLE_KEY)
 *
 * Правила — в секции RULES внизу файла. Каждое правило — функция
 * `(ctx) => Violation[]`. Легко расширяется.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// --- Загрузка .env.local вручную (без dotenv) ---
function loadEnv(): Record<string, string> {
  const envPath = resolve(process.cwd(), ".env.local");
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  } catch {
    // .env.local может отсутствовать в CI — тогда полагаемся на process.env
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "❌ check-chat-seed: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
  console.error(
    "   set via .env.local or env vars. CI: set GitHub Actions secrets.",
  );
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// --- Типы ---
interface Violation {
  severity: "error" | "warn";
  program: string;
  location: string;
  rule: string;
  message: string;
}

interface ProgramRow {
  id: string;
  slug: string;
  title: string;
  system_prompt: string | null;
  anonymous_system_prompt: string | null;
  free_chat_welcome: string | null;
  author_chat_system_prompt: string | null;
  author_chat_welcome: string | null;
  anonymous_quick_replies: unknown;
  landing_data: Record<string, unknown> | null;
  features: Record<string, boolean> | null;
}

interface ModeRow {
  program_id: string;
  mode_key: string;
  welcome_mode_label: string | null;
  welcome_title: string | null;
  welcome_subtitle: string | null;
  welcome_ai_message: string | null;
  welcome_replies: unknown;
  system_prompt: string | null;
}

interface ThemeRow {
  program_id: string;
  key: string;
  welcome_ai_message: string | null;
  welcome_replies: unknown;
  welcome_system_context: string | null;
}

type Severity = "error" | "warn";

function violation(
  program: string,
  location: string,
  rule: string,
  message: string,
  severity: Severity = "error",
): Violation {
  return { severity, program, location, rule, message };
}

// --- Правила ---

/** welcome_ai_message должен быть plain-text: нет `**`, `##`, `- ` в начале строки, `1. `. */
function checkWelcomeAiMessage(
  program: string,
  location: string,
  text: string | null,
): Violation[] {
  if (!text) return [];
  const out: Violation[] = [];
  if (/\*\*[^*]+\*\*/.test(text)) {
    out.push(
      violation(
        program,
        location,
        "welcome-no-markdown-bold",
        "welcome_ai_message содержит markdown `**bold**` — будет видно буквально",
      ),
    );
  }
  if (/^##\s/m.test(text)) {
    out.push(
      violation(
        program,
        location,
        "welcome-no-markdown-heading",
        "welcome_ai_message содержит markdown-заголовок `## ` — будет видно буквально",
      ),
    );
  }
  if (/^-\s/m.test(text)) {
    out.push(
      violation(
        program,
        location,
        "welcome-no-markdown-dash-list",
        "welcome_ai_message содержит `- ` в начале строки — используй буллет `•`",
      ),
    );
  }
  if (/^\d+\.\s/m.test(text)) {
    out.push(
      violation(
        program,
        location,
        "welcome-no-numbered-list",
        "welcome_ai_message содержит нумерованный список `1. `",
        "warn",
      ),
    );
  }
  return out;
}

/** welcome_replies должен быть массив `{text, type: "normal"|"exit"}`. Не массив строк. */
function checkWelcomeReplies(
  program: string,
  location: string,
  replies: unknown,
  requireExit = true,
): Violation[] {
  if (replies == null) return [];
  if (!Array.isArray(replies)) {
    return [
      violation(
        program,
        location,
        "replies-must-be-array",
        `welcome_replies должен быть массивом, получили ${typeof replies}`,
      ),
    ];
  }
  if (replies.length === 0) return [];
  const out: Violation[] = [];
  const allObjects = replies.every(
    (r) =>
      r != null &&
      typeof r === "object" &&
      "text" in (r as Record<string, unknown>),
  );
  if (!allObjects) {
    out.push(
      violation(
        program,
        location,
        "replies-must-be-objects",
        'welcome_replies должен содержать объекты {text, type}, не строки',
      ),
    );
    return out;
  }
  if (requireExit) {
    const hasExit = replies.some(
      (r) => (r as { type?: string }).type === "exit",
    );
    if (!hasExit) {
      out.push(
        violation(
          program,
          location,
          "replies-need-exit",
          `welcome_replies: нет ни одного reply с type:"exit" (runbook: "последний reply в начале диалога — безопасный exit")`,
          "warn",
        ),
      );
    }
  }
  return out;
}

/**
 * system_prompt должен содержать QR-блок с буквальным примером + контрпримером
 * + запретом на склеивание.
 */
function checkSystemPromptQrBlock(
  program: string,
  location: string,
  prompt: string | null,
  strict = true,
): Violation[] {
  if (!prompt) return [];
  const out: Violation[] = [];

  const hasQrSection =
    /QUICK REPLIES/i.test(prompt) || /Quick replies/i.test(prompt);
  if (!hasQrSection) {
    out.push(
      violation(
        program,
        location,
        "sp-has-qr-section",
        "system_prompt не содержит блок `QUICK REPLIES` / `Quick replies`",
      ),
    );
  }

  // Пример «ёлочек» должен быть, причём тематический, а не плейсхолдер.
  if (strict) {
    // Ищем позиции ключевых маркеров
    const placeholderPos = prompt.indexOf("«Вариант 1 от первого лица»");
    const wrongMarkerPos = prompt.indexOf("НЕПРАВИЛЬНО");
    const correctMarkerPos = prompt.indexOf("ПРАВИЛЬНО");

    if (placeholderPos >= 0) {
      // Плейсхолдер есть. Проверяем — он в контрпримере или в позитивном?
      // Контрпример: плейсхолдер идёт ПОСЛЕ "НЕПРАВИЛЬНО" и ДО "ПРАВИЛЬНО" (или раньше ПРАВИЛЬНО).
      const inCounterexample =
        wrongMarkerPos >= 0 &&
        placeholderPos > wrongMarkerPos &&
        (correctMarkerPos === -1 || placeholderPos < correctMarkerPos);
      if (!inCounterexample) {
        out.push(
          violation(
            program,
            location,
            "sp-literal-placeholder-in-positive",
            "system_prompt содержит literal «Вариант 1 от первого лица» в ПРАВИЛЬНОМ примере. Замени на тематические reply по логике режима (см. book-to-modes REFERENCE.md §5)",
          ),
        );
      }
    }

    if (wrongMarkerPos === -1) {
      out.push(
        violation(
          program,
          location,
          "sp-has-counterexample",
          "system_prompt не содержит контрпример `НЕПРАВИЛЬНО`",
          "warn",
        ),
      );
    }

    if (!/НИКОГДА не склеивай/.test(prompt)) {
      out.push(
        violation(
          program,
          location,
          "sp-has-never-join-rule",
          "system_prompt не содержит фразу `НИКОГДА не склеивай` — модель может склеить «ёлочки» через пробел",
          "warn",
        ),
      );
    }
  }

  return out;
}

/**
 * Welcome-тексты уровня программы (free_chat_welcome / author_chat_welcome)
 * должны содержать ≥3 «ёлочки» в конце на отдельных строках, чтобы появились
 * стартовые кнопки-«ёлочки».
 */
function checkProgramWelcomeTrailingReplies(
  program: string,
  location: string,
  welcome: string | null,
): Violation[] {
  if (!welcome) return [];
  const lines = welcome.trimEnd().split("\n");
  let trailing = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^[«"].+[»"]$/.test(line)) {
      trailing++;
    } else {
      break;
    }
  }
  if (trailing < 3) {
    return [
      violation(
        program,
        location,
        "program-welcome-needs-trailing-replies",
        `${location}: нет ≥3 «ёлочек» в конце welcome-текста (найдено ${trailing}). Добавь «Вариант»-кнопки на отдельных строках чтобы пользователь видел стартовые кнопки.`,
      ),
    ];
  }
  return [];
}

/** landing_data.author.photo_url должен быть локальным путём `/authors/*`. */
function checkAuthorPhotoLocal(
  program: string,
  landing: Record<string, unknown> | null,
): Violation[] {
  if (!landing) return [];
  const author = landing.author as Record<string, unknown> | undefined;
  const photoUrl = author?.photo_url as string | undefined;
  if (!photoUrl) return [];
  if (!photoUrl.startsWith("/authors/")) {
    return [
      violation(
        program,
        "programs.landing_data.author.photo_url",
        "author-photo-local",
        `Внешний URL для фото автора: ${photoUrl}. Используй локальный путь /authors/{slug}.jpg — иначе сломается CSP или пропадёт при смене хоста.`,
      ),
    ];
  }
  return [];
}

// --- Исполнитель ---

async function main() {
  const violations: Violation[] = [];

  const { data: programs, error: pErr } = await supabase
    .from("programs")
    .select(
      "id, slug, title, system_prompt, anonymous_system_prompt, free_chat_welcome, author_chat_system_prompt, author_chat_welcome, anonymous_quick_replies, landing_data, features",
    );
  if (pErr) {
    console.error("❌ failed to fetch programs:", pErr.message);
    process.exit(2);
  }

  for (const p of (programs ?? []) as ProgramRow[]) {
    // programs уровень
    violations.push(
      ...checkSystemPromptQrBlock(p.slug, "programs.system_prompt", p.system_prompt),
    );
    violations.push(
      ...checkSystemPromptQrBlock(
        p.slug,
        "programs.author_chat_system_prompt",
        p.author_chat_system_prompt,
      ),
    );
    violations.push(
      ...checkSystemPromptQrBlock(
        p.slug,
        "programs.anonymous_system_prompt",
        p.anonymous_system_prompt,
        /* strict */ false,
      ),
    );
    violations.push(
      ...checkProgramWelcomeTrailingReplies(
        p.slug,
        "programs.free_chat_welcome",
        p.free_chat_welcome,
      ),
    );
    violations.push(
      ...checkProgramWelcomeTrailingReplies(
        p.slug,
        "programs.author_chat_welcome",
        p.author_chat_welcome,
      ),
    );
    violations.push(...checkAuthorPhotoLocal(p.slug, p.landing_data));
  }

  // program_modes уровень
  const { data: modes, error: mErr } = await supabase
    .from("program_modes")
    .select(
      "program_id, welcome_mode_label, welcome_title, welcome_subtitle, welcome_ai_message, welcome_replies, system_prompt, mode_template_id, mode_templates!inner(key)",
    );
  if (mErr) {
    console.error("❌ failed to fetch program_modes:", mErr.message);
    process.exit(2);
  }

  const slugByProgramId = new Map<string, string>();
  for (const p of (programs ?? []) as ProgramRow[]) {
    slugByProgramId.set(p.id, p.slug);
  }

  for (const m of (modes ?? []) as unknown as Array<
    ModeRow & { mode_templates: { key: string } }
  >) {
    const slug = slugByProgramId.get(m.program_id) ?? "unknown";
    const modeKey = m.mode_templates?.key ?? "unknown";
    const loc = `program_modes[${modeKey}]`;

    violations.push(
      ...checkWelcomeAiMessage(slug, `${loc}.welcome_ai_message`, m.welcome_ai_message),
    );
    violations.push(
      ...checkWelcomeReplies(
        slug,
        `${loc}.welcome_replies`,
        m.welcome_replies,
        /* requireExit */ modeKey !== "test_eq" && modeKey !== "test",
      ),
    );
    if (m.system_prompt) {
      violations.push(
        ...checkSystemPromptQrBlock(slug, `${loc}.system_prompt`, m.system_prompt),
      );
    }
  }

  // program_themes уровень
  const { data: themes, error: tErr } = await supabase
    .from("program_themes")
    .select(
      "program_id, key, welcome_ai_message, welcome_replies, welcome_system_context",
    );
  if (tErr) {
    console.error("❌ failed to fetch program_themes:", tErr.message);
    process.exit(2);
  }

  for (const t of (themes ?? []) as ThemeRow[]) {
    const slug = slugByProgramId.get(t.program_id) ?? "unknown";
    const loc = `program_themes[${t.key}]`;
    violations.push(
      ...checkWelcomeAiMessage(slug, `${loc}.welcome_ai_message`, t.welcome_ai_message),
    );
    violations.push(
      ...checkWelcomeReplies(slug, `${loc}.welcome_replies`, t.welcome_replies),
    );
    // welcome_system_context НЕ должен дублировать правила quick-replies
    // (они наследуются из programs.system_prompt). Не критично, но warn.
    if (t.welcome_system_context && /QUICK REPLIES/i.test(t.welcome_system_context)) {
      violations.push(
        violation(
          slug,
          `${loc}.welcome_system_context`,
          "theme-no-qr-duplication",
          "welcome_system_context темы дублирует блок QR — правила наследуются из programs.system_prompt. Убрать.",
          "warn",
        ),
      );
    }
  }

  // --- Вывод ---
  const errors = violations.filter((v) => v.severity === "error");
  const warns = violations.filter((v) => v.severity === "warn");

  if (errors.length === 0 && warns.length === 0) {
    console.log("✅ check-chat-seed: all chat fields pass runbook checklist");
    process.exit(0);
  }

  // Группируем по программе для читаемости
  const byProgram = new Map<string, Violation[]>();
  for (const v of violations) {
    if (!byProgram.has(v.program)) byProgram.set(v.program, []);
    byProgram.get(v.program)!.push(v);
  }

  for (const [program, vs] of byProgram) {
    console.log(`\n── ${program} ──`);
    for (const v of vs) {
      const icon = v.severity === "error" ? "❌" : "⚠️";
      console.log(`${icon} [${v.rule}] ${v.location}`);
      console.log(`     ${v.message}`);
    }
  }

  console.log(
    `\nTotal: ${errors.length} error(s), ${warns.length} warning(s). See docs/runbooks/chat-message-formatting.md`,
  );
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("❌ check-chat-seed crashed:", err);
  process.exit(2);
});
