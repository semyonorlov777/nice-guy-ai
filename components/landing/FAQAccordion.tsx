"use client";

import { useState } from "react";

const items = [
  {
    q: "Это замена психологу?",
    a: "Нет. AI-ассистент работает по методологии книги Роберта Гловера и помогает пройти упражнения. Это инструмент самоисследования, а не психотерапия. Если вам нужна профессиональная помощь — обратитесь к специалисту.",
  },
  {
    q: "Нужно ли читать книгу?",
    a: "Желательно, но не обязательно. AI-ассистент даёт контекст к каждому упражнению. Однако книга поможет глубже понять материал и получить больше пользы от работы.",
  },
  {
    q: "Мои данные кто-то увидит?",
    a: "Нет. Все диалоги приватны и хранятся в зашифрованном виде. Мы не передаём ваши данные третьим лицам и не используем их для обучения моделей.",
  },
  {
    q: "Чем отличается подписка от пакета токенов?",
    a: "Подписка — ежемесячная оплата с фиксированным лимитом. Пакет токенов — разовая покупка, токены не сгорают и используются по мере необходимости.",
  },
  {
    q: "Можно ли вернуть деньги?",
    a: "Да. Полный возврат в течение 14 дней, если услуга не была использована. Частичный возврат — пропорционально неиспользованному объёму. Срок возврата — 10 рабочих дней.",
  },
];

export function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="max-w-[640px] mx-auto">
      {items.map((item, i) => (
        <div key={i} className="border-b border-[#2a2d35]">
          <button
            className="w-full flex justify-between items-center py-5 bg-transparent border-none cursor-pointer text-base font-medium text-[#e0e0e0] text-left"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            <span>{item.q}</span>
            <svg
              className={`shrink-0 text-[#5f5d57] transition-transform duration-200 ${
                open === i ? "rotate-180" : ""
              }`}
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
            >
              <path
                d="M5 7.5L10 12.5L15 7.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {open === i && (
            <div className="pb-5 text-sm leading-relaxed text-[#9a978f] animate-[fadeIn_0.2s_ease]">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
