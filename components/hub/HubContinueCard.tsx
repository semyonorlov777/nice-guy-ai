import Link from "next/link";
import { PlayIcon, ArrowRightIcon } from "@/components/icons/hub-icons";
import type { LastActiveMode } from "@/types/modes";
import { formatRelativeTime } from "@/lib/time";

interface HubContinueCardProps {
  lastActive: LastActiveMode;
  slug: string;
}

export function HubContinueCard({ lastActive, slug }: HubContinueCardProps) {
  const href = lastActive.chat_id
    ? `/program/${slug}/chat/${lastActive.chat_id}`
    : `/program/${slug}/${lastActive.route_suffix}`;

  return (
    <Link href={href} className="hub-continue fade-in">
      <div className="hub-continue-icon">
        <PlayIcon size={18} />
      </div>
      <div className="hub-continue-body">
        <div className="hub-continue-title">Продолжить: {lastActive.name}</div>
        <div className="hub-continue-sub">
          {formatRelativeTime(lastActive.last_at)}
        </div>
      </div>
      <span className="inst-arrow"><ArrowRightIcon size={16} /></span>
    </Link>
  );
}
