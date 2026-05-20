// ---------------------------------------------------------------------------
// Anketa questions catalogue — User-level анкета (3-й шаг фичи).
//
// Содержит вопросы анкеты для пилот-книги ('nice-guy'). Структура расширяется
// для других книг добавлением ключа в ANKETA_QUESTIONS. id вопросов жёстко
// типизирован как IdentityQuestionId из lib/personalization.ts — чтобы вопросы
// всегда матчили DB-схему и читались PersonalizationService.
// ---------------------------------------------------------------------------

import type { IdentityFacts, IdentityQuestionId } from "@/lib/personalization";

export type AnketaQuestionType = "hybrid" | "open_text";

export type AnketaQuestionOption = {
  value: string;
  /** Полный текст, который попадает в textarea и сохраняется в БД. */
  label: string;
  /** Короткий текст для чипа в UI; fallback к label если не задан. */
  chipLabel?: string;
};

export type AnketaQuestion = {
  id: IdentityQuestionId;
  type: AnketaQuestionType;
  title: string;
  help?: string;
  placeholder?: string;
  options?: AnketaQuestionOption[];
};

/** Программы, для которых сейчас определена анкета. Расширяется по мере подключения книг. */
export type AnketaProgramSlug = "nice-guy" | "pishi-sokraschay";

export const ANKETA_QUESTIONS: Record<AnketaProgramSlug, AnketaQuestion[]> = {
  "nice-guy": [
    {
      id: "context_intent",
      type: "hybrid",
      title: "Что привело тебя к этой книге?",
      options: [
        {
          value: "pleasing",
          label: "Я часто угождаю в отношениях, а потом коплю обиду",
          chipLabel: "угождаю и коплю обиду",
        },
        {
          value: "needs",
          label: "Мне сложно открыто заявлять о своих потребностях",
          chipLabel: "сложно говорить о потребностях",
        },
        {
          value: "authenticity",
          label: "Хочу научиться быть собой, а не «удобной версией»",
          chipLabel: "хочу быть собой",
        },
        {
          value: "boundaries",
          label: "Готовлюсь к разговору с партнёром / семьёй про границы",
          chipLabel: "готовлюсь к разговору про границы",
        },
      ],
      placeholder: "Например: устал быть «удобным» для всех…",
    },
    {
      id: "problem",
      type: "open_text",
      title: "Что в твоих отношениях или работе сейчас идёт не так?",
      help: "Где сам узнаёшь паттерн «славного парня»? Без оценок, как факт.",
      placeholder: "Например: соглашаюсь на дополнительные задачи, потом злюсь…",
    },
    {
      id: "need_payoff",
      type: "open_text",
      title: "Как ты поймёшь, что эта программа сработала?",
      help: "Что ты будешь делать или думать иначе?",
      placeholder: "Например: смогу сказать «нет» без чувства вины…",
    },
  ],
  "pishi-sokraschay": [
    {
      id: "context_intent",
      type: "hybrid",
      title: "Что у тебя болит с текстами?",
      help: "Выбери, что ближе всего, или напиши своими словами",
      options: [
        {
          value: "purpose",
          label: "Не понимаю, для кого и зачем пишу — додумываю в процессе",
          chipLabel: "не вижу цели",
        },
        {
          value: "thesis",
          label: "Получается водянисто — главное теряется среди деталей",
          chipLabel: "много воды",
        },
        {
          value: "structure",
          label: "Тексты длинные — не дочитывают, нет нормального заголовка",
          chipLabel: "не дочитывают",
        },
        {
          value: "style",
          label: "Канцелярит и штампы — хочу писать по-человечески",
          chipLabel: "канцелярит и штампы",
        },
      ],
      placeholder: "Например: пишу лендинги, но конверсия слабая…",
    },
    {
      id: "problem",
      type: "open_text",
      title: "Какие тексты пишешь и что не получается?",
      help: "Конкретно: кем работаешь, какие тексты, что застревает. Например, «не могу сократить отчёт для CEO» или «начинаю издалека».",
      placeholder: "Например: пишу письма клиентам, но они не отвечают…",
    },
    {
      id: "need_payoff",
      type: "open_text",
      title: "Как ты поймёшь, что программа сработала?",
      help: "Что будешь писать или делать иначе?",
      placeholder: "Например: смогу написать продающий лендинг за час без воды…",
    },
  ],
};

/** Type-guard для рантайма: можно ли работать с этим slug как с анкетной программой. */
export function isAnketaProgram(slug: string): slug is AnketaProgramSlug {
  return Object.prototype.hasOwnProperty.call(ANKETA_QUESTIONS, slug);
}

/** Все вопросы анкеты заполнены непустым ответом — анкета считается полной. */
export function isAnketaComplete(
  facts: IdentityFacts,
  slug: AnketaProgramSlug,
): boolean {
  const questions = ANKETA_QUESTIONS[slug];
  return questions.every((q) => {
    const value = facts[q.id];
    return typeof value === "string" && value.trim().length > 0;
  });
}

/** Анкета абсолютно пуста — ни одного ответа. Используется для CTA на хабе. */
export function isAnketaEmpty(facts: IdentityFacts): boolean {
  return Object.keys(facts).length === 0;
}
