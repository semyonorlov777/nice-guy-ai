import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * По списку exercise IDs возвращает Map<exerciseId, number>.
 * Используется для отображения номера упражнения в списке чатов.
 */
export async function getExerciseNumberMap(
  supabase: SupabaseClient,
  exerciseIds: string[],
): Promise<Map<string, number>> {
  const exerciseMap = new Map<string, number>();
  if (exerciseIds.length === 0) return exerciseMap;

  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, number")
    .in("id", exerciseIds);

  if (exercises) {
    for (const ex of exercises) {
      exerciseMap.set(ex.id, ex.number);
    }
  }

  return exerciseMap;
}
