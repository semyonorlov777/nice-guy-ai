import type { SupabaseClient } from "@supabase/supabase-js";
import type { TestSession } from "@/lib/test-helpers";

export type AnonymousSessionResult =
  | { ok: true; session: TestSession }
  | { ok: false; reason: "not_in_progress" | "db_error"; error?: unknown };

/**
 * Atomically fetches or creates an anonymous test session.
 *
 * Uses INSERT ... ON CONFLICT (session_id) DO NOTHING to eliminate the
 * race that happens when several /api/test/answer requests arrive in
 * parallel before the row exists — the previous SELECT-then-INSERT
 * pattern produced 500 (unique_violation) on the losers.
 */
export async function getOrCreateAnonymousSession(
  serviceClient: SupabaseClient,
  sessionId: string,
  testSlug: string,
): Promise<AnonymousSessionResult> {
  const { error: upsertError } = await serviceClient
    .from("test_sessions")
    .upsert(
      {
        session_id: sessionId,
        test_slug: testSlug,
        status: "in_progress",
        current_question: 0,
        answers: [],
        messages: [],
      },
      { onConflict: "session_id", ignoreDuplicates: true },
    );

  if (upsertError) {
    return { ok: false, reason: "db_error", error: upsertError };
  }

  const { data: session, error: selectError } = await serviceClient
    .from("test_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .single();

  if (selectError || !session) {
    return { ok: false, reason: "db_error", error: selectError };
  }

  if (session.status !== "in_progress") {
    return { ok: false, reason: "not_in_progress" };
  }

  return { ok: true, session: session as TestSession };
}
