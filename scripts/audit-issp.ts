/**
 * Одноразовый скрипт аудита ИССП-тестов.
 * Проверяет все пройденные тесты на корректность.
 *
 * Запуск: npx tsx scripts/audit-issp.ts
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { calculateISSP, type TestAnswer, type ScaleResult } from "../lib/issp-scoring";
import { ISSP_SCALE_ORDER, ISSP_SCALES } from "../lib/issp-config";

// --- Загрузка .env.local ---

function loadEnv(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, "utf-8");
  const env: Record<string, string> = {};
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
  return env;
}

const envPath = path.resolve(__dirname, "../.env.local");
const env = loadEnv(envPath);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Не найдены NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY в .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

// --- Утилиты ---

function icon(ok: boolean): string {
  return ok ? "✅" : "❌";
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

// --- Подсчёт подтверждений в чате (зеркало issp-parser.ts) ---

function countConfirmations(
  messages: { role: string; content: string }[]
): number {
  let count = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;

    // Паттерн 1: "Записываю как N"
    const zapisyvayu = [
      ...msg.content.matchAll(
        /[Зз]аписываю(?:\s+(?:первый|второй|третий|его|её|это|ответ(?:ы)?)\s+|\s+)как\s+(\d)/g
      ),
    ];
    if (zapisyvayu.length > 0) {
      for (const m of zapisyvayu) {
        const n = parseInt(m[1]);
        if (n >= 1 && n <= 5) count++;
      }
      continue; // как в парсере — если нашли "Записываю", не ищем "Принято"
    }

    // Паттерн 2: "Принято" — считаем числа 1-5 из предыдущего user-сообщения
    if (/[Пп]ринято/.test(msg.content)) {
      // Найти предыдущее user-сообщение
      let userContent = "";
      for (let j = i - 1; j >= 0; j--) {
        if (messages[j].role === "user") {
          userContent = messages[j].content;
          break;
        }
      }
      if (userContent) {
        const userNumbers = [...userContent.trim().matchAll(/\b([1-5])\b/g)];
        count += Math.max(userNumbers.length, 1);
      } else {
        count += 1;
      }
    }
  }

  return count;
}

// --- Поиск ИССП-балла в сообщениях AI ---

function findISSPInMessages(
  messages: { role: string; content: string }[]
): number | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "assistant") continue;
    const match = messages[i].content.match(/ИССП[:\s—–-]*(\d+)/);
    if (match) return parseInt(match[1]);
  }
  return null;
}

// --- Основная функция ---

async function audit() {
  console.log("=== АУДИТ ИССП-ТЕСТОВ ===\n");

  // 1. Загрузить все результаты
  const { data: results, error } = await supabase
    .from("test_results")
    .select("id, user_id, chat_id, total_score, total_raw, scores_by_scale, answers, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Ошибка загрузки test_results:", error.message);
    process.exit(1);
  }

  if (!results || results.length === 0) {
    console.log("Результатов тестов не найдено.");
    return;
  }

  console.log(`Найдено тестов: ${results.length}\n`);

  // Счётчики для итогов
  let totalTests = results.length;
  let scoreMatchCount = 0;
  let rawMatchCount = 0;
  let scalesMatchCount = 0;
  let answersCompleteCount = 0;
  let confirmationsOkCount = 0;
  let isspMsgMatchCount = 0;
  let missingAnswersTotal = 0;

  // 2. Проверить каждый результат
  for (let idx = 0; idx < results.length; idx++) {
    const r = results[idx];
    const answers = (r.answers || []) as TestAnswer[];
    const savedScales = (r.scores_by_scale || {}) as Record<string, ScaleResult>;
    const date = new Date(r.created_at).toLocaleDateString("ru-RU");

    console.log(`#${idx + 1} user=${shortId(r.user_id)} date=${date}`);

    // --- a) Полнота ответов ---
    const answerCount = answers.length;
    const answeredQs = new Set(answers.map((a) => a.q));
    const missingQs: number[] = [];
    for (let q = 1; q <= 35; q++) {
      if (!answeredQs.has(q)) missingQs.push(q);
    }
    const answersComplete = answerCount === 35 && missingQs.length === 0;
    if (answersComplete) answersCompleteCount++;
    missingAnswersTotal += missingQs.length;

    console.log(`  Ответов в БД: ${answerCount}/35 ${icon(answersComplete)}`);
    if (missingQs.length > 0) {
      console.log(`    Пропущены вопросы: ${missingQs.join(", ")}`);
    }

    // --- b) Пересчёт баллов ---
    let recalcScore = -1;
    let recalcRaw = -1;
    let scoreMatch = false;
    let rawMatch = false;
    let scalesMatch = true;

    if (answers.length > 0) {
      const recalc = calculateISSP(answers);
      recalcScore = recalc.totalScore;
      recalcRaw = recalc.totalRaw;
      scoreMatch = recalc.totalScore === r.total_score;
      rawMatch = recalc.totalRaw === r.total_raw;

      if (scoreMatch) scoreMatchCount++;
      if (rawMatch) rawMatchCount++;

      console.log(
        `  Серверный балл: ${r.total_score}/100 | Пересчёт: ${recalcScore}/100 ${icon(scoreMatch)}`
      );
      if (!scoreMatch || !rawMatch) {
        console.log(
          `    total_raw: saved=${r.total_raw} recalc=${recalcRaw} ${icon(rawMatch)}`
        );
      }

      // --- Шкалы ---
      console.log("  Шкалы:");
      let allScalesOk = true;
      for (const scale of ISSP_SCALE_ORDER) {
        const saved = savedScales[scale];
        const calc = recalc.scoresByScale[scale];
        const scaleName = ISSP_SCALES[scale]?.name || scale;

        if (!saved || !calc) {
          console.log(`    ${scale.padEnd(13)} — данные отсутствуют ❌`);
          allScalesOk = false;
          continue;
        }

        const match = saved.raw === calc.raw && saved.pct === calc.pct;
        if (!match) allScalesOk = false;

        console.log(
          `    ${scale.padEnd(13)} сохранено ${String(saved.raw).padStart(2)}/25 (${String(saved.pct).padStart(3)}%) | пересчёт ${String(calc.raw).padStart(2)}/25 (${String(calc.pct).padStart(3)}%) ${icon(match)}`
        );
      }
      scalesMatch = allScalesOk;
      if (scalesMatch) scalesMatchCount++;
    } else {
      console.log("  Пересчёт невозможен — нет ответов ❌");
    }

    // --- c) Подтверждения в чате ---
    const { data: messages } = await supabase
      .from("messages")
      .select("role, content")
      .eq("chat_id", r.chat_id)
      .order("created_at", { ascending: true });

    let confirmationCount = 0;
    let isspMsgScore: number | null = null;

    if (messages && messages.length > 0) {
      confirmationCount = countConfirmations(messages);
      isspMsgScore = findISSPInMessages(messages);
    }

    const confirmationsOk = confirmationCount === 35;
    if (confirmationsOk) confirmationsOkCount++;

    console.log(
      `  Подтверждения в чате: ${confirmationCount}/35 ${icon(confirmationsOk)}`
    );

    // --- d) ИССП в сообщении AI ---
    const isspMsgMatch = isspMsgScore !== null && isspMsgScore === r.total_score;
    if (isspMsgMatch) isspMsgMatchCount++;

    if (isspMsgScore !== null) {
      console.log(
        `  AI в чате написал: ИССП ${isspMsgScore}/100 ${icon(isspMsgMatch)}${!isspMsgMatch ? ` (saved: ${r.total_score})` : ""}`
      );
    } else {
      console.log("  AI в чате написал: ИССП не найдено ❌");
    }

    console.log("");
  }

  // 3. Итого
  console.log("=== ИТОГО ===");
  console.log(`Всего тестов:          ${totalTests}`);
  console.log(`Баллы совпадают:       ${scoreMatchCount}/${totalTests} ${icon(scoreMatchCount === totalTests)}`);
  console.log(`Raw совпадают:         ${rawMatchCount}/${totalTests} ${icon(rawMatchCount === totalTests)}`);
  console.log(`Шкалы совпадают:       ${scalesMatchCount}/${totalTests} ${icon(scalesMatchCount === totalTests)}`);
  console.log(`Ответов 35/35:         ${answersCompleteCount}/${totalTests} ${icon(answersCompleteCount === totalTests)}`);
  console.log(`Подтверждений 35:      ${confirmationsOkCount}/${totalTests} ${icon(confirmationsOkCount === totalTests)}`);
  console.log(`ИССП в чате верно:     ${isspMsgMatchCount}/${totalTests} ${icon(isspMsgMatchCount === totalTests)}`);
  console.log(`Пропущенных ответов:   ${missingAnswersTotal}`);

  const allPassed =
    scoreMatchCount === totalTests &&
    rawMatchCount === totalTests &&
    scalesMatchCount === totalTests &&
    answersCompleteCount === totalTests;

  console.log(
    `\n${allPassed ? "✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ" : "❌ ЕСТЬ РАСХОЖДЕНИЯ"}`
  );
}

audit().catch((err) => {
  console.error("Аудит завершился с ошибкой:", err);
  process.exit(1);
});
