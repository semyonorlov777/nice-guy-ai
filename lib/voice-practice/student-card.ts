// Карточка студента: что было на его прошлой встрече — его собственный вывод из голосового разбора
// и фокус письменного. Разбор новой встречи начинает с проверки прошлого вывода и называет рост.
import type { SupabaseClient } from "@supabase/supabase-js";
import { reflectionFromTurns, loadDebriefTurns, type DebriefScriptState } from "./debrief-voice";

export interface StudentCard {
  /** Сколько встреч (полных и трудных моментов) студент провёл до этой. */
  meetingsBefore: number;
  previous: {
    /** Дата прошлой встречи (ГГГГ-ММ-ДД). */
    date: string;
    /** Его вывод «что возьмёте в следующую встречу» — его словами, из голосового разбора. */
    takeaway: string | null;
    /** Фокус письменного разбора прошлой встречи. */
    focus: string | null;
  } | null;
}

/** Прошлая завершённая встреча того же студента (до встречи beforeId). */
export async function loadStudentCard(db: SupabaseClient, userId: string, beforeId: string): Promise<StudentCard> {
  const { data: cur } = await db.from("voice_sessions").select("created_at").eq("id", beforeId).maybeSingle();
  if (!cur) return { meetingsBefore: 0, previous: null };
  const { data: prev, count } = await db
    .from("voice_sessions")
    .select("id, created_at", { count: "exact" })
    .eq("user_id", userId)
    .in("kind", ["full", "drill"])
    .eq("status", "ended")
    .lt("created_at", cur.created_at)
    .order("created_at", { ascending: false })
    .limit(1);
  const last = prev?.[0];
  if (!last) return { meetingsBefore: count ?? 0, previous: null };
  const [{ data: written }, { data: voice }] = await Promise.all([
    db.from("voice_debriefs").select("summary").eq("session_id", last.id).maybeSingle(),
    db.from("voice_sessions").select("id, script_state").eq("parent_session_id", last.id).eq("kind", "debrief").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const takeaway = voice ? reflectionFromTurns(await loadDebriefTurns(db, voice.id), voice.script_state as DebriefScriptState | null).takeaway : null;
  return {
    meetingsBefore: count ?? 0,
    previous: { date: String(last.created_at).slice(0, 10), takeaway, focus: (written?.summary as string | null) ?? null },
  };
}

/** Строка для инструкций разбора; null — прошлой встречи нет или сказать нечего. */
export function studentCardText(card: StudentCard): string | null {
  const p = card.previous;
  if (!p || (!p.takeaway && !p.focus)) return null;
  return [
    `ПРОШЛАЯ ВСТРЕЧА СТУДЕНТА (${p.date}, НЕ эта встреча и НЕ этот разбор; всего встреч до этой: ${card.meetingsBefore}):`,
    p.takeaway ? `— его вывод В ПРОШЛЫЙ РАЗ: «${p.takeaway}» (в итоге этого разбора «Вы сами сказали…» — только его слова из этого разбора, не этот прошлый вывод)` : null,
    p.focus ? `— фокус прошлого разбора: ${p.focus}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
