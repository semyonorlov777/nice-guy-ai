/**
 * Самоотчёты студента практикума: анкета первого входа и уверенность до/после.
 * Только константы и чистые функции — подключается и на сервере, и в браузере.
 * Хранение — таблица voice_self_reports (kind, day по Москве, answers, sum).
 */

export type FearKey = "freeze" | "tears" | "doubt" | "harm";

export interface AnketaQuestion {
  key: "context_intent" | "problem" | "need_payoff";
  title: string;
  options: { text: string; fear?: FearKey }[];
  placeholder: string;
}

export const ANKETA_QUESTIONS: AnketaQuestion[] = [
  {
    key: "context_intent",
    title: "Где вы сейчас в обучении?",
    options: [
      { text: "Только начал(а), практики в парах ещё не было" },
      { text: "Уже были встречи в парах" },
      { text: "Готовлюсь к защите учебных консультаций" },
      { text: "Уже консультирую, хочу укрепить навык" },
    ],
    placeholder: "Или напишите своими словами",
  },
  {
    key: "problem",
    title: "Чего вы больше всего опасаетесь в разговоре с клиентом?",
    options: [
      { text: "Замереть и не знать, что сказать", fear: "freeze" },
      { text: "Слёз или сильных чувств клиента", fear: "tears" },
      { text: "Что клиент разозлится или усомнится во мне", fear: "doubt" },
      { text: "Навредить или не помочь", fear: "harm" },
    ],
    placeholder: "Или напишите своими словами",
  },
  {
    key: "need_payoff",
    title: "Как вы поймёте, что практикум сработал?",
    options: [
      { text: "Проведу первую консультацию без дрожи в голосе" },
      { text: "Буду знать, что сказать в первые минуты" },
      { text: "Перестану давать советы" },
    ],
    placeholder: "Или напишите своими словами",
  },
];

/** Три утверждения уверенности (0–10). Порядок = ключи c1, c2, c3. */
export const CONFIDENCE_ITEMS = [
  "Я смогу начать консультацию и прояснить ожидания клиента",
  "Я выдержу слёзы или злость клиента, не теряясь",
  "Я не дам совет, когда клиент настойчиво его просит",
] as const;

export const CONFIDENCE_KEYS = ["c1", "c2", "c3"] as const;
export type ConfidenceAnswers = Record<(typeof CONFIDENCE_KEYS)[number], number>;

export const MAX_ANSWER_LENGTH = 300;

/** Страх по тексту ответа: совпадение с чипом. Своё поле — без рекомендации. */
export function fearFromProblem(problem: string | null | undefined): FearKey | null {
  if (!problem) return null;
  const q = ANKETA_QUESTIONS.find((x) => x.key === "problem");
  return q?.options.find((o) => o.text === problem.trim())?.fear ?? null;
}

/** Рекомендация первого режима по страху: что сказать и куда вести. */
export function recommendationForFear(fear: FearKey | null): { line: string; path: string } | null {
  switch (fear) {
    case "freeze":
      return {
        line: "Вы написали, что опасаетесь замереть. Начните с «Первых минут»: одна задача — установить контакт и прояснить ожидания клиента.",
        path: "/voice/first-minutes",
      };
    case "tears":
      return {
        line: "Вы написали, что опасаетесь слёз клиента. Попробуйте «Трудный момент: слёзы» — одна реплика клиента и один ваш ответ.",
        path: "/voice/hard-moments?moment=tears",
      };
    case "doubt":
      return {
        line: "Вы написали, что опасаетесь сомнений клиента в вас. Попробуйте «Трудный момент: Вы ещё учитесь?» — одна реплика клиента и один ваш ответ.",
        path: "/voice/hard-moments?moment=student",
      };
    case "harm":
      return {
        line: "Вы написали, что опасаетесь навредить. Начните с «Первой встречи»: десять минут с учебным клиентом, без спешки.",
        path: "/voice/first-meeting",
      };
    default:
      return null;
  }
}

/** Проверка ответов уверенности: три целых 0–10. */
export function parseConfidence(raw: unknown): ConfidenceAnswers | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out = {} as ConfidenceAnswers;
  for (const k of CONFIDENCE_KEYS) {
    const v = o[k];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 10) return null;
    out[k] = v;
  }
  return out;
}
