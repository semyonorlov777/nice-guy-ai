// Public endpoint — соответствует /api/test/results/[id] (UUID unguessable).
// Идемпотентен: если интерпретация уже валидная (не fallback), возвращает её без AI-вызова.

import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-helpers";
import { createRateLimit } from "@/lib/rate-limit";
import {
  generateTestInterpretation,
  isFallbackInterpretation,
  type TestInterpretation,
} from "@/lib/test-interpretation";
import { getTestConfig } from "@/lib/queries/test-config";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 3 регенерации в минуту с одного IP. Каждая = 1 Gemini Pro вызов,
// идемпотентность защищает кошелёк от спама — но лимит на всякий случай.
const checkRateLimit = createRateLimit({ windowMs: 60_000, max: 3 });

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return apiError("Невалидный ID результата", 400);
  }

  if (!checkRateLimit(getClientIp(request))) {
    return apiError("Слишком много запросов. Подожди минуту.", 429);
  }

  const svc = createServiceClient();

  const { data: result, error: loadErr } = await svc
    .from("test_results")
    .select("id, test_slug, total_score, scores_by_scale, interpretation")
    .eq("id", id)
    .single();

  if (loadErr || !result) {
    return apiError("Результат не найден", 404);
  }

  const existing = result.interpretation as TestInterpretation | null;
  if (existing && !isFallbackInterpretation(existing)) {
    return Response.json({ interpretation: existing, regenerated: false });
  }

  const testConfig = await getTestConfig(result.test_slug);
  if (!testConfig) {
    return apiError("Конфигурация теста не найдена", 404);
  }

  let interpretation: TestInterpretation;
  try {
    interpretation = await generateTestInterpretation(
      result.total_score,
      result.scores_by_scale as Parameters<typeof generateTestInterpretation>[1],
      testConfig
    );
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: "test-interpretation", phase: "regenerate" },
      extra: { resultId: id, testSlug: result.test_slug },
    });
    return apiError("Не удалось сгенерировать интерпретацию. Попробуй позже.", 502);
  }

  if (isFallbackInterpretation(interpretation)) {
    // generateTestInterpretation вернул fallback (внутренний catch) — не сохраняем,
    // чтобы пользователь мог попробовать ещё раз.
    return apiError("Не удалось сгенерировать интерпретацию. Попробуй позже.", 502);
  }

  const { error: updateErr } = await svc
    .from("test_results")
    .update({ interpretation, status: "ready" })
    .eq("id", id);

  if (updateErr) {
    Sentry.captureException(updateErr, {
      tags: { area: "test-interpretation", phase: "regenerate-save" },
      extra: { resultId: id },
    });
    return apiError("Не удалось сохранить интерпретацию", 500);
  }

  return Response.json({ interpretation, regenerated: true });
}
