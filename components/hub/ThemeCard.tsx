import { THEME_ICON_MAP, ArrowRightIcon } from "@/components/icons/hub-icons";
import type { ThemeData } from "@/lib/hub-data";

interface ThemeCardProps {
  theme: ThemeData;
  isEngaged?: boolean;
  isRecommended?: boolean;
  onClick: () => void;
}

export function ThemeCard({ theme, isEngaged, isRecommended, onClick }: ThemeCardProps) {
  const Icon = THEME_ICON_MAP[theme.key];
  let cls = "hub-theme-card";
  if (isEngaged) cls += " engaged";
  if (isRecommended) cls += " recommended";

  return (
    <button className={cls} onClick={onClick} type="button">
      <div className="theme-icon">
        {Icon && <Icon size={22} />}
      </div>
      <div className="theme-title">{theme.title}</div>
      <div className="theme-desc">{theme.description}</div>
      <div className="theme-action">
        {isEngaged ? "Продолжить" : "Начать"}
        <ArrowRightIcon size={14} />
      </div>
    </button>
  );
}
