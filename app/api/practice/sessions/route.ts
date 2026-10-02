// Старт голосовой сессии: проверки доступа, режима, клиента, квоты → строка сессии + билет.
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { apiError, requireAuth } from "@/lib/api-helpers";
import { createRateLimit } from "@/lib/rate-limit";
import { getConfig } from "@/lib/config";
import { newTicket } from "@/lib/voice-practice/ticket";
import { practiceDay } from "@/lib/voice-practice/day";

export const dynamic = "force-dynamic";

// Разминка — серия коротких попыток подряд, каждая — своя сессия.
const limiter = createRateLimit({ windowMs: 60_000, max: 12 });
const LIVE = ["created", "active", "paused", "reconnecting"];
const MIN_START_SECONDS = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { user, response } = await requireAuth(supabase);
  if (response) return response;
  if (!limiter(user.id)) return apiError("Слишком часто, подождите минуту", 429);

  const body = (await req.json().catch(() => null)) as
    | { programSlug?: string; modeKey?: string; clientSlug?: string; momentId?: string }
    | null;
  if (!body?.programSlug || !body.modeKey || (!body.clientSlug && !body.momentId)) return apiError("Не хватает данных", 400);

  const db = createServiceClient();
  const { data: program } = await db
    .from("programs")
    .select("id, features")
    .eq("slug", body.programSlug)
    .single();
  if (!program || !(program.features as { voice?: boolean } | null)?.voice) return apiError("Не найдено", 404);

  const { data: access } = await db
    .from("voice_access")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .maybeSingle();
  if (!access) return apiError("Доступ к практикуму выдаёт куратор", 403, { code: "no_access" });

  const { data: pm } = await db
    .from("program_modes")
    .select("id, config, mode_templates!inner(key, interaction)")
    .eq("program_id", program.id)
    .eq("enabled", true)
    .eq("mode_templates.key", body.modeKey)
    .maybeSingle();
  const pmConfig = (pm?.config as { voice?: { coming_soon?: boolean } } | null)?.voice;
  if (!pm || pmConfig?.coming_soon) return apiError("Режим пока недоступен", 404);

  const { data: mode } = await db
    .from("voice_modes")
    .select("client_slugs, max_seconds, drill_moments")
    .eq("program_mode_id", pm.id)
    .maybeSingle();
  // «Трудный момент»: клиент берётся из выбранного момента.
  const moment = body.momentId
    ? ((mode?.drill_moments as { id: string; client_slug: string }[] | null) ?? []).find((m) => m.id === body.momentId)
    : null;
  if (body.momentId && !moment) return apiError("Трудный момент не найден", 404);
  const clientSlug = moment?.client_slug ?? body.clientSlug;
  const { data: client } = await db
    .from("voice_clients")
    .select("id, slug, version")
    .eq("program_id", program.id)
    .eq("slug", clientSlug)
    .eq("enabled", true)
    .maybeSingle();
  if (!mode || !client || !(mode.client_slugs as string[]).includes(client.slug)) {
    return apiError("Учебный клиент недоступен в этом режиме", 404);
  }

  // Брошенные сессии (закрыли вкладку посреди звонка): нет признаков жизни 3 минуты —
  // закрываем и ставим разбор по тому, что успели сказать. Иначе они навсегда
  // занимают место «одной живой сессии» и не получают разбора.
  const stale = new Date(Date.now() - 3 * 60_000).toISOString();
  const { data: abandoned } = await db
    .from("voice_sessions")
    .update({ status: "ended", end_reason: "relay_lost_client", ended_at: new Date().toISOString(), conn_id: null })
    .eq("user_id", user.id)
    .in("status", LIVE)
    .or(`last_heartbeat_at.lt.${stale},and(last_heartbeat_at.is.null,created_at.lt.${stale})`)
    .select("id");
  if (abandoned?.length) {
    await db
      .from("voice_debriefs")
      .upsert(abandoned.map((a) => ({ session_id: a.id, status: "queued" })), { onConflict: "session_id", ignoreDuplicates: true });
  }

  const { data: live } = await db
    .from("voice_sessions")
    .select("id")
    .eq("user_id", user.id)
    .in("status", LIVE)
    .maybeSingle();
  if (live) return apiError("У вас уже идёт учебная консультация", 409, { activeSessionId: live.id });

  // Разминка «Первые слова» (попытки по минуте) не расходует дневные минуты консультаций.
  const free = body.modeKey === "voice_warmup";
  let secondsLimit = mode.max_seconds;
  if (!free) {
    const dailyCap = await getConfig<number>("voice_daily_sec_per_user", 1800);
    const { data: usage } = await db
      .from("voice_daily_usage")
      .select("seconds")
      .eq("user_id", user.id)
      .eq("day", practiceDay())
      .maybeSingle();
    secondsLimit = Math.min(mode.max_seconds, Math.max(0, dailyCap - Number(usage?.seconds ?? 0)));
    if (secondsLimit < MIN_START_SECONDS) {
      return apiError("Сегодняшние минуты закончились. Разминка доступна без ограничений", 403, { code: "quota_exhausted" });
    }
  }

  const t = newTicket();
  const { data: session, error } = await db
    .from("voice_sessions")
    .insert({
      user_id: user.id,
      program_id: program.id,
      program_mode_id: pm.id,
      client_id: client.id,
      client_version: client.version,
      kind: moment ? "drill" : "full",
      drill_moment_id: moment?.id ?? null,
      engine_model: process.env.VOICE_GEMINI_MODEL || "gemini-3.8-live",
      seconds_limit: secondsLimit,
      counts_toward_quota: !free,
      ticket_hash: t.hash,
      ticket_expires_at: t.expiresAt,
    })
    .select("id")
    .single();
  if (error || !session) {
    if (error?.code === "23505") return apiError("У вас уже идёт учебная консультация", 409);
    console.error("[voice] session insert failed", error);
    return apiError("Не удалось начать консультацию", 500);
  }

  return Response.json({ sessionId: session.id, ticket: t.ticket, secondsLimit });
}
