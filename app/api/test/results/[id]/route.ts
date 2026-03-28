// Public endpoint — result pages are shareable by design.
// UUID is unguessable (v4). No auth required.

import { createServiceClient } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-helpers";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return apiError("Невалидный ID результата", 400);
  }

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("test_results")
    .select("interpretation, status")
    .eq("id", id)
    .single();

  if (error || !data) {
    return apiError("Не найдено", 404);
  }

  return Response.json({
    interpretation: data.interpretation,
    status: data.status,
  });
}
