import { createServiceClient } from "@/lib/supabase-server";
import type { TestConfig } from "@/lib/test-config";

interface CacheEntry {
  value: TestConfig;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL = 60_000; // 60 seconds

function fromCache(key: string): TestConfig | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value;
  return null;
}

function toCache(key: string, value: TestConfig): void {
  cache.set(key, { value, expiresAt: Date.now() + TTL });
}

/** Load test config by test slug (e.g. 'issp') */
export async function getTestConfig(
  testSlug: string
): Promise<TestConfig | null> {
  const cacheKey = `test_config:${testSlug}`;
  const cached = fromCache(cacheKey);
  if (cached) return cached;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("test_configs")
    .select("*")
    .eq("slug", testSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error(`[test-config] Failed to fetch slug="${testSlug}":`, error);
    return null;
  }
  if (!data) return null;

  const config = data as TestConfig;
  toCache(cacheKey, config);
  // Also cache by program_id for getTestConfigByProgram
  toCache(`test_config_program:${config.program_id}`, config);
  return config;
}

/** Load test config by program slug (e.g. 'nice-guy') — returns the first active test for the program */
export async function getTestConfigByProgram(
  programSlug: string
): Promise<TestConfig | null> {
  const cacheKey = `test_config_by_program_slug:${programSlug}`;
  const cached = fromCache(cacheKey);
  if (cached) return cached;

  const supabase = createServiceClient();

  // First resolve program_id from slug
  const { data: program } = await supabase
    .from("programs")
    .select("id")
    .eq("slug", programSlug)
    .maybeSingle();

  if (!program) return null;

  // Check program_id cache
  const programCacheKey = `test_config_program:${program.id}`;
  const cachedByProgram = fromCache(programCacheKey);
  if (cachedByProgram) {
    toCache(cacheKey, cachedByProgram);
    return cachedByProgram;
  }

  const { data, error } = await supabase
    .from("test_configs")
    .select("*")
    .eq("program_id", program.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      `[test-config] Failed to fetch for program="${programSlug}":`,
      error
    );
    return null;
  }
  if (!data) return null;

  const config = data as TestConfig;
  toCache(cacheKey, config);
  toCache(programCacheKey, config);
  toCache(`test_config:${config.slug}`, config);
  return config;
}
