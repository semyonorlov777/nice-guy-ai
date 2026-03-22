"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SendIcon, LockIcon } from "@/components/icons/hub-icons";

interface HubInputBarProps {
  slug: string;
}

export function HubInputBar({ slug }: HubInputBarProps) {
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    router.push(
      `/program/${slug}/chat/new?tool=free-chat&initialMessage=${encodeURIComponent(text)}`,
    );
  }

  return (
    <div className="hub-input-wrap">
      <form className="hub-input-bar" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Просто напишите, о чём думаете…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          type="submit"
          className="hub-input-send"
          disabled={!value.trim()}
        >
          <SendIcon size={16} />
        </button>
      </form>
      <div className="hub-privacy">
        <LockIcon size={10} />
        Диалог анонимизирован и зашифрован
      </div>
    </div>
  );
}
