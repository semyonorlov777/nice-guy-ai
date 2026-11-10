// Стенд проверки: свойства, которые считаются без модели — по расшифровке встречи и разбора.
// Круг 2 (10.2026): клиент говорит подряд в тишину, сам заговаривает о времени, ремарки вслух,
// совпадения с нашими текстами (не только кавычки), сбои записи слов студента; в разборе — служебное
// вслух, сорванная передача слова, оценочные слова, проба под диктовку, фраза, ушедшая наблюдателю,
// реакция клиента без ответа клиента.

export type Turn = { seq: number; role: string; text: string; segment?: number; t_start_ms?: number };

export const norm = (t: string) =>
  t.toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
export const wordsOf = (t: string) => norm(t).split(" ").filter(Boolean);

const said = (t: Turn) => /[\p{L}]/u.test(t.text);

// Служебные слова не делают совпадение «готовой фразой»: «я не знаю что» есть у любого человека.
const COMMON = new Set(
  "и в во не на я что как а но это то так с со же ли бы вы мне меня мы он она они ты у к по за из от до о об все всё уже еще ещё просто вот да нет ну если когда только даже очень там тут тоже себя себе был была было быть есть его ее её их ему ей им как-то".split(
    " ",
  ),
);

/** Четвёрки слов клиента, которые дословно есть в наших текстах (описание клиента, общие правила, разминка). */
function shinglesFrom(text: string, n: number, minRare = 2): Set<string> {
  const w = wordsOf(text);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) {
    const g = w.slice(i, i + n);
    if (g.filter((x) => !COMMON.has(x)).length < minRare) continue;
    out.add(g.join(" "));
  }
  return out;
}

export interface MeetingProps {
  /** Самая длинная серия реплик клиента без студента между ними. */
  maxClientRun: number;
  /** Сколько реплик клиент сказал «сверх одной» подряд — говорил в тишину. */
  clientExtraTurns: number;
  /** Клиент сам заговорил о времени встречи. */
  timeTalk: { seq: number; text: string }[];
  /** Ремарки вслух: скобки, звёздочки. */
  stageMarks: { seq: number; text: string }[];
  /** Дословно из наших текстов: четыре слова из общих правил или пять — из описания клиента (короткие факты роли — возраст, работа — сюда не попадают). */
  ourCopies: { seq: number; gram: string }[];
  /** Обороты клиента (три слова), звучащие в трёх и более репликах одной встречи, — выученная фраза. */
  selfRepeats: { gram: string; turns: number }[];
  /** Реплики студента с латиницей — сбой распознавания. */
  studentLatin: { seq: number; text: string }[];
  studentTurns: number;
}

const TIME_TALK =
  /(время (уже )?(подходит|вышло|заканчива|истека|на исходе|кончил)|мин(ута|уты|ут) (остал|прошл)|(к|под) концу встречи|встреча (подходит|заканчива))/iu;

