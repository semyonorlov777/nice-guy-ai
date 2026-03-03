import { createServiceClient } from "@/lib/supabase-server";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const TTL = 60_000; // 60 seconds

export async function getConfig<T>(key: string, defaultValue?: T): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.error(`[config] Failed to fetch key "${key}":`, error);
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Config key "${key}" not found and no default provided`);
  }

  if (!data) {
    if (defaultValue !== undefined) {
      cache.set(key, { value: defaultValue, expiresAt: Date.now() + TTL });
      return defaultValue;
    }
    throw new Error(`Config key "${key}" not found`);
  }

  const value = data.value as T;
  cache.set(key, { value, expiresAt: Date.now() + TTL });
  return value;
}

export async function getConfigs(keys: string[]): Promise<Record<string, unknown>> {
  const now = Date.now();
  const result: Record<string, unknown> = {};
  const missingKeys: string[] = [];

  for (const key of keys) {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      result[key] = cached.value;
    } else {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length > 0) {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("app_config")
      .select("key, value")
      .in("key", missingKeys);

    if (error) {
      console.error("[config] Failed to fetch keys:", error);
    }

    if (data) {
      for (const row of data) {
        result[row.key] = row.value;
        cache.set(row.key, { value: row.value, expiresAt: now + TTL });
      }
    }
  }

  return result;
}
