import { InstrumentCard } from "./InstrumentCard";
import {
  ExercisesIcon,
  SelfcheckIcon,
  TestIcon,
  AuthorIcon,
  FreechatIcon,
  HeartLoveIcon,
  UsersLoveIcon,
  CompassIcon,
  LightbulbIcon,
  TranslateIcon,
  DramaIcon,
  TargetIcon,
  SearchIcon,
  MessageCircleIcon,
  BookOpenIcon,
  MapIcon,
  SparklesIcon,
  ShieldIcon,
  UnlockIcon,
  RocketIcon,
  InstrumentLightningIcon,
  FlaskIcon,
} from "@/components/icons/hub-icons";
import type { ProgramModeWithTemplate } from "@/types/modes";
import type { ComponentType } from "react";

interface IconProps {
  size?: number;
}

const INSTRUMENT_ICON_MAP: Record<string, ComponentType<IconProps>> = {
  pen: ExercisesIcon,
  clock: SelfcheckIcon,
  check: TestIcon,
  book: AuthorIcon,
  chat: FreechatIcon,
  heart: HeartLoveIcon,
  users: UsersLoveIcon,
  compass: CompassIcon,
  lightbulb: LightbulbIcon,
  translate: TranslateIcon,
  drama: DramaIcon,
  target: TargetIcon,
  search: SearchIcon,
  "message-circle": MessageCircleIcon,
  "book-open": BookOpenIcon,
  map: MapIcon,
  sparkles: SparklesIcon,
  shield: ShieldIcon,
  unlock: UnlockIcon,
  rocket: RocketIcon,
  lightning: InstrumentLightningIcon,
  flask: FlaskIcon,
};

interface InstrumentListProps {
  slug: string;
  modes: ProgramModeWithTemplate[];
  exerciseCount?: number;
  hasTestResult?: boolean;
}

export function InstrumentList({ slug, modes, exerciseCount, hasTestResult }: InstrumentListProps) {
  const base = `/program/${slug}`;

  const instruments = modes.map((mode) => {
    const IconComponent = INSTRUMENT_ICON_MAP[mode.icon];

    // Dynamic description overrides
    let description = mode.description ?? "";
    if (mode.key === "exercises" && exerciseCount) {
      description = `${exerciseCount} упражнений Гловера`;
    }
    const isTestMode = !mode.is_chat_based && mode.route_suffix?.startsWith("/test");
    if (isTestMode && hasTestResult) {
      description = "Пройден · AI учитывает результаты";
    }

    // Determine href:
    // - chat-based modes whose route_suffix is the generic "/chat" go to /chat/new?tool=KEY
    //   (page-only routes like /syndrome, /author-chat use route_suffix directly)
    // - non-chat-based (tests, etc) always use route_suffix
    // tool key derivation mirrors lib/queries/welcome.ts toolAliases (in reverse)
    const toolKeyAliases: Record<string, string> = {
      author_chat: "author",
      self_work: "selfcheck",
    };
    const toolKey = toolKeyAliases[mode.key] ?? mode.key.replace(/_/g, "-");
    const useToolNewChat = mode.is_chat_based && mode.route_suffix === "/chat";
    const href = useToolNewChat
      ? `${base}/chat/new?tool=${toolKey}`
      : `${base}${mode.route_suffix}`;

    return {
      icon: IconComponent ? <IconComponent size={16} /> : null,
      colorClass: (isTestMode ? "green" : (mode.color_class ?? "accent")) as "accent" | "green",
      name: mode.name,
      description,
      badge: mode.badge ?? undefined,
      isDone: isTestMode ? hasTestResult : undefined,
      href,
    };
  });

  return (
    <div className="hub-instruments">
      <div className="hub-instrument-list">
        {instruments.map((inst) => (
          <InstrumentCard key={inst.name} {...inst} />
        ))}
      </div>
    </div>
  );
}
