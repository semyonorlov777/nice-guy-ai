// Public endpoint — result pages are shareable by design.
// UUID is unguessable (v4). No auth required.

import { createServiceClient } from "@/lib/supabase-server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return Response.json({ error: "Invalid result ID" }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("test_results")
    .select("interpretation, status")
    .eq("id", id)
    .single();

  if (error || !data) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({
    interpretation: data.interpretation,
    status: data.status,
  });
}
