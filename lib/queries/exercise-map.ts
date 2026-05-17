import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * По списку exercise IDs возвращает Map<exerciseId, number>.
 * Используется для отображения номера упражнения в списке чатов.
 *
 * Обёрнут в React.cache для дедупликации в рамках одного RSC-запроса.
 */
export const getExerciseNumberMap = cache(async (
  supabase: SupabaseClient,
  exerciseIds: string[],
): Promise<Map<string, number>> => {
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
});
