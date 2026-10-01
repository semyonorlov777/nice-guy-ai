// Старт голосовой сессии: проверки доступа, режима, клиента, квоты → строка сессии + билет.
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { apiError, requireAuth } from "@/lib/api-helpers";
import { createRateLimit } from "@/lib/rate-limit";
import { getConfig } from "@/lib/config";
import { newTicket } from "@/lib/voice-practice/ticket";
import { practiceDay } from "@/lib/voice-practice/day";

export const dynamic = "force-dynamic";

const limiter = createRateLimit({ windowMs: 60_000, max: 6 });
const LIVE = ["created", "active", "paused", "reconnecting"];
const MIN_START_SECONDS = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { user, response } = await requireAuth(supabase);
  if (response) return response;
  if (!limiter(user.id)) return apiError("Слишком часто, подождите минуту", 429);

  const body = (await req.json().catch(() => null)) as
    | { programSlug?: string; modeKey?: string; clientSlug?: string }
    | null;
  if (!body?.programSlug || !body.modeKey || !body.clientSlug) return apiError("Не хватает данных", 400);

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

  const [{ data: mode }, { data: client }] = await Promise.all([
    db.from("voice_modes").select("client_slugs, max_seconds").eq("program_mode_id", pm.id).maybeSingle(),
    db
      .from("voice_clients")
      .select("id, slug, version")
      .eq("program_id", program.id)
      .eq("slug", body.clientSlug)
      .eq("enabled", true)
      .maybeSingle(),
  ]);
  if (!mode || !client || !(mode.client_slugs as string[]).includes(client.slug)) {
    return apiError("Учебный клиент недоступен в этом режиме", 404);
  }

  const { data: live } = await db
    .from("voice_sessions")
    .select("id")
    .eq("user_id", user.id)
    .in("status", LIVE)
    .maybeSingle();
  if (live) return apiError("У вас уже идёт учебная консультация", 409, { activeSessionId: live.id });

  const dailyCap = await getConfig<number>("voice_daily_sec_per_user", 1800);
  const { data: usage } = await db
    .from("voice_daily_usage")
    .select("seconds")
    .eq("user_id", user.id)
    .eq("day", practiceDay())
    .maybeSingle();
  const left = Math.max(0, dailyCap - Number(usage?.seconds ?? 0));
  const secondsLimit = Math.min(mode.max_seconds, left);
  if (secondsLimit < MIN_START_SECONDS) {
    return apiError("Сегодняшние минуты закончились. Разминка доступна без ограничений", 403, { code: "quota_exhausted" });
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
      kind: body.modeKey === "voice_hard_moments" ? "drill" : "full",
      engine_model: process.env.VOICE_GEMINI_MODEL || "gemini-3.8-live",
      seconds_limit: secondsLimit,
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
