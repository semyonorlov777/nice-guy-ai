"use client";

import { useRouter } from "next/navigation";
import { SendIcon, LockIcon } from "@/components/icons/hub-icons";

interface HubInputBarProps {
  slug: string;
}

export function HubInputBar({ slug }: HubInputBarProps) {
  const router = useRouter();

  return (
    <div className="hub-input-wrap">
      <div
        className="hub-input-bar"
        onClick={() => router.push(`/program/${slug}/chat`)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") router.push(`/program/${slug}/chat`);
        }}
      >
        <input type="text" placeholder="Напиши что-нибудь..." readOnly />
        <button className="hub-input-send" tabIndex={-1}>
          <SendIcon size={16} />
        </button>
      </div>
      <div className="hub-privacy">
        <LockIcon size={10} />
        Диалог анонимизирован и зашифрован
      </div>
    </div>
  );
}
