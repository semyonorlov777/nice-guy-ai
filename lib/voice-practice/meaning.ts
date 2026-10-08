// Смысл реплики студента там, где от него зависит ход разбора. Переходы решаются по смыслу,
// а не по форме («любая фраза на шаге пробы — проба»): переспрос, сомнение и отказ пробой не считаются.
import { GoogleGenAI } from "@google/genai";
import { lowThinking, withModelFallback } from "./models";

/** attempt — фраза клиенту по существу; question — вопрос к ведущему или о том, что делать; hesitation — «не знаю, что сказать»; refusal — не хочет пробовать. */
export type ProbeMove = "attempt" | "question" | "hesitation" | "refusal";

const MOVES: ProbeMove[] = ["attempt", "question", "hesitation", "refusal"];
const TIMEOUT_MS = 5_000;

/** Запасной путь без модели: короткое, вопрос о процедуре или «не знаю» — не проба. */
function guess(line: string): ProbeMove {
  const t = line.toLowerCase().replace(/ё/g, "е").trim();
  const words = t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  if (/(не хочу|не буду|давайте без|пропуст)/u.test(t)) return "refusal";
  if (/(сейчас сказать|кому сказать|что (мне )?(сейчас )?(делать|говорить)|можно (я|еще)|повтори)/u.test(t)) return "question";
  if (/(не знаю|не могу придумать|сложно сказать)/u.test(t) && words < 8) return "hesitation";
  return words >= 4 ? "attempt" : "question";
}

/**
 * Проба в разборе: студенту предложили ответить клиенту иначе на его реплику clientLine.
 * Что он сделал на самом деле?
 */
export async function classifyProbe(p: { clientLine: string; studentLine: string; clientName: string }): Promise<ProbeMove> {
  const prompt = `Учебный разбор консультации. Студенту предложили сказать клиенту (${p.clientName}) новую фразу в ответ на реплику клиента: «${p.clientLine}».
Студент сказал: «${p.studentLine}».
Сначала проверь главное: есть ли в его словах фраза, обращённая к клиенту по существу (к ${p.clientName} или к «вам»/«тебе» о чувствах, ситуации, вопросе клиента)? Сомнения, «ну… не знаю» или переспрос ПЕРЕД такой фразой не важны — если она прозвучала, ответ attempt.
Ответь одним словом:
attempt — такая фраза клиенту прозвучала (даже неуклюже, с советом или после сомнений);
question — фразы клиенту нет, студент спрашивает ведущего, что делать, кому говорить, переспрашивает;
hesitation — фразы клиенту нет, студент сомневается вслух, не знает, что сказать;
refusal — студент отказывается пробовать.`;
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });
  const ask = withModelFallback(
    "gemini-2.5-flash",
    async (model) => {
      const r = await ai.models.generateContent({ model, contents: prompt, config: { temperature: 0, maxOutputTokens: 20, thinkingConfig: lowThinking(model) } });
      const word = (r.text ?? "").trim().toLowerCase();
      const move = MOVES.find((m) => word.startsWith(m));
      if (!move) throw new Error(`непонятный ответ: ${word}`);
      return move;
    },
    "voice-probe-meaning",
    ["gemini-3.8-flash"],
  ).then((r) => r.result);
  const timeout = new Promise<ProbeMove>((resolve) => setTimeout(() => resolve(guess(p.studentLine)), TIMEOUT_MS));
  return Promise.race([ask.catch(() => guess(p.studentLine)), timeout]);
}

/**
 * Зовёт ли наблюдатель студента прямо сейчас сказать фразу клиенту (начать пробу)?
 * Простое правило фраз отбирает кандидатов, здесь — проверка смысла: вопрос студенту
 * о клиенте («скажите, что вы почувствовали, когда Вера…») пробой не считается.
 */
export async function isProbeInvite(p: { observerText: string; clientName: string }): Promise<boolean> {
  const prompt = `Учебный разбор консультации. Наблюдатель сказал студенту: «${p.observerText}».
Зовёт ли наблюдатель студента прямо сейчас обратиться к клиенту (${p.clientName}) и сказать ему фразу, чтобы клиент ответил? Ответь одним словом: yes или no.
yes — например: «скажите это ${p.clientName}», «попробуйте сказать ей», «скажите эту фразу — она ответит».
no — вопрос самому студенту («скажите, что вы почувствовали», «как вы думаете…»), рассказ, вывод.`;
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });
  const ask = withModelFallback(
    "gemini-2.5-flash",
    async (model) => {
      const r = await ai.models.generateContent({ model, contents: prompt, config: { temperature: 0, maxOutputTokens: 10, thinkingConfig: lowThinking(model) } });
      const word = (r.text ?? "").trim().toLowerCase();
      if (!word.startsWith("yes") && !word.startsWith("no")) throw new Error(`непонятный ответ: ${word}`);
      return word.startsWith("yes");
    },
    "voice-probe-invite",
    ["gemini-3.8-flash"],
  ).then((r) => r.result);
  // Без ответа модели — верим правилу фраз (кандидат уже отобран им).
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(true), TIMEOUT_MS));
  return Promise.race([ask.catch(() => true), timeout]);
}
