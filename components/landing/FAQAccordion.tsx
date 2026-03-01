"use client";

import { useState } from "react";

const faqs = [
  { q: "Это замена психологу?", a: "Нет. Это AI-ассистент по методологии книги Роберта Гловера. Он помогает пройти упражнения осознанно, задаёт вопросы и строит твой психологический портрет. Но он не ставит диагнозы и не заменяет специалиста." },
  { q: "Нужно ли читать книгу «No More Mr. Nice Guy»?", a: "Желательно, но не обязательно. AI-ассистент знает всю методологию и объяснит контекст каждого упражнения. Книга даст более глубокое понимание, но начать можно и без неё." },
  { q: "Мои данные кто-то увидит?", a: "Нет. Все диалоги приватны и привязаны к твоему аккаунту. Никто, включая администратора, не читает содержание твоих чатов. Данные хранятся в защищённой базе." },
  { q: "Чем отличается подписка от пакета токенов?", a: "Подписка — ежемесячная оплата с включённым лимитом сообщений. Пакет токенов — разовая покупка, токены не сгорают и доступны до полного использования. Можно комбинировать." },
  { q: "Можно ли вернуть деньги?", a: "Если вы не использовали оплаченные услуги — да, полный возврат в течение 14 дней. За использованные услуги возврат не предусмотрен." },
];

export function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {faqs.map((faq, i) => (
        <div key={i} style={{ background: "#16181d", borderRadius: 12, border: "1px solid #2a2d35", overflow: "hidden" }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{
              width: "100%", padding: "18px 20px", display: "flex",
              justifyContent: "space-between", alignItems: "center",
              background: "transparent", border: "none", color: "#e0e0e0",
              fontSize: 15, fontWeight: 500, cursor: "pointer",
              textAlign: "left", fontFamily: "inherit",
            }}
          >
            <span>{faq.q}</span>
            <span style={{ color: "#c9a84c", fontSize: 18, transform: open === i ? "rotate(45deg)" : "none", transition: "transform 0.2s", flexShrink: 0, marginLeft: 12 }}>+</span>
          </button>
          {open === i && (
            <div style={{ padding: "0 20px 18px", fontSize: 14, lineHeight: 1.6, color: "#888" }}>{faq.a}</div>
          )}
        </div>
      ))}
    </div>
  );
}
