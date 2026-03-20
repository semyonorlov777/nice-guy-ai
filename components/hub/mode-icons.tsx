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

/** Маппинг icon key → компонент */
const iconMap: Record<string, () => React.JSX.Element> = {
  pen: PenIcon,
  clock: ClockIcon,
  check: CheckIcon,
  book: BookIcon,
  chat: ChatIcon,
};

export function getModeIcon(iconKey: string): React.JSX.Element {
  const Icon = iconMap[iconKey] ?? ChatIcon;
  return <Icon />;
}
