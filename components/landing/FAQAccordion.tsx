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
    <div className="landing-faq-list">
      {items.map((item, i) => (
        <div key={i} className="landing-faq-item">
          <button
            className="landing-faq-question"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            <span>{item.q}</span>
            <svg
              className={`landing-faq-chevron ${open === i ? "open" : ""}`}
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
            <div className="landing-faq-answer">{item.a}</div>
          )}
        </div>
      ))}
    </div>
  );
}
