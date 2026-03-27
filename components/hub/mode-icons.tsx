/** SVG-иконки режимов из прототипа hub-v2.2.html */

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function PenIcon() {
  return (
    <svg {...svgProps}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4l2 2" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...svgProps}>
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export function BookIcon() {
  return (
    <svg {...svgProps}>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

export function ChatIcon() {
  return (
    <svg {...svgProps}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

export function TargetIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function MessageCircleIcon() {
  return (
    <svg {...svgProps}>
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  );
}

export function BookOpenIcon() {
  return (
    <svg {...svgProps}>
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </svg>
  );
}

export function MapIcon() {
  return (
    <svg {...svgProps}>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

export function DramaIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="9" cy="9" r="7" />
      <path d="M7 8.5c0-.3.2-.5.5-.5s.5.2.5.5" />
      <path d="M10 8.5c0-.3.2-.5.5-.5s.5.2.5.5" />
      <path d="M7 11a2 2 0 004 0" />
      <path d="M15 15a7 7 0 100-6" />
      <path d="M16 12.5c0-.3.2-.5.5-.5s.5.2.5.5" />
      <path d="M19 12.5c0-.3.2-.5.5-.5s.5.2.5.5" />
      <path d="M20 16a2 2 0 01-4 0" />
    </svg>
  );
}

export function SparklesIcon() {
  return (
    <svg {...svgProps}>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M18 15l.75 2.25L21 18l-2.25.75L18 21l-.75-2.25L15 18l2.25-.75L18 15z" />
      <path d="M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17z" />
    </svg>
  );
}

export function ArrowRightIcon() {
  return (
    <svg {...svgProps}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg {...svgProps} strokeWidth={2.5}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

export function SessionsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

export function TimeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

export function HeartIcon() {
  return (
    <svg {...svgProps}>
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

export function UsersIcon() {
  return (
    <svg {...svgProps}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg {...svgProps}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function CompassIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

export function LightbulbIcon() {
  return (
    <svg {...svgProps}>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14" />
    </svg>
  );
}

export function TranslateIcon() {
  return (
    <svg {...svgProps}>
      <path d="M5 8l6 6" />
      <path d="M4 14l6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="M22 22l-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  );
}

export function UnlockIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 019.9-1" />
    </svg>
  );
}

export function RocketIcon() {
  return (
    <svg {...svgProps}>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

export function LightningIcon() {
  return (
    <svg {...svgProps}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function FlaskIcon() {
  return (
    <svg {...svgProps}>
      <path d="M9 3h6" />
      <path d="M10 9V3" />
      <path d="M14 9V3" />
      <path d="M10 9l-4.5 9.5A2 2 0 007.3 21h9.4a2 2 0 001.8-2.5L14 9" />
    </svg>
  );
}

/** Маппинг icon key → компонент */
const iconMap: Record<string, () => React.JSX.Element> = {
  pen: PenIcon,
  clock: ClockIcon,
  check: CheckIcon,
  book: BookIcon,
  chat: ChatIcon,
  target: TargetIcon,
  search: SearchIcon,
  "message-circle": MessageCircleIcon,
  "book-open": BookOpenIcon,
  map: MapIcon,
  drama: DramaIcon,
  sparkles: SparklesIcon,
  heart: HeartIcon,
  users: UsersIcon,
  shield: ShieldIcon,
  compass: CompassIcon,
  lightbulb: LightbulbIcon,
  translate: TranslateIcon,
  unlock: UnlockIcon,
  rocket: RocketIcon,
  lightning: LightningIcon,
  flask: FlaskIcon,
};

export function getModeIcon(iconKey: string): React.JSX.Element {
  const Icon = iconMap[iconKey] ?? ChatIcon;
  return <Icon />;
}
