"use client";

import { useState } from "react";
import Link from "next/link";

function PricingTabs() {
  const [tab, setTab] = useState("sub");

  const subscriptions = [
    {
      name: "Старт",
      price: "990",
      period: "/мес",
      desc: "Для знакомства с платформой",
      features: ["Доступ ко всем упражнениям", "AI-ассистент по методологии", "Психологический портрет", "Свободный чат"],
      highlight: false,
    },
    {
      name: "Стандарт",
      price: "2 900",
      period: "/мес",
      desc: "Для глубокой проработки",
      features: ["Всё из тарифа Старт", "Увеличенный лимит сообщений", "Интенсивные сессии", "Приоритетная поддержка"],
      highlight: true,
    },
    {
      name: "Премиум",
      price: "7 900",
      period: "/мес",
      desc: "Для максимального результата",
      features: ["Всё из тарифа Стандарт", "Максимальный лимит сообщений", "Доступ к новым тренажёрам", "Персональные рекомендации"],
      highlight: false,
    },
  ];

  const tokenPackages = [
    { name: "Стартовый", tokens: "1M", price: "1 290", desc: "Протестировать платформу", highlight: false },
    { name: "Стандартный", tokens: "5M", price: "3 790", desc: "Глубокое изучение 1 книги", highlight: true },
    { name: "Мега", tokens: "50M", price: "14 990", desc: "Для активных пользователей", highlight: false },
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "center", gap: "4px", marginBottom: "32px" }}>
        {[
          { id: "sub", label: "Подписка" },
          { id: "tokens", label: "Пакеты токенов" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              border: "none",
              background: tab === t.id ? "#c9a84c" : "#1c1f26",
              color: tab === t.id ? "#0f1114" : "#888",
              fontSize: "14px",
              fontWeight: tab === t.id ? 600 : 400,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "sub" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          {subscriptions.map((plan) => (
            <div
              key={plan.name}
              style={{
                padding: "28px 24px",
                background: plan.highlight ? "rgba(201,168,76,0.06)" : "#16181d",
                borderRadius: "16px",
                border: plan.highlight ? "1.5px solid rgba(201,168,76,0.4)" : "1px solid #2a2d35",
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              {plan.highlight && (
                <div style={{ position: "absolute", top: "-10px", right: "16px", background: "#c9a84c", color: "#0f1114", fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Популярный
                </div>
              )}
              <div style={{ fontSize: "14px", color: "#888", marginBottom: "8px" }}>{plan.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "4px" }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "36px", fontWeight: 700, color: "#e0e0e0" }}>{plan.price}</span>
                <span style={{ fontSize: "16px", color: "#e0e0e0" }}>₽</span>
                <span style={{ fontSize: "14px", color: "#555" }}>{plan.period}</span>
              </div>
              <div style={{ fontSize: "13px", color: "#666", marginBottom: "20px" }}>{plan.desc}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px", flex: 1 }}>
                {plan.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px", color: "#999" }}>
                    <span style={{ color: "#c9a84c", flexShrink: 0, marginTop: "1px" }}>✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/auth"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "12px",
                  borderRadius: "10px",
                  background: plan.highlight ? "#c9a84c" : "transparent",
                  border: plan.highlight ? "none" : "1.5px solid #2a2d35",
                  color: plan.highlight ? "#0f1114" : "#999",
                  fontSize: "14px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Выбрать
              </Link>
            </div>
          ))}
        </div>
      )}

      {tab === "tokens" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          {tokenPackages.map((pkg) => (
            <div
              key={pkg.name}
              style={{
                padding: "28px 24px",
                background: pkg.highlight ? "rgba(201,168,76,0.06)" : "#16181d",
                borderRadius: "16px",
                border: pkg.highlight ? "1.5px solid rgba(201,168,76,0.4)" : "1px solid #2a2d35",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                position: "relative",
              }}
            >
              {pkg.highlight && (
                <div style={{ position: "absolute", top: "-10px", right: "16px", background: "#c9a84c", color: "#0f1114", fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Выгодно
                </div>
              )}
              <div style={{ fontSize: "14px", color: "#888", marginBottom: "16px" }}>{pkg.name}</div>
              <div style={{ padding: "12px 24px", background: "rgba(201,168,76,0.08)", borderRadius: "10px", border: "1px solid rgba(201,168,76,0.15)", marginBottom: "16px" }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "32px", fontWeight: 700, color: "#c9a84c" }}>{pkg.tokens}</div>
                <div style={{ fontSize: "12px", color: "#777" }}>токенов</div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "8px" }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "28px", fontWeight: 700, color: "#e0e0e0" }}>{pkg.price}</span>
                <span style={{ fontSize: "16px", color: "#e0e0e0" }}>₽</span>
              </div>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "20px" }}>{pkg.desc}</div>
              <div style={{ fontSize: "11px", color: "#555", marginBottom: "16px" }}>Токены не сгорают · Единоразовая оплата</div>
              <Link
                href="/auth"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "center",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1.5px solid #2a2d35",
                  background: "transparent",
                  color: "#999",
                  fontSize: "14px",
                  fontWeight: 600,
                  textDecoration: "none",
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

function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  const faqs = [
    { q: "Это замена психологу?", a: "Нет. Это AI-ассистент по методологии книги Роберта Гловера. Он помогает пройти упражнения осознанно, задаёт вопросы и строит твой психологический портрет. Но он не ставит диагнозы и не заменяет специалиста." },
    { q: "Нужно ли читать книгу «No More Mr. Nice Guy»?", a: "Желательно, но не обязательно. AI-ассистент знает всю методологию и объяснит контекст каждого упражнения. Книга даст более глубокое понимание, но начать можно и без неё." },
    { q: "Мои данные кто-то увидит?", a: "Нет. Все диалоги приватны и привязаны к твоему аккаунту. Никто, включая администратора, не читает содержание твоих чатов. Данные хранятся в защищённой базе." },
    { q: "Чем отличается подписка от пакета токенов?", a: "Подписка — ежемесячная оплата с включённым лимитом сообщений. Пакет токенов — разовая покупка, токены не сгорают и доступны до полного использования. Можно комбинировать." },
    { q: "Можно ли вернуть деньги?", a: "Если вы не использовали оплаченные услуги — да, полный возврат в течение 14 дней. За использованные услуги возврат не предусмотрен." },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {faqs.map((faq, i) => (
        <div key={i} style={{ background: "#16181d", borderRadius: "12px", border: "1px solid #2a2d35", overflow: "hidden" }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{ width: "100%", padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: "none", color: "#e0e0e0", fontSize: "15px", fontWeight: 500, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
          >
            <span>{faq.q}</span>
            <span style={{ color: "#c9a84c", fontSize: "18px", transform: open === i ? "rotate(45deg)" : "none", transition: "transform 0.2s", flexShrink: 0, marginLeft: "12px" }}>+</span>
          </button>
          {open === i && (
            <div style={{ padding: "0 20px 18px", fontSize: "14px", lineHeight: 1.6, color: "#888" }}>{faq.a}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ProgramLanding() {
  const pains = [
    { emoji: "😤", text: "Говоришь «да», когда хочешь сказать «нет» — и потом злишься на себя" },
    { emoji: "🎭", text: "Стараешься быть удобным для всех — а на себя сил не остаётся" },
    { emoji: "💣", text: "Копишь обиды молча, а потом взрываешься на ровном месте" },
    { emoji: "🙈", text: "Избегаешь конфликтов любой ценой — даже ценой собственных интересов" },
    { emoji: "🤝", text: "Помогаешь всем вокруг, но попросить о помощи сам — не можешь" },
    { emoji: "😶", text: "В отношениях подстраиваешься — и теряешь себя" },
  ];

  const steps = [
    { num: "01", title: "Выбираешь упражнение", desc: "46 упражнений по 7 главам книги. Каждое — конкретная работа над собой: от осознания паттернов до действий в реальной жизни." },
    { num: "02", title: "Работаешь с AI-ассистентом", desc: "Не тест и не анкета. Живой диалог: ассистент задаёт уточняющие вопросы, не даёт отвечать поверхностно, помогает копнуть глубже." },
    { num: "03", title: "Строишь свой портрет", desc: "С каждым упражнением AI собирает твой психологический портрет: паттерны, защитные механизмы, зоны роста. Он помнит всё и связывает одно с другим." },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0f1114", color: "#e0e0e0", fontFamily: "'Onest', -apple-system, sans-serif", overflowX: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Onest:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "1080px", margin: "0 auto" }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "20px", fontWeight: 600, color: "#c9a84c", letterSpacing: "-0.5px" }}>НеСлавный</div>
        <Link href="/auth" style={{ padding: "8px 20px", borderRadius: "8px", border: "1.5px solid rgba(201,168,76,0.4)", background: "transparent", color: "#c9a84c", fontSize: "14px", fontWeight: 500, textDecoration: "none" }}>Войти</Link>
      </nav>

      {/* HERO */}
      <section style={{ padding: "80px 24px 60px", maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: "13px", fontWeight: 500, color: "#c9a84c", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "20px", opacity: 0.8 }}>AI-тренажёр по книге Роберта Гловера</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(36px, 7vw, 56px)", fontWeight: 600, lineHeight: 1.1, color: "#ffffff", margin: "0 0 24px", letterSpacing: "-1px" }}>
          Хватит быть <span style={{ color: "#c9a84c", fontStyle: "italic" }}>славным парнем</span>
        </h1>
        <p style={{ fontSize: "18px", lineHeight: 1.6, color: "#999", maxWidth: "600px", margin: "0 auto 40px" }}>
          46 упражнений из книги «No More Mr. Nice Guy» с AI-ассистентом, который знает методологию, задаёт правильные вопросы и помнит всё, что ты ему рассказал.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/auth" style={{ padding: "14px 32px", borderRadius: "10px", background: "#c9a84c", color: "#0f1114", fontSize: "15px", fontWeight: 600, textDecoration: "none" }}>Начать бесплатно</Link>
          <a href="#how" style={{ padding: "14px 32px", borderRadius: "10px", border: "1.5px solid #2a2d35", background: "transparent", color: "#999", fontSize: "15px", fontWeight: 500, textDecoration: "none" }}>Как это работает</a>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section style={{ padding: "20px 24px 60px", maxWidth: "700px", margin: "0 auto", textAlign: "center" }}>
        <div style={{ display: "inline-flex", gap: "24px", padding: "16px 28px", background: "#16181d", borderRadius: "12px", border: "1px solid #2a2d35", flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { num: "200+", label: "встреч групп поддержки" },
            { num: "40+", label: "участников прошли программу" },
            { num: "46", label: "упражнений с AI" },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center", minWidth: "120px" }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "28px", fontWeight: 700, color: "#c9a84c" }}>{s.num}</div>
              <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PAIN POINTS */}
      <section style={{ padding: "40px 24px 60px", maxWidth: "800px", margin: "0 auto" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "32px", fontWeight: 600, textAlign: "center", marginBottom: "12px", color: "#fff" }}>Узнаёшь себя?</h2>
        <p style={{ textAlign: "center", color: "#666", fontSize: "15px", marginBottom: "36px" }}>Если хотя бы 2–3 пункта — про тебя, эта программа для тебя</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
          {pains.map((p, i) => (
            <div key={i} style={{ padding: "18px 20px", background: "#16181d", borderRadius: "12px", border: "1px solid #2a2d35", display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <span style={{ fontSize: "22px", flexShrink: 0, marginTop: "1px" }}>{p.emoji}</span>
              <span style={{ fontSize: "14px", lineHeight: 1.55, color: "#bbb" }}>{p.text}</span>
            </div>
          ))}
        </div>
      </section>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 24px" }}>
        <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, #2a2d35, transparent)" }} />
      </div>

      {/* HOW IT WORKS */}
      <section id="how" style={{ padding: "60px 24px", maxWidth: "800px", margin: "0 auto" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "32px", fontWeight: 600, textAlign: "center", marginBottom: "48px", color: "#fff" }}>Как это работает</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {steps.map((s) => (
            <div key={s.num} style={{ display: "flex", gap: "24px", alignItems: "flex-start", padding: "28px", background: "#16181d", borderRadius: "16px", border: "1px solid #2a2d35" }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "36px", fontWeight: 700, color: "#c9a84c", opacity: 0.5, lineHeight: 1, flexShrink: 0, minWidth: "48px" }}>{s.num}</div>
              <div>
                <h3 style={{ fontSize: "17px", fontWeight: 600, color: "#e0e0e0", marginBottom: "8px", marginTop: 0 }}>{s.title}</h3>
                <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#888", margin: 0 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AI DIFFERENCE */}
      <section style={{ padding: "40px 24px 60px", maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ padding: "32px", background: "linear-gradient(135deg, rgba(201,168,76,0.06), rgba(201,168,76,0.02))", borderRadius: "16px", border: "1px solid rgba(201,168,76,0.15)" }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "28px", fontWeight: 600, color: "#c9a84c", marginBottom: "16px", marginTop: 0 }}>Почему с AI, а не самому?</h2>
          <p style={{ fontSize: "15px", lineHeight: 1.7, color: "#999", marginBottom: "20px" }}>
            Опыт 200+ живых встреч показал: <strong style={{ color: "#c9a84c" }}>99% мужчин не доходят до конца самостоятельно</strong>.
            Упражнения кажутся простыми, но без правильных вопросов — ответы остаются на поверхности.
            Мозг защищает от неприятных открытий.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {[
              { label: "💬 Задаёт вопросы", desc: "Не даёт отделаться ответом «всё нормально»" },
              { label: "🧠 Помнит контекст", desc: "Связывает упражнение 2 с упражнением 15" },
              { label: "💜 Без осуждения", desc: "Рассказывай честно — AI не будет тебя оценивать" },
              { label: "🕐 Доступен 24/7", desc: "В 3 ночи, на перекуре, в обед — когда удобно" },
            ].map((item) => (
              <div key={item.label} style={{ padding: "14px", background: "rgba(15,17,20,0.5)", borderRadius: "10px" }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#c9a84c", marginBottom: "4px" }}>{item.label}</div>
                <div style={{ fontSize: "12px", color: "#777" }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: "40px 24px 60px", maxWidth: "960px", margin: "0 auto" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "32px", fontWeight: 600, textAlign: "center", marginBottom: "12px", color: "#fff" }}>Тарифы</h2>
        <p style={{ textAlign: "center", color: "#666", fontSize: "14px", marginBottom: "28px" }}>Выберите подписку или купите пакет токенов</p>
        <PricingTabs />
      </section>

      {/* FAQ */}
      <section style={{ padding: "40px 24px 60px", maxWidth: "700px", margin: "0 auto" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "32px", fontWeight: 600, textAlign: "center", marginBottom: "32px", color: "#fff" }}>Вопросы</h2>
        <FAQAccordion />
      </section>

      {/* CTA */}
      <section style={{ padding: "40px 24px 60px", textAlign: "center" }}>
        <div style={{ maxWidth: "600px", margin: "0 auto", padding: "40px 32px", background: "linear-gradient(135deg, rgba(201,168,76,0.08), rgba(201,168,76,0.02))", borderRadius: "20px", border: "1px solid rgba(201,168,76,0.15)" }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "28px", fontWeight: 600, color: "#fff", marginBottom: "12px", marginTop: 0 }}>Готов перестать быть удобным?</h2>
          <p style={{ color: "#888", fontSize: "15px", marginBottom: "24px" }}>Попробуй бесплатно. Без привязки карты.</p>
          <Link href="/auth" style={{ display: "inline-block", padding: "14px 40px", borderRadius: "10px", background: "#c9a84c", color: "#0f1114", fontSize: "15px", fontWeight: 600, textDecoration: "none" }}>Начать бесплатно</Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "32px 24px", borderTop: "1px solid #1c1f26", maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "24px" }}>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "18px", fontWeight: 600, color: "#c9a84c", marginBottom: "8px" }}>НеСлавный</div>
            <div style={{ fontSize: "12px", color: "#555", lineHeight: 1.7 }}>AI-тренажёр по методологии<br />«No More Mr. Nice Guy»</div>
          </div>
          <div style={{ fontSize: "12px", color: "#444", lineHeight: 1.8, textAlign: "right" }}>
            <div>ИП Орлов Семён Вячеславович</div>
            <div>ИНН: 381914223321 · ОГРНИП: 321385000066066</div>
            <Link href="/legal" style={{ color: "#666", textDecoration: "underline", textUnderlineOffset: "3px" }}>Оферта и политика конфиденциальности</Link>
          </div>
        </div>
        <div style={{ marginTop: "24px", textAlign: "center", fontSize: "11px", color: "#333" }}>© 2026</div>
      </footer>
    </div>
  );
}
