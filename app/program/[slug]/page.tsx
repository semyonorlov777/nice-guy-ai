import type { Metadata } from "next";
import Link from "next/link";
import { PricingTabs } from "@/components/landing/PricingTabs";
import { FAQAccordion } from "@/components/landing/FAQAccordion";

export const metadata: Metadata = {
  title: "НеСлавный — AI-тренажёр по книге «No More Mr. Nice Guy»",
  description:
    "46 упражнений из книги Роберта Гловера с AI-ассистентом. Психологический портрет, персональные вопросы, полная конфиденциальность.",
};

const D = "var(--font-display)";

const pains = [
  { emoji: "😤", text: "Говоришь «да», когда хочешь сказать «нет» — и потом злишься на себя" },
  { emoji: "🎭", text: "Стараешься быть удобным для всех — а на себя сил не остаётся" },
  { emoji: "💣", text: "Копишь обиды молча, а потом взрываешься на ровном месте" },
  { emoji: "🙈", text: "Избегаешь конфликтов любой ценой — даже ценой собственных интересов" },
  { emoji: "🤝", text: "Помогаешь всем вокруг, но попросить о помощи сам — не можешь" },
  { emoji: "😶", text: "В отношениях подстраиваешься — и теряешь себя" },
];

const steps = [
  {
    num: "01",
    title: "Выбираешь упражнение",
    desc: "46 упражнений по 7 главам книги. Каждое — конкретная работа над собой: от осознания паттернов до действий в реальной жизни.",
  },
  {
    num: "02",
    title: "Работаешь с AI-ассистентом",
    desc: "Не тест и не анкета. Живой диалог: ассистент задаёт уточняющие вопросы, не даёт отвечать поверхностно, помогает копнуть глубже.",
  },
  {
    num: "03",
    title: "Строишь свой портрет",
    desc: "С каждым упражнением AI собирает твой психологический портрет: паттерны, защитные механизмы, зоны роста. Он помнит всё и связывает одно с другим.",
  },
];

const aiAdvantages = [
  { label: "💬 Задаёт вопросы", desc: "Не даёт отделаться ответом «всё нормально»" },
  { label: "🧠 Помнит контекст", desc: "Связывает упражнение 2 с упражнением 15" },
  { label: "💜 Без осуждения", desc: "Рассказывай честно — AI не будет тебя оценивать" },
  { label: "🕐 Доступен 24/7", desc: "В 3 ночи, на перекуре, в обед — когда удобно" },
];

const stats = [
  { num: "200+", label: "встреч групп поддержки" },
  { num: "40+", label: "участников прошли программу" },
  { num: "46", label: "упражнений с AI" },
];

