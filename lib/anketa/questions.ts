// ---------------------------------------------------------------------------
// Anketa questions catalogue — User-level анкета (3-й шаг фичи).
//
// Содержит вопросы анкеты для пилот-книги ('nice-guy'). Структура расширяется
// для других книг добавлением ключа в ANKETA_QUESTIONS. id вопросов жёстко
// типизирован как IdentityQuestionId из lib/personalization.ts — чтобы вопросы
// всегда матчили DB-схему и читались PersonalizationService.
// ---------------------------------------------------------------------------

import type { IdentityFacts, IdentityQuestionId } from "@/lib/personalization";

/**
 * Подписи для identity-фактов в UI (портрет, будущие точки отображения
 * анкеты). Один источник истины — чтобы заголовки блоков не расходились
 * между portrait-страницей и portrait-updater'ом, который форматирует
 * анкету в текстовый блок для Gemini Pro.
 */
export const IDENTITY_FACT_LABELS: Record<IdentityQuestionId, string> = {
  context_intent: "Что привело",
  problem: "Что сейчас не так",
  implication: "Если не менять",
  need_payoff: "К чему идём",
};

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
export type AnketaProgramSlug =
  | "nice-guy"
  | "pishi-sokraschay"
  | "the-choice"
  | "heroes-and-outlaws"
  | "seven-habits"
  | "borba-za-vnimanie"
  | "scorecard-marketing";

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
  "the-choice": [
    {
      id: "context_intent",
      type: "hybrid",
      title: "Что привело тебя к этой книге?",
      help: "Выбери, что ближе всего, или скажи своими словами",
      options: [
        {
          value: "past",
          label: "Прошлое не отпускает — травма, обиды, события, которые до сих пор болят",
          chipLabel: "прошлое не отпускает",
        },
        {
          value: "patterns",
          label: "Замечаю одни и те же паттерны — снова и снова попадаю в ту же ловушку",
          chipLabel: "одни и те же паттерны",
        },
        {
          value: "victimhood",
          label: "Чувствую себя жертвой обстоятельств — нет внутренней свободы",
          chipLabel: "чувствую себя жертвой",
        },
        {
          value: "meaning",
          label: "Ищу смысл и опору — после потери или большого изменения",
          chipLabel: "ищу смысл и опору",
        },
      ],
      placeholder: "Например: после развода не могу прийти в себя…",
    },
    {
      id: "problem",
      type: "open_text",
      title: "Где сейчас ощущаешь несвободу?",
      help: "Конкретная ситуация — в отношениях, в работе, в голове. Без оценок, просто как факт.",
      placeholder: "Например: возвращаюсь мыслями к одной и той же сцене из детства…",
    },
    {
      id: "need_payoff",
      type: "open_text",
      title: "Как ты поймёшь, что эта книга помогла?",
      help: "Что ты будешь думать или чувствовать иначе?",
      placeholder: "Например: смогу простить — не за то, что случилось, а ради своей свободы…",
    },
  ],
  "heroes-and-outlaws": [
    {
      id: "context_intent",
      type: "hybrid",
      title: "Зачем тебе разбираться в архетипах?",
      help: "Выбери, что ближе всего, или напиши своими словами",
      options: [
        {
          value: "own_brand",
          label: "Разбираюсь в архетипах для своего бренда или бизнеса",
          chipLabel: "свой бренд",
        },
        {
          value: "client_brand",
          label: "Работаю с клиентскими брендами — агентство или фриланс",
          chipLabel: "клиентский брендинг",
        },
        {
          value: "personal_brand",
          label: "Строю личный бренд и хочу найти свой архетип",
          chipLabel: "личный бренд",
        },
        {
          value: "understand_clients",
          label: "Хочу понимать клиентов и аудиторию через архетипы",
          chipLabel: "понимать клиентов",
        },
      ],
      placeholder: "Например: у меня студия дизайна, хочу выделиться из массы…",
    },
    {
      id: "problem",
      type: "open_text",
      title: "Что сейчас не получается с архетипами?",
      help: "Конкретная боль: «бренд звучит как все», «не могу выбрать между двумя», «не знаю как применить на сайте». Пиши своими словами.",
      placeholder: "Например: студия дизайна, коммуникации сухие, без характера…",
    },
    {
      id: "need_payoff",
      type: "open_text",
      title: "Как ты поймёшь, что программа сработала?",
      help: "Что будешь делать или думать иначе?",
      placeholder: "Например: смогу написать манифест бренда за час без воды…",
    },
  ],
  "seven-habits": [
    {
      id: "context_intent",
      type: "hybrid",
      title: "Что привело тебя к этой книге?",
      options: [
        {
          value: "overwhelm",
          label: "Я постоянно в авралах — много дел, мало результата",
          chipLabel: "много дел, мало результата",
        },
        {
          value: "reactive",
          label: "Меня выбивают из колеи внешние обстоятельства — реагирую, а не действую",
          chipLabel: "реагирую, а не действую",
        },
        {
          value: "purpose",
          label: "Делаю много, но не понимаю — зачем; нет ясности целей",
          chipLabel: "нет ясности целей",
        },
        {
          value: "relationships",
          label: "В близких отношениях или на работе мы не понимаем друг друга",
          chipLabel: "не понимаем друг друга",
        },
      ],
      placeholder: "Например: устал тушить пожары и хочу планомерности…",
    },
    {
      id: "problem",
      type: "open_text",
      title: "Что в твоей жизни сейчас идёт не так?",
      help: "Конкретная ситуация, в которой ты узнаёшь паттерн неэффективности. Без оценок, как факт.",
      placeholder: "Например: на работе всё горит, а дома не могу остановиться…",
    },
    {
      id: "need_payoff",
      type: "open_text",
      title: "Как ты поймёшь, что эта программа сработала?",
      help: "Что ты будешь делать или решать иначе через 4–6 недель?",
      placeholder: "Например: смогу планировать неделю заранее, а не реагировать день за днём…",
    },
  ],
  "borba-za-vnimanie": [
    {
      id: "context_intent",
      type: "hybrid",
      title: "Зачем ты пришёл к этой книге?",
      help: "Выбери, что ближе всего, или скажи своими словами",
      options: [
        {
          value: "income",
          label: "Хочу пробить потолок дохода — буксую на одном уровне",
          chipLabel: "пробить потолок дохода",
        },
        {
          value: "drive",
          label: "Делаю много, но без огня — нет драйва от того, чем занимаюсь",
          chipLabel: "нет драйва",
        },
        {
          value: "point_b",
          label: "Не вижу свою точку Б — куда расти и зачем",
          chipLabel: "не вижу точку Б",
        },
        {
          value: "reading_people",
          label: "Хочу читать людей — для переговоров, продаж, разговоров",
          chipLabel: "читать людей",
        },
      ],
      placeholder: "Например: маркетолог, хочу выйти на свою практику…",
    },
    {
      id: "problem",
      type: "open_text",
      title: "Где сейчас застрял?",
      help: "Конкретно: доход / отношения / здоровье / работа. Без оценок, как факт — что есть.",
      placeholder: "Например: беру проекты, которые меня не драйвят, но не отказываюсь — страшно…",
    },
    {
      id: "need_payoff",
      type: "open_text",
      title: "Как ты поймёшь, что программа сработала?",
      help: "Что будешь делать или думать иначе через 3–6 месяцев?",
      placeholder: "Например: отказываюсь от клиентов, которые меня тянут вниз — без вины…",
    },
  ],
  "scorecard-marketing": [
    {
      id: "context_intent",
      type: "hybrid",
      title: "Зачем тебе скоркард-маркетинг?",
      help: "Выбери, что ближе всего, или скажи своими словами",
      options: [
        {
          value: "own_lead_gen",
          label: "Свой бизнес — нужны квалифицированные лиды без впаривания",
          chipLabel: "лиды для своего бизнеса",
        },
        {
          value: "scaling_existing",
          label: "Масштабирую существующий funnel — хочу автоматизировать продажи",
          chipLabel: "масштабирую funnel",
        },
        {
          value: "agency_for_clients",
          label: "Агентство — собираю скоркарды для клиентов",
          chipLabel: "агентство",
        },
        {
          value: "expert_author",
          label: "Эксперт или автор — есть аудитория, не хватает моста к продажам",
          chipLabel: "эксперт / автор",
        },
      ],
      placeholder: "Например: коуч, делаю контент в LinkedIn, конверсии слабые…",
    },
    {
      id: "problem",
      type: "open_text",
      title: "Что сейчас не работает в лидгене?",
      help: "Конкретно: какие лиды приходят, что с конверсией, где отвал. Без оценок, как факт.",
      placeholder: "Например: подписки есть, но на discovery call записывается 1 из 50…",
    },
    {
      id: "need_payoff",
      type: "open_text",
      title: "Как ты поймёшь, что программа сработала?",
      help: "Что будет в твоём бизнесе через 3-6 месяцев после собранного скоркарда?",
      placeholder: "Например: каждую неделю 10 квалифицированных discovery-звонков без холодных…",
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
