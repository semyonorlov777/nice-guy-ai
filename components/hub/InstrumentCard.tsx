import { ArrowRightIcon, CheckIcon } from "@/components/icons/hub-icons";

interface InstrumentCardProps {
  icon: React.ReactNode;
  colorClass: "accent" | "green";
  name: string;
  description: string;
  badge?: string;
  progress?: string;
  isDone?: boolean;
  href: string;
}

export function InstrumentCard({
  icon,
  colorClass,
  name,
  description,
  badge,
  progress,
  isDone,
  href,
}: InstrumentCardProps) {
  return (
    <a href={href} className="hub-instrument">
      <div className={`inst-icon ${colorClass}`}>{icon}</div>
      <div className="inst-body">
        <div className="inst-name">{name}</div>
        <div className="inst-desc">{description}</div>
      </div>
      {progress && <span className="inst-badge">{progress}</span>}
      {badge && !isDone && !progress && <span className="inst-badge">{badge}</span>}
      {isDone ? (
        <span className="inst-check"><CheckIcon size={16} /></span>
      ) : (
        <span className="inst-arrow"><ArrowRightIcon size={16} /></span>
      )}
    </a>
  );
}
