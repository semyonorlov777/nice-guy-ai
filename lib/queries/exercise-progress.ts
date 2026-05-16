import type { SupabaseClient } from "@supabase/supabase-js";

export interface ExerciseProgress {
  /** Следующий номер упражнения для CTA. null = все 46 завершены. */
  nextNumber: number | null;
  /** Сколько упражнений завершено. */
  totalCompleted: number;
  /** Всего упражнений в программе. */
  totalExercises: number;
  /** На nextNumber уже есть активный (in-progress) чат. */
  hasStarted: boolean;
}

/**
 * Прогресс пользователя по упражнениям программы.
 * Используется на странице результатов теста, чтобы показать
 * "Начать с упр. 1" для новичка или "Продолжить с упр. N" для активного.
 *
 * Логика:
 * - Анонимный (нет userId) → начать с первого упражнения, прогресса нет
 * - Нет чатов → новичок, начать с первого
 * - Есть активный чат → продолжить с него (берём минимальный по номеру)
 * - Только completed → следующее = минимальный незавершённый
 * - Все завершены → nextNumber = null
 */
export async function getExerciseProgress(
  supabase: SupabaseClient,
  userId: string | null,
  programId: string,
): Promise<ExerciseProgress> {
  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, number")
    .eq("program_id", programId)
    .order("number", { ascending: true });

  const totalExercises = exercises?.length ?? 0;

  if (totalExercises === 0) {
    return { nextNumber: null, totalCompleted: 0, totalExercises: 0, hasStarted: false };
  }

  const firstNumber = exercises![0].number;

  if (!userId) {
    return { nextNumber: firstNumber, totalCompleted: 0, totalExercises, hasStarted: false };
  }

  const idToNumber = new Map<string, number>();
  for (const ex of exercises!) {
    idToNumber.set(ex.id, ex.number);
  }

  const { data: chats } = await supabase
    .from("chats")
    .select("exercise_id, status")
    .eq("user_id", userId)
    .eq("program_id", programId)
    .not("exercise_id", "is", null);

  const statusByNumber = new Map<number, "completed" | "active">();
  for (const chat of chats ?? []) {
    const num = idToNumber.get(chat.exercise_id);
    if (num === undefined) continue;
    const current = statusByNumber.get(num);
    if (chat.status === "completed") {
      statusByNumber.set(num, "completed");
    } else if (current !== "completed" && chat.status === "active") {
      statusByNumber.set(num, "active");
    }
  }

  let totalCompleted = 0;
  for (const status of statusByNumber.values()) {
    if (status === "completed") totalCompleted += 1;
  }

  for (const ex of exercises!) {
    if (statusByNumber.get(ex.number) === "active") {
      return { nextNumber: ex.number, totalCompleted, totalExercises, hasStarted: true };
    }
  }

  for (const ex of exercises!) {
    if (statusByNumber.get(ex.number) !== "completed") {
      return { nextNumber: ex.number, totalCompleted, totalExercises, hasStarted: false };
    }
  }

  return { nextNumber: null, totalCompleted, totalExercises, hasStarted: false };
}
