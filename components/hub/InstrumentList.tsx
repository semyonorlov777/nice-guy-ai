import { InstrumentCard } from "./InstrumentCard";
import {
  ExercisesIcon,
  SelfcheckIcon,
  TestIcon,
  AuthorIcon,
  FreechatIcon,
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
      description = "Профиль построен";
    }

    // Determine href: chat-based modes go to /chat/new?tool=KEY, pages go to route_suffix
    const toolKeyMap: Record<string, string> = {
      free_chat: "free-chat",
      author_chat: "author",
      self_work: "selfcheck",
      exercises: "exercises",
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
