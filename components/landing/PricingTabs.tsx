"use client";

import { useState } from "react";
import Link from "next/link";

const D = "var(--font-display)";

const subs = [
  {
    name: "Старт",
    price: "990",
    period: "/мес",
    desc: "Для знакомства с платформой",
    features: ["Доступ ко всем упражнениям", "AI-ассистент по методологии", "Психологический портрет", "Свободный чат"],
    pop: false,
  },
  {
    name: "Стандарт",
    price: "2 900",
    period: "/мес",
    desc: "Для глубокой проработки",
    features: ["Всё из тарифа Старт", "Увеличенный лимит сообщений", "Интенсивные сессии", "Приоритетная поддержка"],
    pop: true,
  },
  {
    name: "Премиум",
    price: "7 900",
    period: "/мес",
    desc: "Для максимального результата",
    features: ["Всё из тарифа Стандарт", "Максимальный лимит сообщений", "Доступ к новым тренажёрам", "Персональные рекомендации"],
    pop: false,
  },
];

const packs = [
  { name: "Стартовый", tokens: "1M", price: "1 290", desc: "Протестировать платформу", pop: false },
  { name: "Стандартный", tokens: "5M", price: "3 790", desc: "Глубокое изучение 1 книги", pop: true },
  { name: "Мега", tokens: "50M", price: "14 990", desc: "Для активных пользователей", pop: false },
];

export function PricingTabs() {
  const [tab, setTab] = useState<"sub" | "tok">("sub");

  const tabBtn = (id: "sub" | "tok", label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      style={{
        padding: "10px 24px",
        borderRadius: 8,
        border: "none",
        background: tab === id ? "#c9a84c" : "#1c1f26",
        color: tab === id ? "#0f1114" : "#888",
        fontSize: 14,
        fontWeight: tab === id ? 600 : 400,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.2s",
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 32 }}>
        {tabBtn("sub", "Подписка")}
        {tabBtn("tok", "Пакеты токенов")}
      </div>

      {tab === "sub" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {subs.map((p) => (
            <div
              key={p.name}
              style={{
                padding: "28px 24px",
                background: p.pop ? "rgba(201,168,76,0.06)" : "#16181d",
                borderRadius: 16,
                border: p.pop ? "1.5px solid rgba(201,168,76,0.4)" : "1px solid #2a2d35",
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              {p.pop && (
                <div style={{ position: "absolute", top: -10, right: 16, background: "#c9a84c", color: "#0f1114", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Популярный
                </div>
              )}
              <div style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>{p.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                <span style={{ fontFamily: D, fontSize: 36, fontWeight: 700, color: "#e0e0e0" }}>{p.price}</span>
                <span style={{ fontSize: 16, color: "#e0e0e0" }}>₽</span>
                <span style={{ fontSize: 14, color: "#555" }}>{p.period}</span>
              </div>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>{p.desc}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24, flex: 1 }}>
                {p.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#999" }}>
                    <span style={{ color: "#c9a84c", flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/auth"
                style={{
                  display: "block", textAlign: "center", padding: 12, borderRadius: 10,
                  background: p.pop ? "#c9a84c" : "transparent",
                  border: p.pop ? "none" : "1.5px solid #2a2d35",
                  color: p.pop ? "#0f1114" : "#999",
                  fontSize: 14, fontWeight: 600, textDecoration: "none",
                }}
              >
                Выбрать
              </Link>
            </div>
          ))}
        </div>
      )}

      {tab === "tok" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {packs.map((p) => (
            <div
              key={p.name}
              style={{
                padding: "28px 24px",
                background: p.pop ? "rgba(201,168,76,0.06)" : "#16181d",
                borderRadius: 16,
                border: p.pop ? "1.5px solid rgba(201,168,76,0.4)" : "1px solid #2a2d35",
                display: "flex", flexDirection: "column", alignItems: "center",
                textAlign: "center", position: "relative",
              }}
            >
              {p.pop && (
                <div style={{ position: "absolute", top: -10, right: 16, background: "#c9a84c", color: "#0f1114", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Выгодно
                </div>
              )}
              <div style={{ fontSize: 14, color: "#888", marginBottom: 16 }}>{p.name}</div>
              <div style={{ padding: "12px 24px", background: "rgba(201,168,76,0.08)", borderRadius: 10, border: "1px solid rgba(201,168,76,0.15)", marginBottom: 16 }}>
                <div style={{ fontFamily: D, fontSize: 32, fontWeight: 700, color: "#c9a84c" }}>{p.tokens}</div>
                <div style={{ fontSize: 12, color: "#777" }}>токенов</div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                <span style={{ fontFamily: D, fontSize: 28, fontWeight: 700, color: "#e0e0e0" }}>{p.price}</span>
                <span style={{ fontSize: 16, color: "#e0e0e0" }}>₽</span>
              </div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 20 }}>{p.desc}</div>
              <div style={{ fontSize: 11, color: "#555", marginBottom: 16 }}>Токены не сгорают · Единоразовая оплата</div>
              <Link
                href="/auth"
                style={{
                  display: "block", width: "100%", textAlign: "center", padding: 12,
                  borderRadius: 10, border: "1.5px solid #2a2d35",
                  background: "transparent", color: "#999",
                  fontSize: 14, fontWeight: 600, textDecoration: "none",
                }}
              >
                Купить токены
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
