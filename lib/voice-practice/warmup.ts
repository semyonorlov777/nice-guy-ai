// Разминка «Первые слова»: попытки идут живым голосом (voice_modes.drill_moments режима voice_warmup,
// поле n связывает момент с репликой); условия реакции и рубрика подсказки —
// app_config.voice_warmup_lines (тексты вне git).
import { getConfig } from "@/lib/config";

export type WarmupReaction = "warm" | "neutral" | "cold";

export interface WarmupLine {
  n: number;
  line: string;
  focus: string;
  warm_if: string;
  neutral_if: string;
  cold_if: string;
  example: string;
}

export interface WarmupSet {
  client: string;
  level: number;
  client_name: string;
  lines: WarmupLine[];
}

interface WarmupConfig {
  version: string;
  rubric: string;
  sets: Record<string, WarmupSet>;
}

export const DEFAULT_WARMUP_SET = "vera/1";

/** Конфиг разминки из app_config (значение — JSON-строка или объект). null — не задан. */
export async function getWarmupConfig(): Promise<WarmupConfig | null> {
  const raw = await getConfig<unknown>("voice_warmup_lines", null as unknown);
  if (!raw) return null;
  try {
    const cfg = (typeof raw === "string" ? JSON.parse(raw) : raw) as WarmupConfig;
    return cfg?.sets ? cfg : null;
  } catch {
    console.error("[warmup] voice_warmup_lines: не JSON");
    return null;
  }
}