export function meetingProps(turns: Turn[], ourTexts: { rules: string; client: string }): MeetingProps {
  const t = turns.filter(said);
  let run = 0;
  let maxClientRun = 0;
  let clientExtraTurns = 0;
  for (const x of t) {
    if (x.role === "client") {
      run += 1;
      if (run > 1) clientExtraTurns += 1;
      maxClientRun = Math.max(maxClientRun, run);
    } else if (x.role === "student") run = 0;
  }
  const client = t.filter((x) => x.role === "client");
  const rules4 = shinglesFrom(ourTexts.rules, 4);
  const client5 = shinglesFrom(ourTexts.client, 5);
  const ourCopies: MeetingProps["ourCopies"] = [];
  for (const x of client) {
    for (const g of shinglesFrom(x.text, 4)) if (rules4.has(g)) ourCopies.push({ seq: x.seq, gram: g });
    for (const g of shinglesFrom(x.text, 5)) if (client5.has(g)) ourCopies.push({ seq: x.seq, gram: g });
  }
  const gramTurns = new Map<string, Set<number>>();
  for (const x of client) for (const g of shinglesFrom(x.text, 3, 1)) gramTurns.set(g, (gramTurns.get(g) ?? new Set()).add(x.seq));
  const selfRepeats = [...gramTurns.entries()].filter(([, s]) => s.size >= 3).map(([gram, s]) => ({ gram, turns: s.size }));
  const student = t.filter((x) => x.role === "student");
  return {
    maxClientRun,
    clientExtraTurns,
    timeTalk: client.filter((x) => TIME_TALK.test(x.text)).map(({ seq, text }) => ({ seq, text })),
    stageMarks: client.filter((x) => /[*(\[]/.test(x.text)).map(({ seq, text }) => ({ seq, text })),
    ourCopies,
    selfRepeats,
    studentLatin: student.filter((x) => /[a-z]{2,}/i.test(x.text.replace(/\bTIPP\b/g, ""))).map(({ seq, text }) => ({ seq, text })),
    studentTurns: student.length,
  };
}

export interface DebriefProps {
  /** Наблюдатель или клиент произнёс служебную пометку. */
  systemAloud: { seq: number; text: string }[];
  /** Передача слова клиенту не состоялась: «Теперь — <имя>» звучало больше одного раза или этапа 2 нет. */
  handoverFailed: boolean;
  /** Оценочные слова наблюдателя («вы правы», «отлично», «именно так»…). */
  evaluative: { seq: number; text: string }[];
  /** Готовая фраза прозвучала до того, как студент попробовал сам. */
  dictatedFirst: boolean | null;
  /** Проба: студент повторил подсказку (общих слов ≥ 60%) или сказал своё. null — пробы не было. */
  probeOwnWords: boolean | null;
  /** Студент сказал фразу клиенту, но она ушла наблюдателю (этап 3, не 4). */
  phraseToObserver: { seq: number; text: string }[];
  /** Наблюдатель описал реакцию клиента, хотя клиент на последнюю фразу студента не отвечал. */
  reactionWithoutReply: { seq: number; text: string }[];
  reachedEnd: boolean;
}

// \b в JS работает только с латиницей — границы слова для кириллицы задаём явно.
const EVAL =
  /(?<!\p{L})(вы (совершенно |абсолютно |полностью )?прав[ыа]?|отлично|молодец|совершенно верно|именно так|вс[её] верно|верно|прекрасно|здорово|хорошо получилось|хорошо сработал[аио]?)(?!\p{L})/iu;
const SUGGEST = /(например|можно (было )?(бы )?сказать|можно так|скажите (это|так)?|попробуйте сказать)/iu;
const REACTION = /(после (этого|этой|этих|ваш)|ответил[аи]?|почувствовал[аи]?|перестал[аи]?|смог(ла)?|открыл(ась|ся)|отвел[аи]?|закрыл(ась|ся)|подтвердил[аи]?)/iu;

const overlap = (a: string, b: string) => {
  const wa = wordsOf(a).filter((x) => !COMMON.has(x));
  const wb = new Set(wordsOf(b).filter((x) => !COMMON.has(x)));
  if (!wa.length || !wb.size) return 0;
  return wa.filter((x) => wb.has(x)).length / wa.length;
};

/** Последняя цитата «…» от пяти слов в репликах наблюдателя — подсказанная фраза. */
function lastSuggestion(turns: Turn[], beforeIdx: number): string | null {
  for (let i = beforeIdx - 1; i >= 0; i--) {
    const x = turns[i];
    if (x.role !== "observer") continue;
    const qs = [...x.text.matchAll(/[«"„]([^»"“]{8,300})[»"“]/g)].map((m) => m[1]).filter((q) => wordsOf(q).length >= 5);
    if (qs.length && SUGGEST.test(x.text)) return qs[qs.length - 1];
  }
  return null;
}

/** writtenAlternative — готовая фраза письменного разбора: студент видит её на экране и может сказать, даже если наблюдатель её не диктовал. */
export function debriefProps(turns: Turn[], clientName: string, writtenAlternative?: string | null): DebriefProps {
  const t = turns.filter(said);
  const stem = norm(clientName).slice(0, Math.max(3, norm(clientName).length - 1));
  const systemAloud = t
    .filter((x) => x.role !== "student" && /(\[\s*система|система\s*:|студент сказал фразу клиенту|клиент ответил в роли)/iu.test(x.text))
    .map(({ seq, text }) => ({ seq, text }));
  const handoverRe = new RegExp(`теперь[\\s,—–-]{0,4}(слово[\\s—–-]{1,3})?${stem}`, "u");
  const handovers = t.filter((x) => x.role === "observer" && (x.segment ?? 1) === 1 && handoverRe.test(norm(x.text))).length;
  const hasSeg2 = t.some((x) => x.segment === 2);
  const evaluative = t.filter((x) => x.role === "observer" && EVAL.test(x.text)).map(({ seq, text }) => ({ seq, text }));

  const firstProbeIdx = t.findIndex((x) => x.segment === 4 && x.role === "student");
  const phraseToObserver: DebriefProps["phraseToObserver"] = [];
  const reactionWithoutReply: DebriefProps["reactionWithoutReply"] = [];
  let dictatedFirst: boolean | null = null;
  let probeOwnWords: boolean | null = null;

  // Фраза студента после подсказки, но на этапе 3 — клиент её не слышал.
  for (let i = 0; i < t.length; i++) {
    const x = t[i];
    if (x.role !== "student" || x.segment !== 3) continue;
    const sug = lastSuggestion(t, i);
    const near = (q: string | null | undefined) => !!q && overlap(x.text, q) >= 0.5;
    if ((near(sug) || near(writtenAlternative)) && wordsOf(x.text).length >= 4) {
      phraseToObserver.push({ seq: x.seq, text: x.text });
      const next = t.slice(i + 1).find((y) => y.role === "observer");
      if (next && REACTION.test(next.text)) reactionWithoutReply.push({ seq: next.seq, text: next.text });
    }
  }
  // Проба без ответа клиента, а наблюдатель описывает реакцию.
  for (let i = 0; i < t.length; i++) {
    const x = t[i];
    if (x.role !== "student" || x.segment !== 4) continue;
    const after = t.slice(i + 1);
    const nextNonStudent = after.find((y) => y.role !== "student");
    if (nextNonStudent && nextNonStudent.role === "observer" && REACTION.test(nextNonStudent.text))
      reactionWithoutReply.push({ seq: nextNonStudent.seq, text: nextNonStudent.text });
  }
  const attemptIdx = firstProbeIdx >= 0 ? firstProbeIdx : t.findIndex((x) => x.seq === phraseToObserver[0]?.seq);
  if (attemptIdx >= 0) {
    const sug = lastSuggestion(t, attemptIdx);
    dictatedFirst = sug !== null;
    probeOwnWords = sug ? overlap(t[attemptIdx].text, sug) < 0.6 : true;
  }
  return {
    systemAloud,
    handoverFailed: handovers > 1 || (!hasSeg2 && handovers > 0),
    evaluative,
    dictatedFirst,
    probeOwnWords,
    phraseToObserver,
    reactionWithoutReply,
    reachedEnd: t.some((x) => x.role === "observer" && /разбор (окончен|закончен|завершен)/iu.test(x.text)),
  };
}
