export interface ISSPQuestion {
  q: number;
  scale: string;
  type: "direct" | "reverse";
  text: string;
}

export const ISSP_QUESTIONS: ISSPQuestion[] = [
  // Блок 1: Зависимость от одобрения (approval)
  { q: 1,  scale: "approval",    type: "direct",  text: "Когда кто-то из близких недоволен мной, мне трудно заниматься своими делами — я думаю об этом" },
  { q: 2,  scale: "approval",    type: "direct",  text: "Прежде чем высказать своё мнение, я сначала прикидываю, как на это отреагируют" },
  { q: 3,  scale: "approval",    type: "direct",  text: "Я ловлю себя на том, что подстраиваю поведение под конкретного человека — говорю то, что ему понравится, а не то, что думаю" },
  { q: 4,  scale: "approval",    type: "reverse", text: "Мне комфортно принимать решения, даже если они кому-то не нравятся" },
  { q: 5,  scale: "approval",    type: "reverse", text: "Если кто-то обижается на моё решение — я не бросаюсь это исправлять" },

  // Блок 2: Скрытые контракты (contracts)
  { q: 6,  scale: "contracts",   type: "direct",  text: "Когда я делаю что-то хорошее для человека, я втайне жду, что он это оценит" },
  { q: 7,  scale: "contracts",   type: "direct",  text: "Я чувствую обиду, когда мои усилия не замечают — хотя вслух об этом не говорю" },
  { q: 8,  scale: "contracts",   type: "direct",  text: "Когда я вкладываюсь в человека, а он не отвечает тем же — я чувствую, что это несправедливо" },
  { q: 9,  scale: "contracts",   type: "reverse", text: "Когда мне что-то нужно от человека, я прямо прошу, не надеясь, что он сам догадается" },
  { q: 10, scale: "contracts",   type: "reverse", text: "Если я помог кому-то, а он даже не сказал спасибо — меня это не задевает" },

  // Блок 3: Подавление потребностей и чувств (suppression)
  { q: 11, scale: "suppression", type: "direct",  text: "На вопрос «как дела?» я обычно отвечаю «нормально», даже если внутри всё сложно" },
  { q: 12, scale: "suppression", type: "direct",  text: "Мне проще помочь другому, чем попросить о помощи для себя" },
  { q: 13, scale: "suppression", type: "direct",  text: "Когда меня что-то задевает, я скорее промолчу и переварю это сам, чем скажу вслух" },
  { q: 14, scale: "suppression", type: "reverse", text: "Когда кто-то предлагает мне помощь или хочет сделать что-то приятное — я спокойно принимаю" },
  { q: 15, scale: "suppression", type: "reverse", text: "Я позволяю себе злиться, грустить или бояться — и не считаю это слабостью" },

  // Блок 4: Контроль и стратегии (control)
  { q: 16, scale: "control",     type: "direct",  text: "Мне сложно расслабиться, пока я не убедился, что всё идёт как надо — я мысленно прокручиваю, что может пойти не так" },
  { q: 17, scale: "control",     type: "direct",  text: "Когда ситуация выходит из-под контроля, я чувствую сильную тревогу" },
  { q: 18, scale: "control",     type: "direct",  text: "Я стараюсь делать всё «правильно» — и когда не получается, чувствую, что сам виноват" },
  { q: 19, scale: "control",     type: "reverse", text: "Когда происходит что-то неожиданное, я скорее думаю «разберёмся», чем пытаюсь срочно всё починить" },
  { q: 20, scale: "control",     type: "reverse", text: "Когда что-то идёт не по плану, я скорее адаптируюсь, чем паникую" },

  // Блок 5: Границы и ассертивность (boundaries)
  { q: 21, scale: "boundaries",  type: "direct",  text: "Я соглашаюсь на вещи, которые мне не подходят, чтобы не расстроить человека" },
  { q: 22, scale: "boundaries",  type: "direct",  text: "Бывает, что я соглашаюсь на просьбу, а потом жалею — но промолчал в момент, когда нужно было отказать" },
  { q: 23, scale: "boundaries",  type: "direct",  text: "Бывает, что я говорю не всю правду — не вру, просто умалчиваю, чтобы избежать конфликта" },
  { q: 24, scale: "boundaries",  type: "reverse", text: "Я говорю «нет» без чувства вины, когда это необходимо" },
  { q: 25, scale: "boundaries",  type: "reverse", text: "Я открыто говорю, если мне что-то не нравится в поведении близких людей" },

  // Блок 6: Мужская идентичность (masculinity)
  { q: 26, scale: "masculinity", type: "direct",  text: "В мужской компании я чувствую напряжение или неловкость — мне проще общаться с женщинами" },
  { q: 27, scale: "masculinity", type: "direct",  text: "Когда я замечаю в себе жёсткость, напористость или агрессию — мне становится некомфортно, я стараюсь это подавить" },
  { q: 28, scale: "masculinity", type: "direct",  text: "У меня нет близких друзей-мужчин, с которыми я могу говорить честно о себе" },
  { q: 29, scale: "masculinity", type: "reverse", text: "Мне нравятся качества, которые я получил от отца, — даже если не все из них идеальны" },
  { q: 30, scale: "masculinity", type: "reverse", text: "У меня есть мужчины, с которыми я могу быть полностью открытым" },

  // Блок 7: Отношения и привязанность (attachment)
  { q: 31, scale: "attachment",  type: "direct",  text: "Когда близкому мне человеку плохо, я не могу чувствовать себя хорошо — как будто не имею права" },
  { q: 32, scale: "attachment",  type: "direct",  text: "В отношениях я чаще уступаю и подстраиваюсь, чем настаиваю на своём" },
  { q: 33, scale: "attachment",  type: "direct",  text: "Мне трудно представить себя счастливым без отношений — одиночество пугает" },
  { q: 34, scale: "attachment",  type: "reverse", text: "Я могу быть счастлив независимо от состояния моих отношений" },
  { q: 35, scale: "attachment",  type: "reverse", text: "В близких отношениях я говорю о том, что мне не нравится, даже если это может привести к ссоре" },
];

export const ISSP_SCALES: Record<string, { name: string; exercises: number[] }> = {
  approval:    { name: "Зависимость от одобрения", exercises: [4, 5, 8] },
  contracts:   { name: "Скрытые контракты", exercises: [13, 14, 15] },
  suppression: { name: "Подавление потребностей и чувств", exercises: [9, 12, 20] },
  control:     { name: "Контроль и стратегии", exercises: [17, 18, 21] },
  boundaries:  { name: "Границы и ассертивность", exercises: [22, 23, 16] },
  masculinity: { name: "Мужская идентичность", exercises: [25, 28, 24] },
  attachment:  { name: "Отношения и привязанность", exercises: [30, 33, 34] },
};

export const ISSP_SCALE_ORDER = [
  "approval",
  "contracts",
  "suppression",
  "control",
  "boundaries",
  "masculinity",
  "attachment",
] as const;
