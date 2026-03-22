import { InstrumentCard } from "./InstrumentCard";
import {
  ExercisesIcon,
  SelfcheckIcon,
  TestIcon,
  AuthorIcon,
  FreechatIcon,
} from "@/components/icons/hub-icons";

interface InstrumentListProps {
  slug: string;
  exerciseCount?: number;
  hasTestResult?: boolean;
}

export function InstrumentList({ slug, exerciseCount, hasTestResult }: InstrumentListProps) {
  const base = `/program/${slug}`;

  const instruments = [
    {
      icon: <ExercisesIcon size={16} />,
      colorClass: "accent" as const,
      name: "Упражнения по главам",
      description: exerciseCount ? `${exerciseCount} упражнений Гловера` : "Упражнения по книге",
      badge: "✦",
      href: `${base}/exercises`,
    },
    {
      icon: <SelfcheckIcon size={16} />,
      colorClass: "accent" as const,
      name: "Самопроверка",
      description: "Методист даст обратную связь",
      badge: "✦",
      href: `${base}/chat/new?tool=selfcheck`,
    },
    {
      icon: <TestIcon size={16} />,
      colorClass: "green" as const,
      name: "Пройти тест",
      description: hasTestResult ? "Профиль построен" : "35 вопросов · 7 минут",
      isDone: hasTestResult,
      href: `${base}/test/issp`,
    },
    {
      icon: <AuthorIcon size={16} />,
      colorClass: "accent" as const,
      name: "Спросить Гловера",
      description: "AI в стиле автора книги",
      badge: "✦",
      href: `${base}/chat/new?tool=author`,
    },
    {
      icon: <FreechatIcon size={16} />,
      colorClass: "green" as const,
      name: "Просто поговорить",
      description: "Свободный чат без темы",
      href: `${base}/chat/new?tool=free-chat`,
    },
  ];

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
