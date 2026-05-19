#!/usr/bin/env tsx
/**
 * SQL-линтер чатовых полей в продакшен-БД Supabase.
 *
 * Проверяет каждую программу (programs), каждый режим (program_modes) и
 * каждую тему (program_themes) на соответствие runbook-чеклисту
 * (docs/runbooks/chat-message-formatting.md).
 *
 * Запуск:
 *   npx tsx scripts/check-chat-seed.ts             # все книги
 *   npm run check:chats                            # то же
 *   npx tsx scripts/check-chat-seed.ts --book=eq-2-0  # одна книга
 *   npx tsx scripts/check-chat-seed.ts --legacy-relaxed  # пропустить новые правила (5,6,7,8) для книг которые сделаны до этих правил
 *
 * Exit code:
 *   0 — всё ok (или только warnings)
 *   1 — найдены errors (печатаются в stderr)
 *   2 — ошибка конфигурации (нет .env, нет SUPABASE_SERVICE_ROLE_KEY)
 *
 * Правила (по runbook chat-message-formatting + lessons learned после аудита 8 книг):
 *   ── Базовые (welcome-карточка) ──
 *   welcome_ai_message — plain text, без markdown, без дубликата title, абзацы через \n\n
 *   welcome_replies    — JSONB [{text, type}], не строки; reply ≤60 символов, без вложенных «ёлочек»
 *   welcome_mode_label — Title Case или UPPERCASE (начинается с заглавной); CSS делает uppercase визуально
 *   welcome_title      — без эмодзи в начале
 *   welcome_subtitle   — ≤80 символов
 *   welcome_title      — НЕ дублирует mode_templates.name (case-insensitive) — урок Готтмана 2026-05
 *   ── system_prompt (на всех уровнях) ──
 *   system_prompt      — содержит блок Quick replies + counterexample про склейку + про <angle-bracket>
 *   system_prompt      — содержит блок «Запрет приветствий» (фразу про «Здравствуй»/«Отличный вопрос»)
 *   system_prompt      — содержит блок «ОБРАЩЕНИЕ» с правилом «ты» и явным НЕПРАВИЛЬНО про «вы»
 *   ── programs welcome ──
 *   programs.*_welcome — содержит ≥3 «ёлочки» в конце для стартовых кнопок
 *   ── landing ──
 *   landing_data.author.photo_url — локальный путь /authors/*
 *   landing_data.main_concepts    — массив 5+ строк, каждая встречается в anonymous_system_prompt
 *   landing_data поля без разметки — без HTML-тегов (<em>, <strong>, <br>, <b>, <i>)
 *   ── anonymous_system_prompt (демо-чат на лендинге) ──
 *   anonymous_system_prompt — блок Д «ОБЯЗАТЕЛЬНО назови ... по имени» (концепт книги)
 *   anonymous_system_prompt — блок Е «КРИТИЧЕСКОЕ ПРАВИЛО» + контр-пример «без кавычек»
 *   ── test_configs (если есть) ──
 *   test_configs.questions[] — внутри блока questions_per_block одна scale на все вопросы
 *   ── exclusivity ──
 *   welcome_message + welcome_ai_message — взаимоисключающие
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
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
  hub_messages: Record<string, string> | null;
  test_system_prompt: string | null;
  meta_title: string | null;
  meta_description: string | null;
}

interface ModeRow {
  program_id: string;
  mode_key: string;
  welcome_mode_label: string | null;
  welcome_title: string | null;
  welcome_subtitle: string | null;
  welcome_ai_message: string | null;
  welcome_message: string | null;
  welcome_replies: unknown;
  system_prompt: string | null;
}

interface ThemeRow {
  program_id: string;
  key: string;
  icon_key: string | null;
  welcome_ai_message: string | null;
  welcome_replies: unknown;
  welcome_system_context: string | null;
}

interface TestConfigRow {
  program_id: string;
  slug: string;
  questions: unknown;
  ui_config: unknown;
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
  // Дубликат welcome_title: текст начинается с `эмодзи + **Title**`
  // (welcome_title уже рендерится карточкой выше — см. NewChatScreen).
  if (
    /^\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*\*\*[^*]+\*\*/u.test(text)
  ) {
    out.push(
      violation(
        program,
        location,
        "welcome-no-title-duplicate",
        "welcome_ai_message начинается с `эмодзи **Название**` — это дубликат welcome_title, удали этот префикс",
      ),
    );
  }
  // Эвристика разрывов абзацев: если есть `\n[^\n]` без `\n\n` где-то — абзацы склеятся.
  // Проверяем что для текстов в >1 абзац обязательно есть хотя бы один `\n\n`.
  const hasSingleNewlines = /[^\n]\n[^\n]/.test(text);
  const hasDoubleNewlines = /\n\n/.test(text);
  if (hasSingleNewlines && !hasDoubleNewlines && text.length > 120) {
    out.push(
      violation(
        program,
        location,
        "welcome-paragraph-breaks",
        "welcome_ai_message: одиночные `\\n` без `\\n\\n` — абзацы склеятся в стену. Ставь двойной перенос между абзацами.",
        "warn",
      ),
    );
  }
  return out;
}

/**
 * welcome_replies должен быть массив `{text, type: "normal"|"exit"}`. Не массив
 * строк (legacy — компонент пережёвывает, но единого контроля над «exit»-кнопкой
 * нет, см. runbook).
 *
 * Флаг `allowStrings` — для полей, где legacy-формат массив-строк ещё
 * исторически живёт в проде (например `programs.anonymous_quick_replies`).
 * В этом случае массив строк отдаём warn-ом «мигрируй», а не error-ом, чтобы
 * не ломать CI пока заказчик не пересоберёт все seed.
 */
