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
    if (mode.key === "test_issp" && hasTestResult) {
      description = "Пройден · AI учитывает результаты";
    }

    // Determine href: chat-based modes go to /chat/new?tool=KEY, pages go to route_suffix
    const toolKeyMap: Record<string, string> = {
      free_chat: "free-chat",
      author_chat: "author",
      self_work: "selfcheck",
      exercises: "exercises",
      self_analysis: "self-analysis",
      partner_analysis: "partner-analysis",
      relationship_map: "relationship-map",
      theory: "theory",
      love_translator: "love-translator",
      roleplay: "roleplay",
      ta_game_quiz: "ta-game-quiz",
      ta_game_analysis: "ta-game-analysis",
      ta_ego_states: "ta-ego-states",
      ta_life_script: "ta-life-script",
      ta_script_matrix: "ta-script-matrix",
      ta_game_exit: "ta-game-exit",
      ta_permission: "ta-permission",
    };
    const href = mode.is_chat_based && toolKeyMap[mode.key]
      ? `${base}/chat/new?tool=${toolKeyMap[mode.key]}`
      : `${base}${mode.route_suffix}`;

    return {
      icon: IconComponent ? <IconComponent size={16} /> : null,
      colorClass: (mode.color_class ?? "accent") as "accent" | "green",
      name: mode.name,
      description,
      badge: mode.badge ?? undefined,
      isDone: mode.key === "test_issp" ? hasTestResult : undefined,
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
