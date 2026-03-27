import { createClient, createServiceClient } from "@/lib/supabase-server";
import { requireAuth } from "@/lib/api-helpers";
import { getTestConfig } from "@/lib/queries/test-config";
import { generateTestInterpretation } from "@/lib/test-interpretation";
import type { ScaleResult } from "@/lib/test-scoring";

export const maxDuration = 60;

const RECOVERY_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chat_id");

  if (!chatId) {
    return Response.json({ error: "chat_id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { response } = await requireAuth(supabase);
  if (response) return response;

  const { data: result, error } = await supabase
    .from("test_results")
    .select("id, status, created_at, test_slug, total_score, scores_by_scale")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[test-result] polling query error:", error);
  }

  if (!result) {
    return Response.json({ ready: false, status: "not_found" });
  }

  // Recovery: if stuck in "processing" for > 2 min, retry interpretation generation
  if (result.status === "processing" && result.created_at) {
    const age = Date.now() - new Date(result.created_at).getTime();
    if (age > RECOVERY_THRESHOLD_MS && result.test_slug) {
      console.log("[test-result] recovery: result %s stuck in processing for %ds, retrying interpretation", result.id, Math.round(age / 1000));
      try {
        const testConfig = await getTestConfig(result.test_slug);
        if (testConfig) {
          const interpretation = await generateTestInterpretation(
            result.total_score,
            result.scores_by_scale as Record<string, ScaleResult>,
            testConfig
          );
          const serviceClient = createServiceClient();
          await serviceClient
            .from("test_results")
            .update({ interpretation, status: "ready" })
            .eq("id", result.id);

          console.log("[test-result] recovery: interpretation generated for result %s", result.id);
          return Response.json({
            ready: true,
            status: "ready",
            result_id: result.id,
          });
        }
      } catch (err) {
        console.error("[test-result] recovery failed:", err);
        // Fallback: mark as ready without interpretation so user isn't stuck
        const serviceClient = createServiceClient();
        await serviceClient
          .from("test_results")
          .update({ status: "ready" })
          .eq("id", result.id);

        return Response.json({
          ready: true,
          status: "ready",
          result_id: result.id,
        });
      }
    }
  }

  return Response.json({
    ready: result.status === "ready",
    status: result.status,
    result_id: result.id,
  });
}
