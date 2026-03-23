import { createClient } from "@/lib/supabase-server";
import { ProfileScreen } from "@/components/ProfileScreen";
import { isLegacyPortrait } from "@/types/portrait";

const PLAN_NAMES: Record<string, string> = {
  sub_pro: "Про",
  sub_max: "Макс",
  sub_ultra: "Ультра",
};

// Debug mock data for ?state= parameter
const DEBUG_STATES: Record<string, Omit<import("@/components/ProfileScreen").ProfileScreenProps, "slug">> = {
  auth: {
    isAuthed: true,
    name: "Семён",
    avatarUrl: "https://randomuser.me/api/portraits/men/32.jpg",
    balance: 847,
    planLabel: "Свободный тариф",
    hasSubscription: false,
    hasPortrait: true,
    portraitUpdatedAt: new Date().toISOString(),
  },
  empty: {
    isAuthed: true,
    name: "Семён",
    avatarUrl: "https://randomuser.me/api/portraits/men/32.jpg",
    balance: 847,
    planLabel: "Свободный тариф",
    hasSubscription: false,
    hasPortrait: false,
    portraitUpdatedAt: null,
  },
  anon: {
    isAuthed: false,
    name: "Аноним",
    avatarUrl: null,
    balance: 50,
    planLabel: "Гостевой доступ",
    hasSubscription: false,
    hasPortrait: false,
    portraitUpdatedAt: null,
  },
  sub: {
    isAuthed: true,
    name: "Семён",
    avatarUrl: "https://randomuser.me/api/portraits/men/32.jpg",
    balance: 2000,
    planLabel: "Макс",
    hasSubscription: true,
    hasPortrait: true,
    portraitUpdatedAt: new Date().toISOString(),
  },
};

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const debugState = typeof sp.state === "string" ? sp.state : null;

  // Debug mode: ?state=auth|empty|anon|sub
  if (debugState && DEBUG_STATES[debugState]) {
    return (
      <ProfileScreen
        slug={slug}
        {...DEBUG_STATES[debugState]}
        debugState={debugState}
      />
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Anon — State C
    return (
      <ProfileScreen
        slug={slug}
        isAuthed={false}
        name="Аноним"
        avatarUrl={null}
        balance={0}
        planLabel="Гостевой доступ"
        hasSubscription={false}
        hasPortrait={false}
        portraitUpdatedAt={null}
      />
    );
  }

  // Fetch profile + program in parallel
  const [profileRes, programRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "name, avatar_url, balance_tokens, subscription_plan, telegram_username, subscription_expires_at",
      )
      .eq("id", user.id)
      .single(),
    supabase.from("programs").select("id").eq("slug", slug).single(),
  ]);

  const profile = profileRes.data;
  const program = programRes.data;

  const name =
    profile?.name || profile?.telegram_username || "Пользователь";
  const avatarUrl = profile?.avatar_url || null;
  const balance = profile?.balance_tokens ?? 0;
  const subscriptionPlan = profile?.subscription_plan || null;
  const hasSubscription = !!subscriptionPlan;
  const planLabel = subscriptionPlan
    ? PLAN_NAMES[subscriptionPlan] || "Свободный тариф"
    : "Свободный тариф";

  // Fetch portrait if program found
  let hasPortrait = false;
  let portraitUpdatedAt: string | null = null;

  if (program) {
    const { data: portrait } = await supabase
      .from("portraits")
      .select("updated_at, content")
      .eq("user_id", user.id)
      .eq("program_id", program.id)
      .maybeSingle();

    if (portrait) {
      const content = portrait.content as Record<string, unknown> | null;
      if (content) {
        if (isLegacyPortrait(content)) {
          hasPortrait = true;
        } else if (
          Array.isArray((content as { sections?: unknown[] }).sections) &&
          ((content as { sections: unknown[] }).sections).length > 0
        ) {
          hasPortrait = true;
        }
      }
      portraitUpdatedAt = portrait.updated_at || null;
    }
  }

  return (
    <ProfileScreen
      slug={slug}
      isAuthed={true}
      name={name}
      avatarUrl={avatarUrl}
      balance={balance}
      planLabel={planLabel}
      hasSubscription={hasSubscription}
      hasPortrait={hasPortrait}
      portraitUpdatedAt={portraitUpdatedAt}
    />
  );
}