function checkWelcomeReplies(
  program: string,
  location: string,
  replies: unknown,
  requireExit = true,
  allowStrings = false,
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
    if (allowStrings && replies.every((r) => typeof r === "string")) {
      out.push(
        violation(
          program,
          location,
          "replies-legacy-strings",
          `${location}: массив строк (legacy формат). Компонент пережёвывает, но без явного контроля над «exit»-кнопкой. Пересобери seed в формат [{text, type}], последний — type:"exit".`,
          "warn",
        ),
      );
      return out;
    }
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
  // Проверки текста каждого reply (длина, вложенные ёлочки, пунктуация)
  for (let i = 0; i < replies.length; i++) {
    const r = replies[i] as { text?: string };
    const text = typeof r.text === "string" ? r.text : "";
    if (!text) continue;
    if (text.length > 60) {
      out.push(
        violation(
          program,
          `${location}[${i}]`,
          "reply-text-too-long",
          `reply.text > 60 символов (${text.length}): «${text.slice(0, 40)}…» — не влезет на мобильную кнопку`,
          "warn",
        ),
      );
    }
    if (text.includes("«") || text.includes("»")) {
      out.push(
        violation(
          program,
          `${location}[${i}]`,
          "reply-nested-quotes",
          `reply.text содержит вложенные «ёлочки»: «${text}» — non-greedy regex парсера обрежет до первого »`,
        ),
      );
    }
    if (/\*\*[^*]+\*\*/.test(text)) {
      out.push(
        violation(
          program,
          `${location}[${i}]`,
          "reply-no-markdown",
          `reply.text содержит markdown \`**bold**\` — звёздочки видны буквально в кнопке`,
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
    // Counterexample про <угловые скобки> — введён коммитом d2067ba для всех книг.
    // Без него Gemini временами выдаёт <текст> вместо «ёлочек», парсер их не видит.
    const hasAngleBracketCounter =
      /<\s*текст\s*>/i.test(prompt) ||
      /<\s*вариант\s*>/i.test(prompt) ||
      /угловы[еx]\s+скобки/i.test(prompt);
    if (!hasAngleBracketCounter) {
      out.push(
        violation(
          program,
          location,
          "sp-has-angle-bracket-counterexample",
          "system_prompt не содержит контрпример с угловыми скобками (`<текст>` или `НЕПРАВИЛЬНО: <вариант>`) — Gemini может выдать <текст> вместо «ёлочек», парсер их не увидит. Прецедент: коммит d2067ba для всех 6 книг.",
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

/**
 * Базовые welcome-поля карточки режима: label / title / subtitle.
 * Правила — runbook §"Правила по полям":
 *  - welcome_mode_label: UPPERCASE одно-два слова-архетип
 *  - welcome_title: без эмодзи в начале (эмодзи уже на иконке инструмента)
 *  - welcome_subtitle: одна строка ≤80 символов, обещание результата
 */
function checkBasicWelcomeFields(
  program: string,
  location: string,
  mode: {
    welcome_mode_label: string | null;
    welcome_title: string | null;
    welcome_subtitle: string | null;
  },
): Violation[] {
  const out: Violation[] = [];
  if (mode.welcome_mode_label) {
    const label = mode.welcome_mode_label.trim();
    // welcome_mode_label рендерится в двух местах:
    //   1) .wc-mode  — CSS `text-transform: uppercase` визуально превращает в UPPERCASE
    //   2) .nc-header-sub — без uppercase CSS, рендерится как есть
    // Поэтому в БД допустим Title Case (первая буква большая, остальные любые) —
    // выглядит читаемо в SQL и автоматически UPPERCASES в карточке режима.
    // Проверяем только: не all-lowercase и не пустое. Длина — runbook допускает 1-3 слова.
    // Разрешены: буквы (рус+лат), пробелы, цифры (например, «Теория 5 языков»).
    if (!/^[А-ЯЁA-Z][А-ЯЁA-Zа-яёa-z0-9\s]*$/u.test(label)) {
      out.push(
        violation(
          program,
          `${location}.welcome_mode_label`,
          "label-format",
          `welcome_mode_label "${label}" — должен начинаться с заглавной буквы и содержать только буквы/пробелы (Title Case или UPPERCASE). CSS .wc-mode сам делает text-transform: uppercase.`,
        ),
      );
    }
  }
  if (mode.welcome_title) {
    const title = mode.welcome_title.trim();
    // Эмодзи в начале title — антипаттерн (эмодзи уже на иконке)
    if (/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(title)) {
      out.push(
        violation(
          program,
          `${location}.welcome_title`,
          "title-no-emoji",
          `welcome_title начинается с эмодзи: "${title}". Убери эмодзи — он уже на иконке инструмента/в карточке выше.`,
        ),
      );
    }
  }
  if (mode.welcome_subtitle) {
    const subtitle = mode.welcome_subtitle.trim();
    if (subtitle.length > 80) {
      out.push(
        violation(
          program,
          `${location}.welcome_subtitle`,
          "subtitle-too-long",
          `welcome_subtitle ${subtitle.length} символов (>80): "${subtitle.slice(0, 60)}…". Сократи до одной строки-обещания.`,
          "warn",
        ),
      );
    }
  }
  return out;
}

/**
 * welcome_message (legacy) и welcome_ai_message взаимоисключающие.
 * lib/chat/prepare-context.ts отдаёт приоритет legacy — если есть оба, ai_message теряется.
 */
function checkWelcomeMessageExclusivity(
  program: string,
  location: string,
  welcomeMessage: string | null,
  welcomeAiMessage: string | null,
): Violation[] {
  if (welcomeMessage && welcomeAiMessage) {
    return [
      violation(
        program,
        location,
        "welcome-message-exclusive",
        "У режима заполнены ОБА: welcome_message (legacy) и welcome_ai_message. Приоритет идёт legacy → welcome_ai_message+welcome_replies теряются. Оставь только один.",
        "warn",
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

/**
 * Правило #1 (урок Готтмана): welcome_title не дублирует mode_templates.name.
 * Если совпадают — на карточке режима получается тройной заголовок
 * (боковое меню + шапка чата + welcome-карточка).
 */
function checkTitleVsModeName(
  program: string,
  location: string,
  welcomeTitle: string | null,
  modeName: string | null,
): Violation[] {
  if (!welcomeTitle || !modeName) return [];
  if (welcomeTitle.trim().toLowerCase() === modeName.trim().toLowerCase()) {
    return [
      violation(
        program,
        `${location}.welcome_title`,
        "title-duplicates-mode-name",
        `welcome_title "${welcomeTitle}" дублирует mode_templates.name "${modeName}" — на карточке режима пользователь увидит тройной заголовок (меню + шапка + карточка). Используй фразу-действие, например «Что ты знаешь о партнёре» вместо «Карта любви». См. REFERENCE.md §8 «Welcome_title vs mode_templates.name».`,
      ),
    ];
  }
  return [];
}

/**
 * Правило #2 (урок Готтмана): вопросы теста группируются по шкалам блоками.
 * Внутри одного блока `questions_per_block` все вопросы должны иметь одну `scale`.
 * Иначе пользователь видит ложный заголовок перехода между блоками.
 */
function checkTestQuestionsGrouping(
  program: string,
  testSlug: string,
  questions: unknown,
  uiConfig: unknown,
): Violation[] {
  if (!Array.isArray(questions) || questions.length === 0) return [];
  const config = (uiConfig ?? {}) as { questions_per_block?: number };
  const blockSize = Number(config.questions_per_block) || 5;
  if (blockSize <= 0) return [];

  const out: Violation[] = [];
  for (let blockStart = 0; blockStart < questions.length; blockStart += blockSize) {
    const block = questions.slice(blockStart, blockStart + blockSize);
    if (block.length === 0) continue;
    const firstScale = (block[0] as { scale?: string }).scale ?? "?";
    for (let i = 1; i < block.length; i++) {
      const q = block[i] as { scale?: string; q?: number };
      if (q.scale !== firstScale) {
        out.push(
          violation(
            program,
            `test_configs[${testSlug}].questions[Q${q.q ?? blockStart + i + 1}]`,
            "test-questions-mixed-scales",
            `Вопрос Q${q.q ?? blockStart + i + 1} (scale="${q.scale}") выпадает из блока: первые ${i} вопросов блока шли по scale="${firstScale}", но Q${q.q} уже другая шкала. Группируй вопросы по шкалам блоками ${blockSize} (questions_per_block). См. REFERENCE.md §12 «Порядок вопросов».`,
          ),
        );
        break; // одна ошибка на блок достаточно
      }
    }
  }
  return out;
}

/**
 * Правило #3 (урок Готтмана): HTML-теги в полях landing_data без поддержки разметки.
 * Список полей без разметки — см. chat-message-formatting.md «Где разметка работает».
 */
function checkLandingHtmlInPlainFields(
  program: string,
  landing: Record<string, unknown> | null,
): Violation[] {
  if (!landing) return [];
  const out: Violation[] = [];
  const TAG_RE = /<(em|strong|b|i|br|small|span)\b[^>]*>/i;

  // path → значение для полей без поддержки разметки
  const plainTextFields: Array<[string, unknown]> = [];

  const push = (path: string, val: unknown) => plainTextFields.push([path, val]);

  push("hero_subtitle", landing.hero_subtitle);
  push("hero_cta", landing.hero_cta);
  push("hero_hint", landing.hero_hint);
  push("hero_tag", landing.hero_tag);

  const book = landing.book as Record<string, unknown> | undefined;
  if (book) {
    push("book.alt", book.alt);
    push("book.author_top", book.author_top);
    push("book.title", book.title);
    push("book.subtitle", book.subtitle);
    push("book.author_bottom", book.author_bottom);
  }

  const chatHeader = landing.chat_header as Record<string, unknown> | undefined;
  if (chatHeader) {
    push("chat_header.title", chatHeader.title);
    push("chat_header.subtitle", chatHeader.subtitle);
  }

  const problem = landing.problem as Record<string, unknown> | undefined;
  if (problem) {
    push("problem.label", problem.label);
    push("problem.lead", problem.lead);
    if (Array.isArray(problem.pain_cards)) {
      for (let i = 0; i < problem.pain_cards.length; i++) {
        const card = problem.pain_cards[i] as Record<string, unknown>;
        push(`problem.pain_cards[${i}].title`, card.title);
        push(`problem.pain_cards[${i}].text`, card.text);
      }
    }
  }

  const personas = landing.personas as Record<string, unknown> | undefined;
  if (personas) {
    push("personas.label", personas.label);
    push("personas.title", personas.title);
    if (Array.isArray(personas.items)) {
      for (let i = 0; i < personas.items.length; i++) {
        const item = personas.items[i] as Record<string, unknown>;
        push(`personas.items[${i}].headline`, item.headline);
        push(`personas.items[${i}].body`, item.body);
      }
    }
  }

  const outcomes = landing.outcomes as Record<string, unknown> | undefined;
  if (outcomes) {
    push("outcomes.label", outcomes.label);
    push("outcomes.subtitle", outcomes.subtitle);
    if (Array.isArray(outcomes.items)) {
      for (let i = 0; i < outcomes.items.length; i++) {
        const item = outcomes.items[i] as Record<string, unknown>;
        push(`outcomes.items[${i}].title`, item.title);
        push(`outcomes.items[${i}].description`, item.description);
      }
    }
  }

  const comparison = landing.comparison as Record<string, unknown> | undefined;
  if (comparison) {
    push("comparison.label", comparison.label);
    push("comparison.subtitle", comparison.subtitle);
    if (Array.isArray(comparison.columns)) {
      for (let i = 0; i < comparison.columns.length; i++) {
        const col = comparison.columns[i] as Record<string, unknown>;
        push(`comparison.columns[${i}].name`, col.name);
        push(`comparison.columns[${i}].role`, col.role);
      }
    }
  }

  const howItWorks = landing.how_it_works as Record<string, unknown> | undefined;
  if (howItWorks) {
    push("how_it_works.label", howItWorks.label);
    push("how_it_works.summary_text", howItWorks.summary_text);
    if (Array.isArray(howItWorks.steps)) {
      for (let i = 0; i < howItWorks.steps.length; i++) {
        const step = howItWorks.steps[i] as Record<string, unknown>;
        push(`how_it_works.steps[${i}].title`, step.title);
      }
    }
  }

  if (Array.isArray(landing.social_proof)) {
    for (let i = 0; i < landing.social_proof.length; i++) {
      const sp = landing.social_proof[i] as Record<string, unknown>;
      push(`social_proof[${i}].main`, sp.main);
      push(`social_proof[${i}].sub`, sp.sub);
    }
  }

  const author = landing.author as Record<string, unknown> | undefined;
  if (author) {
    push("author.name", author.name);
    push("author.credentials", author.credentials);
    push("author.quote", author.quote);
  }

  const test = landing.test as Record<string, unknown> | undefined;
  if (test) {
    push("test.title", test.title);
    push("test.description", test.description);
    push("test.time_label", test.time_label);
    push("test.questions_label", test.questions_label);
    push("test.cta_text", test.cta_text);
  }

  for (const [path, value] of plainTextFields) {
    if (typeof value !== "string") continue;
    const match = value.match(TAG_RE);
    if (match) {
      out.push(
        violation(
          program,
          `programs.landing_data.${path}`,
          "landing-html-in-plain-field",
          `Тег "${match[0]}" в поле без поддержки разметки. Поле отображается как plain-text — тег будет виден буквально. См. chat-message-formatting.md «Где разметка работает».`,
          "warn",
        ),
      );
    }
  }
  return out;
}

/**
 * Правило #4 (урок Готтмана): блок «Запрет приветствий» (кирпич Б REFERENCE.md §5.0).
 * Без него AI начинает каждый второй ответ со «Здравствуй»/«Отличный вопрос».
 */
function checkNoGreetingsBlock(
  program: string,
  location: string,
  prompt: string | null,
  severity: Severity,
): Violation[] {
  if (!prompt) return [];
  // Признак блока: упоминание запрета + один из вариантов приветствия или похвалы вопроса
  const hasBan = /не начинай ответ с|не начинай со?/i.test(prompt);
  const hasExample =
    /здравствуй|приветствую|отличный вопрос|хороший вопрос|это интересно|замечательный вопрос/i.test(
      prompt,
    );
  if (!hasBan || !hasExample) {
    return [
      violation(
        program,
        location,
        "no-greetings-block",
        `Промпт не содержит блок «Запрет приветствий и похвалы вопроса» (кирпич Б REFERENCE.md §5.0). Без него AI начинает каждый второй ответ со «Здравствуй» / «Отличный вопрос». Добавь блок с явным запретом и примерами фраз.`,
        severity,
      ),
    ];
  }
  return [];
}

/**
 * Правило #5 (урок Готтмана): блок «ОБРАЩЕНИЕ — КРИТИЧЕСКОЕ ПРАВИЛО» (кирпич А).
 * Без явного контр-примера «вы» Gemini срывается на «вы» в 1 ответе из 3-4.
 */
function checkAddressYouBlock(
  program: string,
  location: string,
  prompt: string | null,
  severity: Severity,
): Violation[] {
  if (!prompt) return [];
  // Признак блока: явное правило про «ты» + явное «не вы» как контр-пример.
  // \b в JS не работает с русскими буквами, поэтому ловим явные фразы из
  // шаблона REFERENCE.md §5.0 (кирпич А).
  const explicit =
    /никогда на «?вы»?/i.test(prompt) ||
    /всегда на «?ты»?/i.test(prompt) ||
    /## ОБРАЩЕНИЕ/i.test(prompt) ||
    /ОБРАЩЕНИЕ — КРИТИЧЕСКОЕ/i.test(prompt) ||
    // Любой явный list ПРАВИЛЬНО/НЕПРАВИЛЬНО где упоминается «Вас», «Вы»,
    // «вам» именно как примеры запрещённой формы. Условие — должны быть
    // оба маркера рядом.
    (/неправильно/i.test(prompt) &&
      /(вам не хватает|вы можете|вы заметили|вы испытываете|вы столкнулись|расскажите|вас задело)/i.test(
        prompt,
      ));

  if (!explicit) {
    return [
      violation(
        program,
        location,
        "no-address-you-block",
        `Промпт не содержит блок «ОБРАЩЕНИЕ» с явным правилом «ты»+контр-примером «вы» (кирпич А REFERENCE.md §5.0). Без него Gemini срывается на «вы» в 1 ответе из 3-4. Добавь явное «ВСЕГДА на «ты». НИКОГДА на «вы»» + списки ПРАВИЛЬНО/НЕПРАВИЛЬНО.`,
        severity,
      ),
    ];
  }
  return [];
}

/**
 * Правило #6 (урок Готтмана): в anonymous_system_prompt блок Д «СТРУКТУРА
 * ПЕРВОГО ОТВЕТА» требует **ОБЯЗАТЕЛЬНО назови концепт ... по имени**.
 */
function checkConceptByNameBlock(
  program: string,
  prompt: string | null,
): Violation[] {
  if (!prompt) return [];
  // Признак: слово «ОБЯЗАТЕЛЬНО» и в окрестности 200 символов — «по имени»
  const obligatoryIdx = prompt.search(/ОБЯЗАТЕЛЬНО/);
  if (obligatoryIdx === -1) {
    return [
      violation(
        program,
        "programs.anonymous_system_prompt",
        "anonymous-no-concept-by-name",
        "anonymous_system_prompt не содержит блок «СТРУКТУРА ПЕРВОГО ОТВЕТА» со словом «ОБЯЗАТЕЛЬНО» (кирпич Д REFERENCE.md §11.1). Без него AI на демо-чате отвечает общими словами без названия концепта книги. Добавь блок с явным требованием «ОБЯЗАТЕЛЬНО назови один из ключевых концептов книги по имени».",
      ),
    ];
  }
  const window = prompt.slice(obligatoryIdx, Math.min(obligatoryIdx + 300, prompt.length));
  if (!/по имени|концепт|принцип|по названию/i.test(window)) {
    return [
      violation(
        program,
        "programs.anonymous_system_prompt",
        "anonymous-concept-name-context",
        "anonymous_system_prompt содержит «ОБЯЗАТЕЛЬНО», но не в контексте «назови ... по имени» (кирпич Д). Привяжи требование к названию конкретного концепта/принципа книги.",
      ),
    ];
  }
  return [];
}

/**
 * Правило #7 (урок Готтмана): в anonymous_system_prompt блок Е «Quick replies —
 * КРИТИЧЕСКОЕ ПРАВИЛО» с контр-примером «без кавычек».
 */
function checkCriticalRuleBlock(
  program: string,
  prompt: string | null,
): Violation[] {
  if (!prompt) return [];
  const out: Violation[] = [];
  if (!/КРИТИЧЕСКОЕ ПРАВИЛО/.test(prompt)) {
    out.push(
      violation(
        program,
        "programs.anonymous_system_prompt",
        "anonymous-no-critical-rule",
        "anonymous_system_prompt не содержит подстроку «КРИТИЧЕСКОЕ ПРАВИЛО» — это признак блока Е (REFERENCE.md §11.1). Без блока AI выводит варианты простым текстом без кавычек, кнопок нет. Добавь блок «Quick replies — КРИТИЧЕСКОЕ ПРАВИЛО».",
      ),
    );
  }
  // Контр-пример «без кавычек — это НЕ кнопки» (или эквивалент)
  if (!/без кавычек|не \«ёлочк/i.test(prompt)) {
    out.push(
      violation(
        program,
        "programs.anonymous_system_prompt",
        "anonymous-no-without-quotes-counter",
        "anonymous_system_prompt не содержит контр-пример «без кавычек — это НЕ кнопки» (кирпич Е). Покажи Gemini что варианты без «ёлочек» — это plain-текст в сообщении, а не кликабельные кнопки.",
      ),
    );
  }
  return out;
}

/**
 * Правило #8 (урок Готтмана): landing_data.main_concepts — массив 5+ концептов
 * книги по имени. Используется в блоке Д anonymous_system_prompt.
 */
function checkMainConcepts(
  program: string,
  landing: Record<string, unknown> | null,
  anonymousPrompt: string | null,
): Violation[] {
  if (!landing) return [];
  const concepts = landing.main_concepts;
  if (!Array.isArray(concepts) || concepts.length === 0) {
    return [
      violation(
        program,
        "programs.landing_data.main_concepts",
        "landing-no-main-concepts",
        "landing_data.main_concepts отсутствует или пустой. Заполни массивом из 5-7 имён ключевых концептов книги — они используются в блоке Д anonymous_system_prompt. См. PLATFORM_MAP.md «main_concepts».",
        "warn",
      ),
    ];
  }
  if (concepts.length < 5) {
    return [
      violation(
        program,
        "programs.landing_data.main_concepts",
        "landing-main-concepts-too-few",
        `landing_data.main_concepts содержит ${concepts.length} концептов. Должно быть 5-7 (меньше — словарь концептов слабый, AI забывает).`,
        "warn",
      ),
    ];
  }
  // Каждый концепт должен встречаться в anonymous_system_prompt
  if (!anonymousPrompt) return [];
  const out: Violation[] = [];
  for (const concept of concepts) {
    if (typeof concept !== "string") continue;
    if (!anonymousPrompt.includes(concept)) {
      out.push(
        violation(
          program,
          "programs.anonymous_system_prompt",
          "anonymous-missing-main-concept",
          `Концепт "${concept}" из landing_data.main_concepts не встречается в anonymous_system_prompt. Перечисли все концепты явно в блоке Д «СТРУКТУРА ПЕРВОГО ОТВЕТА».`,
          "warn",
        ),
      );
    }
  }
  return out;
}

// --- Helpers + новые правила #9-#14 (после ретро 9 книг 2026-05) ---

/**
 * Парсит TS-файл, ищет объект `const NAME ... = { "key": ..., ... }` и
 * возвращает Set всех ключей. Используется для проверки наличия иконок.
 */
const iconMapCache = new Map<string, Set<string>>();
function readIconMapKeys(filePath: string, mapName: string): Set<string> {
  const cacheKey = `${filePath}::${mapName}`;
  const cached = iconMapCache.get(cacheKey);
  if (cached) return cached;
  let content: string;
  try {
    content = readFileSync(resolve(process.cwd(), filePath), "utf8");
  } catch (e) {
    console.warn(
      `⚠️ check-chat-seed: cannot read ${filePath} — пропускаем проверку иконок (${(e as Error).message})`,
    );
    const empty = new Set<string>();
    iconMapCache.set(cacheKey, empty);
    return empty;
  }
  // Ищем `const NAME ... = { ... }` (с учётом многострочного объекта).
  // Регекс не идеальный, но для текущих файлов работает: ловит блок до `\n}`.
  const blockRe = new RegExp(
    `(?:export\\s+)?const\\s+${mapName}\\b[\\s\\S]*?=\\s*\\{([\\s\\S]*?)\\n\\}`,
    "m",
  );
  const m = content.match(blockRe);
  const keys = new Set<string>();
  if (!m) {
    iconMapCache.set(cacheKey, keys);
    return keys;
  }
  const body = m[1];
  // Ключи объекта: `"foo":`, `'foo':`, `foo:` (без кавычек если без дефисов).
  const keyRe = /(?:^|\n|,)\s*(?:"([\w-]+)"|'([\w-]+)'|([\w]+))\s*:/g;
  let km: RegExpExecArray | null;
  while ((km = keyRe.exec(body)) !== null) {
    const key = km[1] ?? km[2] ?? km[3];
    if (key) keys.add(key);
  }
  iconMapCache.set(cacheKey, keys);
  return keys;
}

/**
 * Парсит docs/brand-glossary.md секцию «Запрещено в коде» и возвращает
 * массив запрещённых фраз с регексами. Источник истины: словарь бренда.
 */
interface BannedPhrase {
  pattern: RegExp;
  phrase: string;
  replacement: string;
}
let bannedPhrasesCache: BannedPhrase[] | null = null;
function loadBannedPhrases(): BannedPhrase[] {
  if (bannedPhrasesCache) return bannedPhrasesCache;
  let content: string;
  try {
    content = readFileSync(
      resolve(process.cwd(), "docs/brand-glossary.md"),
      "utf8",
    );
  } catch (e) {
    console.warn(
      `⚠️ check-chat-seed: cannot read docs/brand-glossary.md — пропускаем brand glossary check (${(e as Error).message})`,
    );
    bannedPhrasesCache = [];
    return bannedPhrasesCache;
  }
  // Находим секцию `## Запрещено в коде` до следующего `## ` или конца файла
  const sectionMatch = content.match(/## Запрещено в коде[\s\S]*?(?=\n## |\n*$)/);
  const result: BannedPhrase[] = [];
  const seen = new Set<string>();
  if (sectionMatch) {
    const section = sectionMatch[0];
    for (const line of section.split("\n")) {
      if (!line.startsWith("|") || /Фраза|---/.test(line)) continue;
      const cols = line
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      if (cols.length < 2) continue;
      const phraseCell = cols[0];
      const replacementCell = cols[1].replace(/`/g, "");
      const backtickRe = /`([^`]+)`/g;
      let pm: RegExpExecArray | null;
      while ((pm = backtickRe.exec(phraseCell)) !== null) {
        // Каждый бэктик-блок может содержать несколько вариантов через ` / `
        const variants = pm[1]
          .split("/")
          .map((v) => v.trim())
          .filter(Boolean);
        for (const variant of variants) {
          // Плейсхолдеры в скобках (`ИИ-<существительное>`) — отдельным regex ниже
          if (/<|>/.test(variant)) continue;
          // Слишком общие («ИИ», «AI» одиночные) — высокий риск false-positive
          if (variant === "ИИ" || variant === "AI") continue;
          if (seen.has(variant)) continue;
          seen.add(variant);
          const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          result.push({
            pattern: new RegExp(escaped, "g"),
            phrase: variant,
            replacement: replacementCell,
          });
        }
      }
    }
  }
  // Доп. регекс: «ИИ-<сущ.>» / «AI-<сущ.>» — паттерн, который не извлекается как литерал
  result.push({
    pattern: /\b(ИИ|AI)-[А-ЯA-Zа-яa-z][А-ЯA-Zа-яa-z]+/g,
    phrase: "ИИ-/AI-<существительное>",
    replacement: "Система",
  });
  bannedPhrasesCache = result;
  return bannedPhrasesCache;
}

// Поля, где «Книжный Спарринг» / «Институт Метаморфозы» допустимы (см. brand-glossary.md
// «Где «Книжный Спарринг» ЕДИНСТВЕННО допустим» и «Где допустимо «Институт Метаморфозы»»).
const BRAND_PHRASE_EXCEPTIONS: Record<string, Set<string>> = {
  "programs.meta_title": new Set(["Книжный Спарринг", "Институт Метаморфозы"]),
  "programs.meta_description": new Set([
    "Книжный Спарринг",
    "Институт Метаморфозы",
  ]),
};

function isBrandPhraseAllowed(location: string, phrase: string): boolean {
  // Точная локация
  if (BRAND_PHRASE_EXCEPTIONS[location]?.has(phrase)) return true;
  // Префиксная: landing_data.comparison.columns[*].name — допустим «Книжный Спарринг»
  if (
    /^programs\.landing_data\.comparison\.columns\[\d+\]\.name$/.test(location) &&
    phrase === "Книжный Спарринг"
  ) {
    return true;
  }
  return false;
}

/**
 * Правило #9 — иконки тем (error).
 * Для каждой program_themes.icon_key проверить, что есть в THEME_ICON_MAP
 * (components/icons/theme-icon-map.tsx). Без неё на хабе пустой кружок.
 */
function checkThemeIconExists(
  program: string,
  themeKey: string,
  iconKey: string | null,
  knownIcons: Set<string>,
): Violation[] {
  if (!iconKey) return [];
  if (knownIcons.size === 0) return []; // линтер не смог прочитать файл — не блокируем
  if (knownIcons.has(iconKey)) return [];
  return [
    violation(
      program,
      `program_themes[${themeKey}].icon_key`,
      "theme-icon-missing",
      `THEME_ICON_MAP в components/icons/theme-icon-map.tsx не содержит ключ "${iconKey}". На хабе будет пустой кружок вместо иконки темы. Добавь иконку: импортируй её и впиши в THEME_ICON_MAP. Прецеденты: 100-notes (2d9c20c0), heroes-and-outlaws (2505c4b4).`,
    ),
  ];
}

/**
 * Правило #10 — иконки режимов (warn).
 * Для каждого mode_template.icon, использованного в program_modes, проверить,
 * что есть в INSTRUMENT_ICON_MAP (components/hub/InstrumentList.tsx).
 */
function checkModeIconExists(
  program: string,
  modeKey: string,
  modeIcon: string | null,
  knownIcons: Set<string>,
): Violation[] {
  if (!modeIcon) return [];
  if (knownIcons.size === 0) return [];
  if (knownIcons.has(modeIcon)) return [];
  return [
    violation(
      program,
      `mode_templates[${modeKey}].icon`,
      "mode-icon-missing",
      `INSTRUMENT_ICON_MAP в components/hub/InstrumentList.tsx не содержит "${modeIcon}". Карточка инструмента на хабе будет без иконки. Либо добавь её, либо переиспользуй один из существующих ключей (pen, clock, check, book, chat, heart, users, compass, lightbulb, translate, drama, target, search, message-circle, book-open, map, sparkles, shield, unlock, rocket, lightning, flask, brain, layout, eraser).`,
      "warn",
    ),
  ];
}

/**
 * Правило #11 — фото автора реально на диске (warn).
 * Если landing_data.author.photo_url локальный — проверить через existsSync.
 * Прецедент: eq-2-0 (b266ac84+).
 */
function checkAuthorPhotoFile(
  program: string,
  landing: Record<string, unknown> | null,
): Violation[] {
  if (!landing) return [];
  const author = landing.author as Record<string, unknown> | undefined;
  const photoUrl = author?.photo_url as string | undefined;
  if (!photoUrl || !photoUrl.startsWith("/")) return [];
  const localPath = resolve(
    process.cwd(),
    "public",
    photoUrl.replace(/^\//, ""),
  );
  if (existsSync(localPath)) return [];
  return [
    violation(
      program,
      "programs.landing_data.author.photo_url",
      "author-photo-file-missing",
      `Файл фото автора ${photoUrl} не существует в public/. На лендинге будет broken image. Скачай файл в ${localPath} (≥100 КБ, ≥500×500 px) и проверь через npm run check:author-photos.`,
      "warn",
    ),
  ];
}

/**
 * Правило #12 — programs.hub_messages 3 обязательных ключа.
 * Без них на хабе пустой золотой кружок (вместо приветствия Системы).
 * Прецеденты: razgovorny-gipnoz, 100-notes (retroactive-тесты).
 */
function checkHubMessages(
  program: string,
  hubMessages: Record<string, string> | null,
  hasTest: boolean,
): Violation[] {
  const required = ["first", "returning_test", "returning_notest"] as const;
  if (
    !hubMessages ||
    typeof hubMessages !== "object" ||
    Object.keys(hubMessages).length === 0
  ) {
    return [
      violation(
        program,
        "programs.hub_messages",
        "hub-messages-missing",
        `programs.hub_messages пуст или null. Без 3 ключей (first, returning_test, returning_notest) на хабе будет пустой золотой кружок вместо приветствия Системы. См. PLATFORM_MAP.md «hub_messages».`,
        hasTest ? "error" : "warn",
      ),
    ];
  }
  const out: Violation[] = [];
  for (const key of required) {
    const value = hubMessages[key];
    if (!value || value.trim().length === 0) {
      const desc =
        key === "first"
          ? "Первое посещение хаба"
          : key === "returning_test"
            ? "Возврат на хаб после теста"
            : "Возврат на хаб без теста";
      out.push(
        violation(
          program,
          `programs.hub_messages.${key}`,
          "hub-messages-key-missing",
          `programs.hub_messages.${key} пуст. ${desc} → Система покажет пустое сообщение или fallback на другой ключ. Заполни конкретным приветствием с хуком про книгу.`,
          "warn",
        ),
      );
    }
  }
  return out;
}

/**
 * Правило #13 — test_system_prompt обязателен если features.test=true.
 * Без него app/api/test/route.ts отдаёт пустой контекст (есть `?? ""` fallback),
 * AI streaming text-answers идёт без понимания книги — качество резко падает.
 */
function checkTestSystemPromptFilled(
  program: string,
  features: Record<string, boolean> | null,
  testSystemPrompt: string | null,
): Violation[] {
  if (!features?.test) return [];
  if (testSystemPrompt && testSystemPrompt.trim().length > 0) return [];
  return [
    violation(
      program,
      "programs.test_system_prompt",
      "test-system-prompt-missing",
      `features.test=true, но programs.test_system_prompt пуст. AI streaming text-answers получит пустой контекст — качество интерпретации текстовых ответов резко падает. Заполни промптом про логику теста и книгу. См. PLATFORM_MAP.md §test_configs шаг 3.`,
    ),
  ];
}

/**
 * Правило #14 — brand glossary (warn).
 * Ловит запрещённые фразы из docs/brand-glossary.md в seed-полях программы.
 * Допустимые локации (meta_title/meta_description, comparison.columns[].name)
 * заданы в BRAND_PHRASE_EXCEPTIONS.
 */
function checkBrandPhrases(
  program: string,
  location: string,
  text: string | null,
  bannedPhrases: BannedPhrase[],
): Violation[] {
  if (!text || bannedPhrases.length === 0) return [];
  const out: Violation[] = [];
  for (const { pattern, phrase, replacement } of bannedPhrases) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (!match) continue;
    if (isBrandPhraseAllowed(location, phrase)) continue;
    if (isBrandPhraseAllowed(location, match[0])) continue;
    const start = Math.max(0, match.index - 20);
    const end = Math.min(text.length, match.index + match[0].length + 20);
    const excerpt = text.slice(start, end).replace(/\s+/g, " ");
    out.push(
      violation(
        program,
        location,
        "brand-banned-phrase",
        `Запрещённая фраза «${match[0]}» (см. docs/brand-glossary.md): «…${excerpt}…». Замени на «${replacement}».`,
        "warn",
      ),
    );
  }
  return out;
}

/**
 * Рекурсивный обход landing_data — собирает все string-значения с их JSON-path.
 * Используется для brand glossary check по полям лендинга.
 */
function collectLandingStrings(
  data: unknown,
  pathPrefix: string,
): Array<{ path: string; value: string }> {
  const out: Array<{ path: string; value: string }> = [];
  if (data == null) return out;
  if (typeof data === "string") {
    if (pathPrefix) out.push({ path: pathPrefix, value: data });
    return out;
  }
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      out.push(...collectLandingStrings(data[i], `${pathPrefix}[${i}]`));
    }
    return out;
  }
  if (typeof data === "object") {
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      out.push(
        ...collectLandingStrings(v, pathPrefix ? `${pathPrefix}.${k}` : k),
      );
    }
  }
  return out;
}

// --- Исполнитель ---

/**
 * Литерал `{{cross_mode_data}}` (или другой `{{...}}` placeholder) в system_prompt
 * полях. Эти placeholder'ы скопированы из шаблонов между книгами, но в коде
 * (`lib/chat/prepare-context.ts`) НЕТ замены — Gemini видит `{{cross_mode_data}}`
 * как буквальный текст. Кросс-режимные данные подмешиваются runtime'ом через
 * `appendCalibrationContext` / `appendPortraitContext` / `appendTestScores` —
 * placeholder не нужен.
 *
 * Прецедент: borba-za-vnimanie 2026-05. Placeholder есть также в seed-файлах
 * eq-2-0, mind-power, redecision-therapy, heroes-and-outlaws — массовая
 * копипаста.
 */
function checkCrossModeDataPlaceholder(
  program: string,
  location: string,
  text: string | null,
): Violation[] {
  if (!text) return [];
  if (!text.includes("{{cross_mode_data}}")) return [];
  return [
    violation(
      program,
      location,
      "cross-mode-data-placeholder",
      `${location}: содержит литерал \`{{cross_mode_data}}\` — placeholder не обрабатывается в коде, Gemini видит его буквально. Удали строку, runtime подмешивает кросс-режимные данные через appendCalibrationContext / appendPortraitContext / appendTestScores.`,
      "warn",
    ),
  ];
}

/**
 * Читает массив `CALIBRATION_CHAT_TYPES` из `lib/chat/prepare-context.ts`.
 * Возвращает Set строк chat_type, или null если файл не читается / массив не
 * нашёлся (тогда проверка `checkCalibrationWired` no-op).
 *
 * Парсим текстом, а не AST — нам достаточно ловить простой паттерн
 * `const CALIBRATION_CHAT_TYPES = ["...", "...", ...]`.
 */
function readCalibrationChatTypes(): Set<string> | null {
  const path = resolve(process.cwd(), "lib/chat/prepare-context.ts");
  let src: string;
  try {
    src = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  const m = src.match(/CALIBRATION_CHAT_TYPES\s*=\s*\[([^\]]*)\]/);
  if (!m) return null;
  const inner = m[1] ?? "";
  const types = new Set<string>();
  for (const sm of inner.matchAll(/["'`]([^"'`]+)["'`]/g)) {
    types.add(sm[1]);
  }
  return types;
}

/**
 * Если у программы есть `program_modes` с `chat_type` похожим на калибровку
 * (содержит подстроку `calibration`), и этот chat_type не упомянут в массиве
 * `CALIBRATION_CHAT_TYPES` в `lib/chat/prepare-context.ts` — `appendCalibrationContext()`
 * пропустит его при подмешивании контекста. Пользователь проходит калибровку,
 * но следующий режим её не видит — повторно представляется.
 *
 * Прецедент: borba-za-vnimanie 2026-05. Режим `belousov_calibration` создан с
 * бейджем «Сначала это» и маркером `[КАЛИБРОВКА ЗАВЕРШЕНА]` в финале, но
 * хардкод whitelist в коде содержал только `["pishi_calibration"]` — калибровка
 * стала декларативной.
 *
 * Backlog: вынести whitelist в БД-флаг (`mode_templates.is_calibration`) и
 * выпилить хардкод вместе с этой проверкой.
 */
function checkCalibrationWired(
  program: string,
  modeChatTypes: string[],
  knownTypes: Set<string> | null,
): Violation[] {
  if (knownTypes == null) return []; // файл не читается — no-op
  const out: Violation[] = [];
  for (const ct of modeChatTypes) {
    if (!ct) continue;
    if (!/calibration/i.test(ct)) continue;
    if (knownTypes.has(ct)) continue;
    out.push(
      violation(
        program,
        `program_modes[chat_type=${ct}]`,
        "calibration-not-wired",
        `chat_type "${ct}" похож на калибровку, но не добавлен в CALIBRATION_CHAT_TYPES в lib/chat/prepare-context.ts. Пройденная пользователем калибровка не подмешивается как контекст в следующий режим — функция appendCalibrationContext() фильтрует по этому массиву. Добавь "${ct}" в массив, либо переименуй chat_type если калибровкой не является.`,
        "warn",
      ),
    );
  }
  return out;
}

async function main() {
  const violations: Violation[] = [];

  // CLI: --book=<slug> — фильтр на одну книгу
  const bookArg = process.argv.find((a) => a.startsWith("--book="));
  const bookFilter = bookArg ? bookArg.slice("--book=".length) : null;
  // CLI: --legacy-relaxed — пропустить новые правила (4, 5, 6, 7, 8) для старых книг.
  // Новые правила добавлены после аудита seven-principles 2026-05.
  // Старые промпты могут срабатывать на эти правила — отдельный фикс по каждой книге.
  const legacyRelaxed = process.argv.includes("--legacy-relaxed");

  let programsQuery = supabase
    .from("programs")
    .select(
      "id, slug, title, system_prompt, anonymous_system_prompt, free_chat_welcome, author_chat_system_prompt, author_chat_welcome, anonymous_quick_replies, landing_data, features, hub_messages, test_system_prompt, meta_title, meta_description",
    );
  if (bookFilter) {
    programsQuery = programsQuery.eq("slug", bookFilter);
  }
  const { data: programs, error: pErr } = await programsQuery;
  if (pErr) {
    console.error("❌ failed to fetch programs:", pErr.message);
    process.exit(2);
  }
  if (bookFilter && (!programs || programs.length === 0)) {
    console.error(`❌ book not found: ${bookFilter}`);
    process.exit(2);
  }

  for (const p of (programs ?? []) as ProgramRow[]) {
    // programs уровень — базовые QR-блоки (правило #10 — кирпич В)
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

    // Правило `cross-mode-data-placeholder` (после ретро borba-za-vnimanie 2026-05):
    // литерал `{{cross_mode_data}}` в любом system_prompt — копипаста из шаблонов
    // других книг, в коде НЕТ обработчика, Gemini видит фигурные скобки буквально.
    violations.push(
      ...checkCrossModeDataPlaceholder(
        p.slug,
        "programs.system_prompt",
        p.system_prompt,
      ),
      ...checkCrossModeDataPlaceholder(
        p.slug,
        "programs.author_chat_system_prompt",
        p.author_chat_system_prompt,
      ),
      ...checkCrossModeDataPlaceholder(
        p.slug,
        "programs.anonymous_system_prompt",
        p.anonymous_system_prompt,
      ),
      ...checkCrossModeDataPlaceholder(
        p.slug,
        "programs.test_system_prompt",
        p.test_system_prompt,
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
    // anonymous_quick_replies — стартовые «ёлочки» демо-чата на лендинге.
    // Этот формат был слепой зоной линтера до 2026-05: новые программы заливали
    // [{text, type}], старые — массив строк. Компонент AnonymousChat падал на
    // объекте без нормализации (см. runbook «Диагностика живых багов»).
    // allowStrings=true — legacy-формат принимаем с warn, чтобы не ломать CI.
    violations.push(
      ...checkWelcomeReplies(
        p.slug,
        "programs.anonymous_quick_replies",
        p.anonymous_quick_replies,
        /* requireExit */ true,
        /* allowStrings */ true,
      ),
    );
    violations.push(...checkAuthorPhotoLocal(p.slug, p.landing_data));

    // Новые правила (после аудита seven-principles 2026-05).
    // Под --legacy-relaxed — пропускаем для старых книг, потому что они
    // могут срабатывать на старые промпты которые мы не правим.
    if (!legacyRelaxed) {
      // Правило #3 — HTML-теги в полях лендинга без поддержки разметки (warning)
      violations.push(...checkLandingHtmlInPlainFields(p.slug, p.landing_data));

      // Правило #4 — «Запрет приветствий» (кирпич Б).
      // anonymous_system_prompt — error (демо-чат — единственная точка касания до регистрации).
      // Остальные — warning.
      violations.push(
        ...checkNoGreetingsBlock(
          p.slug,
          "programs.anonymous_system_prompt",
          p.anonymous_system_prompt,
          "error",
        ),
      );
      violations.push(
        ...checkNoGreetingsBlock(
          p.slug,
          "programs.system_prompt",
          p.system_prompt,
          "warn",
        ),
      );
      violations.push(
        ...checkNoGreetingsBlock(
          p.slug,
          "programs.author_chat_system_prompt",
          p.author_chat_system_prompt,
          "warn",
        ),
      );

      // Правило #7 — «ОБРАЩЕНИЕ» с правилом «ты» (кирпич А).
      // anonymous — error, system — warning. author_chat исключение (автор сам формулирует).
      violations.push(
        ...checkAddressYouBlock(
          p.slug,
          "programs.anonymous_system_prompt",
          p.anonymous_system_prompt,
          "error",
        ),
      );
      violations.push(
        ...checkAddressYouBlock(
          p.slug,
          "programs.system_prompt",
          p.system_prompt,
          "warn",
        ),
      );

      // Правило #5 — «СТРУКТУРА ПЕРВОГО ОТВЕТА» с ОБЯЗАТЕЛЬНО+по имени (блок Д)
      violations.push(...checkConceptByNameBlock(p.slug, p.anonymous_system_prompt));

      // Правило #6 — «КРИТИЧЕСКОЕ ПРАВИЛО» + контр-пример «без кавычек» (блок Е)
      violations.push(...checkCriticalRuleBlock(p.slug, p.anonymous_system_prompt));

      // Правило #8 — main_concepts (warning)
      violations.push(
        ...checkMainConcepts(p.slug, p.landing_data, p.anonymous_system_prompt),
      );

      // Правило #11 — фото автора реально на диске (warn)
      violations.push(...checkAuthorPhotoFile(p.slug, p.landing_data));

      // Правило #12 — programs.hub_messages 3 обязательных ключа
      violations.push(
        ...checkHubMessages(
          p.slug,
          p.hub_messages,
          p.features?.test === true,
        ),
      );

      // Правило #13 — test_system_prompt обязателен если features.test=true
      violations.push(
        ...checkTestSystemPromptFilled(
          p.slug,
          p.features,
          p.test_system_prompt,
        ),
      );

      // Правило #14 — brand glossary по всем text-полям программы
      const bannedPhrases = loadBannedPhrases();
      violations.push(
        ...checkBrandPhrases(
          p.slug,
          "programs.system_prompt",
          p.system_prompt,
          bannedPhrases,
        ),
        ...checkBrandPhrases(
          p.slug,
          "programs.anonymous_system_prompt",
          p.anonymous_system_prompt,
          bannedPhrases,
        ),
        ...checkBrandPhrases(
          p.slug,
          "programs.author_chat_system_prompt",
          p.author_chat_system_prompt,
          bannedPhrases,
        ),
        ...checkBrandPhrases(
          p.slug,
          "programs.free_chat_welcome",
          p.free_chat_welcome,
          bannedPhrases,
        ),
        ...checkBrandPhrases(
          p.slug,
          "programs.author_chat_welcome",
          p.author_chat_welcome,
          bannedPhrases,
        ),
        ...checkBrandPhrases(
          p.slug,
          "programs.test_system_prompt",
          p.test_system_prompt,
          bannedPhrases,
        ),
        ...checkBrandPhrases(
          p.slug,
          "programs.meta_title",
          p.meta_title,
          bannedPhrases,
        ),
        ...checkBrandPhrases(
          p.slug,
          "programs.meta_description",
          p.meta_description,
          bannedPhrases,
        ),
      );
      // landing_data — рекурсивно по всем string-полям
      if (p.landing_data) {
        for (const { path, value } of collectLandingStrings(p.landing_data, "")) {
          violations.push(
            ...checkBrandPhrases(
              p.slug,
              `programs.landing_data.${path}`,
              value,
              bannedPhrases,
            ),
          );
        }
      }
    }
  }

  const programIds = ((programs ?? []) as ProgramRow[]).map((p) => p.id);

  // Загружаем карты иконок один раз — будут использованы в циклах ниже.
  // Если файл не читается (например в CI без полного чекаута) — knownIcons = empty,
  // проверки тогда no-op (не блокируют).
  const themeIcons = readIconMapKeys(
    "components/icons/theme-icon-map.tsx",
    "THEME_ICON_MAP",
  );
  const modeIcons = readIconMapKeys(
    "components/hub/InstrumentList.tsx",
    "INSTRUMENT_ICON_MAP",
  );

  // Загружаем массив CALIBRATION_CHAT_TYPES из lib/chat/prepare-context.ts —
  // нужен для правила calibration-not-wired (после ретро borba-za-vnimanie 2026-05).
  const knownCalibrationTypes = readCalibrationChatTypes();

  // program_modes уровень
  let modesQuery = supabase
    .from("program_modes")
    .select(
      "program_id, welcome_mode_label, welcome_title, welcome_subtitle, welcome_ai_message, welcome_message, welcome_replies, system_prompt, mode_template_id, mode_templates!inner(key, name, icon, chat_type)",
    );
  if (bookFilter && programIds.length) {
    modesQuery = modesQuery.in("program_id", programIds);
  }
  const { data: modes, error: mErr } = await modesQuery;
  if (mErr) {
    console.error("❌ failed to fetch program_modes:", mErr.message);
    process.exit(2);
  }

  const slugByProgramId = new Map<string, string>();
  for (const p of (programs ?? []) as ProgramRow[]) {
    slugByProgramId.set(p.id, p.slug);
  }

  // Map<programId, chat_types[]> — для правила calibration-not-wired (после цикла модов).
  const chatTypesByProgram = new Map<string, string[]>();

  for (const m of (modes ?? []) as unknown as Array<
    ModeRow & {
      mode_templates: {
        key: string;
        name: string;
        icon: string | null;
        chat_type: string | null;
      };
    }
  >) {
    const slug = slugByProgramId.get(m.program_id) ?? "unknown";
    const modeKey = m.mode_templates?.key ?? "unknown";
    const modeName = m.mode_templates?.name ?? null;
    const modeIcon = m.mode_templates?.icon ?? null;
    const modeChatType = m.mode_templates?.chat_type ?? null;
    const loc = `program_modes[${modeKey}]`;

    // Накапливаем chat_types для проверки calibration-not-wired ниже.
    if (modeChatType) {
      const arr = chatTypesByProgram.get(m.program_id) ?? [];
      arr.push(modeChatType);
      chatTypesByProgram.set(m.program_id, arr);
    }

    violations.push(
      ...checkBasicWelcomeFields(slug, loc, {
        welcome_mode_label: m.welcome_mode_label,
        welcome_title: m.welcome_title,
        welcome_subtitle: m.welcome_subtitle,
      }),
    );
    violations.push(
      ...checkWelcomeMessageExclusivity(
        slug,
        loc,
        m.welcome_message,
        m.welcome_ai_message,
      ),
    );
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
      // Правило cross-mode-data-placeholder для уровня режима (после ретро borba-za-vnimanie 2026-05)
      violations.push(
        ...checkCrossModeDataPlaceholder(
          slug,
          `${loc}.system_prompt`,
          m.system_prompt,
        ),
      );
    }

    // Новые правила (после аудита seven-principles 2026-05)
    if (!legacyRelaxed) {
      // Правило #1 — welcome_title не дублирует mode_templates.name (error)
      violations.push(
        ...checkTitleVsModeName(slug, loc, m.welcome_title, modeName),
      );

      // Правило #4 и #7 на уровне режима — warning (программные уровень важнее)
      if (m.system_prompt) {
        violations.push(
          ...checkNoGreetingsBlock(
            slug,
            `${loc}.system_prompt`,
            m.system_prompt,
            "warn",
          ),
        );
        violations.push(
          ...checkAddressYouBlock(
            slug,
            `${loc}.system_prompt`,
            m.system_prompt,
            "warn",
          ),
        );
      }

      // Правило #10 — иконка режима в INSTRUMENT_ICON_MAP (warn)
      violations.push(
        ...checkModeIconExists(slug, modeKey, modeIcon, modeIcons),
      );

      // Правило #14 — brand glossary в welcome-полях + system_prompt режима
      const bannedPhrases = loadBannedPhrases();
      violations.push(
        ...checkBrandPhrases(
          slug,
          `${loc}.welcome_ai_message`,
          m.welcome_ai_message,
          bannedPhrases,
        ),
        ...checkBrandPhrases(
          slug,
          `${loc}.welcome_title`,
          m.welcome_title,
          bannedPhrases,
        ),
        ...checkBrandPhrases(
          slug,
          `${loc}.welcome_subtitle`,
          m.welcome_subtitle,
          bannedPhrases,
        ),
        ...checkBrandPhrases(
          slug,
          `${loc}.system_prompt`,
          m.system_prompt,
          bannedPhrases,
        ),
      );
    }
  }

  // Правило calibration-not-wired (после цикла модов). Один вызов на программу.
  // Проверяет, что каждый chat_type содержащий "calibration" в любом режиме
  // программы упомянут в массиве CALIBRATION_CHAT_TYPES в lib/chat/prepare-context.ts.
  // Иначе пользователь проходит калибровку, но контекст не подмешивается в
  // следующий режим — повторно представляется. Прецедент: borba-za-vnimanie 2026-05.
  for (const p of (programs ?? []) as ProgramRow[]) {
    const chatTypes = chatTypesByProgram.get(p.id) ?? [];
    violations.push(
      ...checkCalibrationWired(p.slug, chatTypes, knownCalibrationTypes),
    );
  }

  // program_themes уровень
  let themesQuery = supabase
    .from("program_themes")
    .select(
      "program_id, key, icon_key, welcome_ai_message, welcome_replies, welcome_system_context",
    );
  if (bookFilter && programIds.length) {
    themesQuery = themesQuery.in("program_id", programIds);
  }
  const { data: themes, error: tErr } = await themesQuery;
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

    if (!legacyRelaxed) {
      // Правило #9 — иконка темы в THEME_ICON_MAP (error)
      violations.push(...checkThemeIconExists(slug, t.key, t.icon_key, themeIcons));

      // Правило #14 — brand glossary в welcome-полях темы
      const bannedPhrases = loadBannedPhrases();
      violations.push(
        ...checkBrandPhrases(
          slug,
          `${loc}.welcome_ai_message`,
          t.welcome_ai_message,
          bannedPhrases,
        ),
        ...checkBrandPhrases(
          slug,
          `${loc}.welcome_system_context`,
          t.welcome_system_context,
          bannedPhrases,
        ),
      );
    }
  }

  // test_configs уровень (правило #2 — группировка вопросов по шкалам)
  if (!legacyRelaxed) {
    let testsQuery = supabase
      .from("test_configs")
      .select("program_id, slug, questions, ui_config");
    if (bookFilter && programIds.length) {
      testsQuery = testsQuery.in("program_id", programIds);
    }
    const { data: tests, error: testErr } = await testsQuery;
    if (testErr) {
      // test_configs может отсутствовать в схеме — не критично, продолжаем
      console.warn("⚠️ check-chat-seed: cannot read test_configs (skipping):", testErr.message);
    } else {
      for (const tc of (tests ?? []) as TestConfigRow[]) {
        const slug = slugByProgramId.get(tc.program_id) ?? "unknown";
        violations.push(
          ...checkTestQuestionsGrouping(slug, tc.slug, tc.questions, tc.ui_config),
        );
      }
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
