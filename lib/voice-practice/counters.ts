// Счётчики речи студента — кодом, устойчиво и одинаково от сессии к сессии.
// \b в JS не работает на кириллице, поэтому границы слова — явными классами.

export interface TurnLite {
  seq: number;
  role: "student" | "client";
  text: string;
  t_start_ms: number | null;
  t_end_ms: number | null;
}

export interface CodeCounters {
  why_count: number;
  reassurance_cliches: number;
  advice_markers: number;
  evaluation_words: number;
  hidden_pressure: number;
  talk_share_student: number | null;
  student_turns: number;
  duration_sec: number;
  stage_markers: string[];
}

const W = "[^а-яёa-z0-9]";
const word = (s: string) => new RegExp(`(^|${W})(${s})(?=${W}|$)`, "giu");

const PATTERNS = {
  why: [word("почему"), word("зачем")],
  reassurance: [/вс[её] будет хорошо/giu, /вы справитесь/giu, /у вас вс[её] получится/giu, /не переживайте/giu, /не плачьте/giu, /не расстраивайтесь/giu],
  advice: [/вам нужно/giu, /вам надо/giu, /вам стоит/giu, /я бы на вашем месте/giu, /советую/giu, word("попробуйте")],
  evaluation: [word("правильно"), word("неправильно"), word("молодец"), /так нельзя/giu, /надо было/giu],
  pressure: [/вы всегда/giu, /вы же понимаете/giu, /как вы сами понимаете/giu],
};

const STAGE_MARKERS: [string, RegExp][] = [
  ["ожидания", /чего вы (ожидаете|ждёте|ждете|хотите от)/iu],
  ["рамка времени", /(минут|час)[а-я]* (у нас|есть)|у нас (сегодня )?(около |есть )?\d+|у нас (сегодня )?[а-я]+ минут/iu],
  ["пересказ с проверкой", /(правильно ли я (понимаю|понял)|если я правильно (понимаю|понял)|я правильно понимаю)/iu],
  ["запрос", /(что именно вы хотите (изменить|получить)|с чем (вы )?хотите (работать|разобраться))/iu],
  ["образ будущего", /(как вы поймёте|как вы поймете|что изменится|по чему вы поймёте)/iu],
  ["состояние в конце", /как вы (сейчас )?себя (сейчас )?чувствуете/iu],
];

function count(text: string, res: RegExp[]): number {
  return res.reduce((n, re) => n + (text.match(re)?.length ?? 0), 0);
}

export function computeCounters(turns: TurnLite[]): CodeCounters {
  const student = turns.filter((t) => t.role === "student");
  const text = student.map((t) => t.text).join("\n").toLowerCase();
  // Длительность реплик студента по меткам неточна (отметка ставится по окончании),
  // поэтому долю речи считаем по словам — устойчивее.
  const words = (ts: TurnLite[]) => ts.reduce((n, t) => n + t.text.split(/\s+/).filter(Boolean).length, 0);
  const sw = words(student);
  const all = words(turns);
  const last = turns.length ? Math.max(...turns.map((t) => t.t_end_ms ?? 0)) : 0;
  return {
    why_count: count(text, PATTERNS.why),
    reassurance_cliches: count(text, PATTERNS.reassurance),
    advice_markers: count(text, PATTERNS.advice),
    evaluation_words: count(text, PATTERNS.evaluation),
    hidden_pressure: count(text, PATTERNS.pressure),
    talk_share_student: all ? Math.round((sw / all) * 100) / 100 : null,
    student_turns: student.length,
    duration_sec: Math.round(last / 1000),
    stage_markers: STAGE_MARKERS.filter(([, re]) => re.test(text)).map(([name]) => name),
  };
}

/**
 * Сбои учебного клиента по расшифровке: вышел из роли, назвал себя человеком или
 * программой, назвал телефон или службу помощи, перешёл на латиницу. Студента
 * за это не оцениваем — такие сессии помечаются.
 */
export function computeClientFlags(turns: TurnLite[]): string[] {
  const text = turns.filter((t) => t.role === "client").map((t) => t.text).join("\n").toLowerCase();
  const flags: string[] = [];
  if (/я (ж[иы]вой|обычный|настоящий|реальный) человек|я не (программа|робот|ии)/iu.test(text)) flags.push("client_claims_human");
  if (/(искусственн[а-я]* интеллект|нейросет|языков[а-я]* модел|ассистент|gemini|google)/iu.test(text)) flags.push("client_ai_words");
  if (/(\b8[\s-]?800|телефон довери|горяч[а-я]* лини|112)/iu.test(text)) flags.push("client_phone_leak");
  if (/[a-z]{4,}/i.test(text.replace(/[^a-z\s]/gi, " "))) flags.push("client_latin");
  return flags;
}
