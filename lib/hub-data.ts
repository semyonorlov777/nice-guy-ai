export interface ThemeData {
  key: string;
  title: string;
  description: string;
}

/** 7 ISSP themes — display data for Hub theme cards */
export const ISSP_THEMES: ThemeData[] = [
  { key: "approval",    title: "Перестать угождать",       description: "Делать по-своему, даже если кто-то недоволен" },
  { key: "contracts",   title: "Не обижаться молча",       description: "Перестать ждать что другие догадаются" },
  { key: "suppression", title: "Вернуть свои потребности", description: "Разрешить себе хотеть — без вины" },
  { key: "control",     title: "Отпустить контроль",       description: "Перестать всё делать «правильно»" },
  { key: "boundaries",  title: "Говорить «нет»",          description: "Отказывать без вины и ставить границы" },
  { key: "masculinity", title: "Найти мужскую опору",      description: "Принять в себе силу, не стесняясь" },
  { key: "attachment",  title: "Быть собой в отношениях",  description: "Не растворяться в партнёре" },
];

/** Sort themes by test scores (highest first), fallback to default order */
export function getThemesOrdered(testScores?: Record<string, number> | null): ThemeData[] {
  if (!testScores) return ISSP_THEMES;

  return [...ISSP_THEMES].sort((a, b) => {
    const scoreA = testScores[a.key] ?? 0;
    const scoreB = testScores[b.key] ?? 0;
    return scoreB - scoreA; // highest score first
  });
}

export type HubState = "first" | "returning-test" | "returning-notest";

/** AI message text for each hub state */
export function getAIMessage(state: HubState): string {
  switch (state) {
    case "first":
      return "Привет! Я буду твоим проводником по этой книге. Начнём с короткого теста — <strong>7 минут, 35 вопросов</strong>. Он покажет, на какие темы стоит обратить внимание в первую очередь.";
    case "returning-test":
      return "На основе твоего профиля — <strong>границы</strong> и <strong>одобрение</strong> сейчас самые важные темы. Начни с того, что ближе.";
    case "returning-notest":
      return "Пройди тест — <strong>7 минут</strong>, и я подскажу, с какой темы лучше начать. А пока выбирай что откликается.";
  }
}