export default function ProgramLanding() {
  return (
    <div
      className="landing"
      style={{
        minHeight: "100vh",
        background: "#0f1114",
        color: "#e0e0e0",
        fontFamily: "var(--font-body)",
        overflowX: "hidden",
      }}
    >
      {/* NAV */}
      <nav
        style={{
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: 1080,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            fontFamily: D,
            fontSize: 20,
            fontWeight: 600,
            color: "#c9a84c",
            letterSpacing: "-0.5px",
          }}
        >
          НеСлавный
        </div>
        <Link
          href="/auth"
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            border: "1.5px solid rgba(201,168,76,0.4)",
            background: "transparent",
            color: "#c9a84c",
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Войти
        </Link>
      </nav>

      {/* HERO */}
      <section
        style={{
          padding: "80px 24px 60px",
          maxWidth: 800,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#c9a84c",
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 20,
            opacity: 0.8,
          }}
        >
          AI-тренажёр по книге Роберта Гловера
        </div>
        <h1
          style={{
            fontFamily: D,
            fontSize: "clamp(36px, 7vw, 56px)",
            fontWeight: 600,
            lineHeight: 1.1,
            color: "#ffffff",
            margin: "0 0 24px",
            letterSpacing: "-1px",
          }}
        >
          Хватит быть{" "}
          <span style={{ color: "#c9a84c", fontStyle: "italic" }}>славным парнем</span>
        </h1>
        <p
          style={{
            fontSize: 18,
            lineHeight: 1.6,
            color: "#999",
            maxWidth: 600,
            margin: "0 auto 40px",
          }}
        >
          46 упражнений из книги «No More Mr. Nice Guy» с AI-ассистентом, который знает
          методологию, задаёт правильные вопросы и помнит всё, что ты ему рассказал.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/auth"
            style={{
              padding: "14px 32px",
              borderRadius: 10,
              background: "#c9a84c",
              color: "#0f1114",
              fontSize: 15,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Начать бесплатно
          </Link>
          <a
            href="#how"
            style={{
              padding: "14px 32px",
              borderRadius: 10,
              border: "1.5px solid #2a2d35",
              background: "transparent",
              color: "#999",
              fontSize: 15,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Как это работает
          </a>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section
        style={{
          padding: "20px 24px 60px",
          maxWidth: 700,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            gap: 24,
            padding: "16px 28px",
            background: "#16181d",
            borderRadius: 12,
            border: "1px solid #2a2d35",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {stats.map((s) => (
            <div key={s.label} style={{ textAlign: "center", minWidth: 120 }}>
              <div style={{ fontFamily: D, fontSize: 28, fontWeight: 700, color: "#c9a84c" }}>
                {s.num}
              </div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PAIN POINTS */}
      <section style={{ padding: "40px 24px 60px", maxWidth: 800, margin: "0 auto" }}>
        <h2
          style={{
            fontFamily: D,
            fontSize: 32,
            fontWeight: 600,
            textAlign: "center",
            marginBottom: 12,
            color: "#fff",
          }}
        >
          Узнаёшь себя?
        </h2>
        <p
          style={{
            textAlign: "center",
            color: "#666",
            fontSize: 15,
            marginBottom: 36,
          }}
        >
          Если хотя бы 2–3 пункта — про тебя, эта программа для тебя
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {pains.map((p, i) => (
            <div
              key={i}
              style={{
                padding: "18px 20px",
                background: "#16181d",
                borderRadius: 12,
                border: "1px solid #2a2d35",
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{p.emoji}</span>
              <span style={{ fontSize: 14, lineHeight: 1.55, color: "#bbb" }}>{p.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* DIVIDER */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px" }}>
        <div
          style={{
            height: 1,
            background: "linear-gradient(90deg, transparent, #2a2d35, transparent)",
          }}
        />
      </div>

      {/* HOW IT WORKS */}
      <section id="how" style={{ padding: "60px 24px", maxWidth: 800, margin: "0 auto" }}>
        <h2
          style={{
            fontFamily: D,
            fontSize: 32,
            fontWeight: 600,
            textAlign: "center",
            marginBottom: 48,
            color: "#fff",
          }}
        >
          Как это работает
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {steps.map((s) => (
            <div
              key={s.num}
              style={{
                display: "flex",
                gap: 24,
                alignItems: "flex-start",
                padding: 28,
                background: "#16181d",
                borderRadius: 16,
                border: "1px solid #2a2d35",
              }}
            >
              <div
                style={{
                  fontFamily: D,
                  fontSize: 36,
                  fontWeight: 700,
                  color: "#c9a84c",
                  opacity: 0.5,
                  lineHeight: 1,
                  flexShrink: 0,
                  minWidth: 48,
                }}
              >
                {s.num}
              </div>
              <div>
                <h3
                  style={{
                    fontSize: 17,
                    fontWeight: 600,
                    color: "#e0e0e0",
                    marginBottom: 8,
                    marginTop: 0,
                  }}
                >
                  {s.title}
                </h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "#888", margin: 0 }}>
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AI DIFFERENCE */}
      <section style={{ padding: "40px 24px 60px", maxWidth: 800, margin: "0 auto" }}>
        <div
          style={{
            padding: 32,
            background: "linear-gradient(135deg, rgba(201,168,76,0.06), rgba(201,168,76,0.02))",
            borderRadius: 16,
            border: "1px solid rgba(201,168,76,0.15)",
          }}
        >
          <h2
            style={{
              fontFamily: D,
              fontSize: 28,
              fontWeight: 600,
              color: "#c9a84c",
              marginBottom: 16,
              marginTop: 0,
            }}
          >
            Почему с AI, а не самому?
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "#999", marginBottom: 20 }}>
            Опыт 200+ живых встреч показал:{" "}
            <strong style={{ color: "#c9a84c" }}>
              99% мужчин не доходят до конца самостоятельно
            </strong>
            . Упражнения кажутся простыми, но без правильных вопросов — ответы остаются на
            поверхности. Мозг защищает от неприятных открытий.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {aiAdvantages.map((item) => (
              <div
                key={item.label}
                style={{ padding: 14, background: "rgba(15,17,20,0.5)", borderRadius: 10 }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: "#c9a84c", marginBottom: 4 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 12, color: "#777" }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: "40px 24px 60px", maxWidth: 960, margin: "0 auto" }}>
        <h2
          style={{
            fontFamily: D,
            fontSize: 32,
            fontWeight: 600,
            textAlign: "center",
            marginBottom: 12,
            color: "#fff",
          }}
        >
          Тарифы
        </h2>
        <p style={{ textAlign: "center", color: "#666", fontSize: 14, marginBottom: 28 }}>
          Выберите подписку или купите пакет токенов
        </p>
        <PricingTabs />
      </section>

      {/* FAQ */}
      <section style={{ padding: "40px 24px 60px", maxWidth: 700, margin: "0 auto" }}>
        <h2
          style={{
            fontFamily: D,
            fontSize: 32,
            fontWeight: 600,
            textAlign: "center",
            marginBottom: 32,
            color: "#fff",
          }}
        >
          Вопросы
        </h2>
        <FAQAccordion />
      </section>

      {/* CTA */}
      <section style={{ padding: "40px 24px 60px", textAlign: "center" }}>
        <div
          style={{
            maxWidth: 600,
            margin: "0 auto",
            padding: "40px 32px",
            background: "linear-gradient(135deg, rgba(201,168,76,0.08), rgba(201,168,76,0.02))",
            borderRadius: 20,
            border: "1px solid rgba(201,168,76,0.15)",
          }}
        >
          <h2
            style={{
              fontFamily: D,
              fontSize: 28,
              fontWeight: 600,
              color: "#fff",
              marginBottom: 12,
              marginTop: 0,
            }}
          >
            Готов перестать быть удобным?
          </h2>
          <p style={{ color: "#888", fontSize: 15, marginBottom: 24 }}>
            Попробуй бесплатно. Без привязки карты.
          </p>
          <Link
            href="/auth"
            style={{
              display: "inline-block",
              padding: "14px 40px",
              borderRadius: 10,
              background: "#c9a84c",
              color: "#0f1114",
              fontSize: 15,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Начать бесплатно
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          padding: "32px 24px",
          borderTop: "1px solid #1c1f26",
          maxWidth: 800,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 24,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: D,
                fontSize: 18,
                fontWeight: 600,
                color: "#c9a84c",
                marginBottom: 8,
              }}
            >
              НеСлавный
            </div>
            <div style={{ fontSize: 12, color: "#555", lineHeight: 1.7 }}>
              AI-тренажёр по методологии
              <br />
              «No More Mr. Nice Guy»
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#444", lineHeight: 1.8, textAlign: "right" }}>
            <div>ИП Орлов Семён Вячеславович</div>
            <div>ИНН: 381914223321 · ОГРНИП: 321385000066066</div>
            <Link
              href="/legal"
              style={{
                color: "#666",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Оферта и политика конфиденциальности
            </Link>
          </div>
        </div>
        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: "#333" }}>
          © 2026
        </div>
      </footer>
    </div>
  );
}
