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

  // Один запрос вместо двух sequential round-trips: фильтр по programs.slug
  // через !inner-join и select только полей test_configs.
  const { data, error } = await supabase
    .from("test_configs")
    .select("*, programs!inner(slug)")
    .eq("programs.slug", programSlug)
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

  // `programs` приходит в runtime от join'а, но не присутствует в TestConfig —
  // консьюмеры не обращаются к нему, оставляем для простоты.
  const config = data as TestConfig;

  toCache(cacheKey, config);
  toCache(`test_config_program:${config.program_id}`, config);
  toCache(`test_config:${config.slug}`, config);
  return config;
}

export interface TestCatalogEntry {
  slug: string;
  title: string;
  description: string | null;
  total_questions: number;
  is_active: boolean;
  program: {
    slug: string;
    book_title: string | null;
    author_top: string | null;
    test_emoji: string | null;
    time_label: string | null;
    questions_label: string | null;
  };
}

interface TestCatalogCacheEntry {
  value: TestCatalogEntry[];
  expiresAt: number;
}

let catalogCache: TestCatalogCacheEntry | null = null;
const CATALOG_TTL = 60_000;

interface LandingDataMin {
  book?: { title?: string; author_top?: string };
  test?: { emoji?: string; time_label?: string; questions_label?: string };
}

/** Load all tests with their program info for the public catalog view at /tests */
export async function getAllTestConfigsWithProgram(): Promise<TestCatalogEntry[]> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) {
    return catalogCache.value;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("test_configs")
    .select(
      "slug, title, description, total_questions, is_active, programs!inner(slug, landing_data)"
    )
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[test-config] Failed to fetch catalog:", error);
    return [];
  }

  const entries: TestCatalogEntry[] = (data || [])
    .map((row) => {
      const rawPrograms = (row as unknown as {
        programs: { slug: string; landing_data: LandingDataMin | null } | { slug: string; landing_data: LandingDataMin | null }[];
      }).programs;
      const program = Array.isArray(rawPrograms) ? rawPrograms[0] : rawPrograms;
      if (!program) return null;
      const landing = program.landing_data;
      return {
        slug: row.slug as string,
        title: row.title as string,
        description: (row.description as string | null) ?? null,
        total_questions: (row.total_questions as number) ?? 0,
        is_active: (row.is_active as boolean) ?? false,
        program: {
          slug: program.slug,
          book_title: landing?.book?.title ?? null,
          author_top: landing?.book?.author_top ?? null,
          test_emoji: landing?.test?.emoji ?? null,
          time_label: landing?.test?.time_label ?? null,
          questions_label: landing?.test?.questions_label ?? null,
        },
      } satisfies TestCatalogEntry;
    })
    .filter((e): e is TestCatalogEntry => e !== null);

  catalogCache = { value: entries, expiresAt: Date.now() + CATALOG_TTL };
  return entries;
}
