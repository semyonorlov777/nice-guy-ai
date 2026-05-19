import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// PersonalizationService — User-level анкета (фича «Анкета на User-level»)
//
// Читает из public.user_profile_responses ответы пользователя на «якорные»
// вопросы (SPIN: context → problem → implication → need-payoff) и собирает
// текстовый блок для инжекции в system_prompt любого чата.
//
// Особенности:
//  - Идемпотентен: пока таблица пустая, возвращает '' и поведение не меняется.
//  - Версионность: для каждого question_id выбирается max(version) (DESC + first
//    wins). Поле confirmed_at не используется — оно для будущего cross-book
//    confirmation flow (R4 общего плана).
//  - Test-режимы (archetype-test, exam, …) пропускают soft-onboarding-директиву,
//    чтобы не сломать строгий скрипт скоринга.
//  - RLS защищает данные: SELECT-политика `user_id = auth.uid()`, поэтому
//    auth-клиент работает без service-role.
// ---------------------------------------------------------------------------

/** question_id-«якори», которые сервис умеет читать. Расширять — добавив тут. */
export const IDENTITY_QUESTION_IDS = [
  "context_intent",
  "problem",
  "implication",
  "need_payoff",
] as const;

export type IdentityQuestionId = (typeof IDENTITY_QUESTION_IDS)[number];

/** Партиальный набор identity-фактов. Пустой объект = анкета не заполнена. */
export type IdentityFacts = Partial<Record<IdentityQuestionId, string>>;

// Подстроки в chat_type, при которых soft-onboarding не подмешивается.
// Test/exam-режимы обязаны идти по строгому скрипту вопросов.
const TEST_LIKE_MODE_KEYWORDS = ["test", "exam", "archetype-test"];

/**
 * Читает последние версии ответов пользователя на «якорные» вопросы анкеты.
 *
 * Берёт max(version) per question_id без фильтра по confirmed_at: поле
 * confirmed_at относится к будущему cross-book confirmation flow и не блокирует
 * подхват свежезаполненной анкеты.
 *
 * Группировку делаем в JS (DISTINCT ON не поддерживается supabase-js, RPC
 * избыточно для 4 question_id × ~10 версий).
 *
 * @example
 * // Пользователь без анкеты:
 * await getFacts(supabase, "uuid-1") // → {}
 *
 * @example
 * // Пользователь с двумя версиями problem (v1=старая, v2=новая):
 * await getFacts(supabase, "uuid-1")
 * // → { problem: "новая формулировка" }
 */
export async function getFacts(
  supabase: SupabaseClient,
  userId: string,
): Promise<IdentityFacts> {
  const { data, error } = await supabase
    .from("user_profile_responses")
    .select("question_id, answer_text, version")
    .eq("user_id", userId)
    .in("question_id", [...IDENTITY_QUESTION_IDS])
    .order("version", { ascending: false });

  if (error) {
    console.error("[personalization] getFacts error:", error);
    return {};
  }

  const facts: IdentityFacts = {};
  for (const row of (data ?? []) as Array<{
    question_id: IdentityQuestionId;
    answer_text: string | null;
  }>) {
    const qid = row.question_id;
    const text = row.answer_text?.trim();
    if (text && !facts[qid]) {
      facts[qid] = text;
    }
  }
  return facts;
}

/**
 * Собирает SPIN-директиву (Problem → Implication → Need-payoff) для AI:
 * «если уместно, мягко выведи пользователя на ответ о ...».
 *
 * - Возвращает '' для test-режимов (modeChatType содержит test/exam/archetype-test):
 *   там AI работает по строгому скрипту, дозаспрос ломает скоринг.
 * - Возвращает '' если все три поля (problem/implication/need_payoff) заполнены.
 * - context_intent не участвует — его задаёт сама анкета при регистрации.
 *
 * @example
 * buildSoftOnboardingDirective({}, "free")
 * // → '...выведи на problem...\n...на implication...\n...на need_payoff...'
 *
 * @example
 * buildSoftOnboardingDirective(
 *   { problem: "x", implication: "y", need_payoff: "z" },
 *   "free",
 * )
 * // → ''
 *
 * @example
 * buildSoftOnboardingDirective({}, "archetype-test")
 * // → '' (test-режим — пропускаем)
 */
export function buildSoftOnboardingDirective(
  facts: IdentityFacts,
  modeChatType: string | undefined,
): string {
  if (modeChatType) {
    const lc = modeChatType.toLowerCase();
    if (TEST_LIKE_MODE_KEYWORDS.some((kw) => lc.includes(kw))) return "";
  }

  const directives: string[] = [];
  if (!facts.problem) {
    directives.push(
      "Если уместно по ходу разговора, мягко выведи пользователя на вопрос: что в его жизни/работе сейчас идёт не так?",
    );
  }
  if (!facts.implication) {
    directives.push(
      "Если problem уже услышан, выведи на: что произойдёт через 6–12 месяцев, если ничего не менять?",
    );
  }
  if (!facts.need_payoff) {
    directives.push(
      "Когда implication услышан, спроси: как пользователь поймёт, что программа сработала?",
    );
  }

  return directives.join("\n");
}

/**
 * Человекочитаемое представление identity-фактов. Опускает пустые поля.
 *
 * @example
 * formatFacts({ context_intent: "редактор", problem: "много правок" })
 * // → '- Контекст: редактор\n- Что не так: много правок'
 */
function formatFacts(facts: IdentityFacts): string {
  const lines: string[] = [];
  if (facts.context_intent) lines.push(`- Контекст: ${facts.context_intent}`);
  if (facts.problem) lines.push(`- Что не так: ${facts.problem}`);
  if (facts.implication)
    lines.push(`- Последствия, если не менять: ${facts.implication}`);
  if (facts.need_payoff)
    lines.push(`- Как поймём, что сработало: ${facts.need_payoff}`);
  return lines.join("\n");
}

/**
 * Главная функция сервиса: собирает блок текста для инжекции в system_prompt.
 *
 * Состоит из двух необязательных секций:
 *  - `## КТО ПЕРЕД ТОБОЙ` — identity_facts пользователя.
 *  - `## SOFT-ONBOARDING` — директивы, на какие вопросы AI должен мягко выводить.
 *
 * Возвращает '' если обе секции пустые (значит, инжекция не нужна).
 *
 * @example
 * // Пустая таблица + test-режим → '' (skip обеих секций):
 * await buildPersonalizationContext(supabase, "uuid-1", "archetype-test")
 * // → ''
 *
 * @example
 * // Пустая таблица + обычный режим → только soft-onboarding-блок:
 * await buildPersonalizationContext(supabase, "uuid-1", "free")
 * // → '## SOFT-ONBOARDING\n...'
 *
 * @example
 * // Заполнена анкета + обычный режим → identity_facts + (если есть пустые поля) soft:
 * await buildPersonalizationContext(supabase, "uuid-1", "free")
 * // → '## КТО ПЕРЕД ТОБОЙ\n- Контекст: …\n- Что не так: …\n\n## SOFT-ONBOARDING\n…'
 */
export async function buildPersonalizationContext(
  supabase: SupabaseClient,
  userId: string,
  modeChatType: string | undefined,
): Promise<string> {
  const facts = await getFacts(supabase, userId);
  const blocks: string[] = [];

  if (Object.keys(facts).length > 0) {
    blocks.push("## КТО ПЕРЕД ТОБОЙ\n" + formatFacts(facts));
  }

  const directive = buildSoftOnboardingDirective(facts, modeChatType);
  if (directive) {
    blocks.push("## SOFT-ONBOARDING\n" + directive);
  }

  return blocks.join("\n\n");
}
