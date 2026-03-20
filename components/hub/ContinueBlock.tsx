"use client";

import Link from "next/link";
import type { LastActiveMode } from "@/types/modes";
import { ArrowRightIcon, PlayIcon } from "./mode-icons";
import { formatRelativeTime } from "@/lib/time";

interface ContinueBlockProps {
  lastActive: LastActiveMode;
  slug: string;
}

export function ContinueBlock({ lastActive, slug }: ContinueBlockProps) {
  const href = `/program/${slug}${lastActive.route_suffix}`;

  return (
    <Link href={href} className="hub-continue">
      <div className="hub-continue-icon">
        <PlayIcon />
      </div>
      <div className="hub-continue-body">
        <div className="hub-continue-label">Продолжить</div>
        <div className="hub-continue-title">{lastActive.name}</div>
        <div className="hub-continue-meta">
          {formatRelativeTime(lastActive.last_at)}
        </div>
      </div>
      <div className="hub-continue-arrow">
        <ArrowRightIcon />
      </div>
    </Link>
  );
}
