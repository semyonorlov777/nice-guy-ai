import { Metadata } from "next";
import { PricingTabs } from "@/components/landing/PricingTabs";
import { FAQAccordion } from "@/components/landing/FAQAccordion";
import Link from "next/link";

export const metadata: Metadata = {
  title: "НеСлавный — AI-тренажёр по книге «Хватит быть славным парнем»",
  description:
    "AI-ассистент проведёт тебя через 46 упражнений и поможет разобраться в себе",
};

export default function LandingPage() {
  return (
    <div className="landing">
      {/* ── Navbar ── */}
      <nav className="landing-nav">
        <span className="landing-logo">НеСлавный</span>
        <Link href="/auth" className="landing-btn landing-btn--small">
          Войти
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <p className="landing-hero-sub">
          AI-тренажёр по книге Роберта Гловера
        </p>
        <h1 className="landing-hero-title">
          Хватит быть{" "}
          <em className="landing-hero-accent">славным парнем</em>
        </h1>
        <div className="landing-hero-buttons">
          <Link href="/auth" className="landing-btn landing-btn--primary">
            Начать бесплатно
          </Link>
          <a href="#how" className="landing-btn landing-btn--ghost">
            Как это работает
          </a>
        </div>
      </section>

      {/* ── Social Proof ── */}
      <section className="landing-section">
        <div className="landing-card-grid landing-card-grid--3">
          <div className="landing-stat-card">
            <span className="landing-stat-num">200+</span>
            <span className="landing-stat-label">встреч групп поддержки</span>
          </div>
          <div className="landing-stat-card">
            <span className="landing-stat-num">40+</span>
            <span className="landing-stat-label">
              участников прошли программу
            </span>
          </div>
          <div className="landing-stat-card">
            <span className="landing-stat-num">46</span>
            <span className="landing-stat-label">упражнений с AI</span>
          </div>
        </div>
      </section>

      {/* ── Pain Points ── */}
      <section className="landing-section">
        <h2 className="landing-section-title">Узнаёшь себя?</h2>
        <div className="landing-card-grid">
          <div className="landing-card">
            <span className="landing-card-emoji">🤐</span>
            <p>
              Говоришь «да», когда хочешь сказать «нет» — и потом злишься на
              себя
            </p>
          </div>
          <div className="landing-card">
            <span className="landing-card-emoji">😮‍💨</span>
            <p>
              Стараешься быть удобным для всех — а на себя сил не остаётся
            </p>
          </div>
          <div className="landing-card">
            <span className="landing-card-emoji">🌋</span>
            <p>
              Копишь обиды молча, а потом взрываешься на ровном месте
            </p>
          </div>
          <div className="landing-card">
            <span className="landing-card-emoji">🏳️</span>
            <p>
              Избегаешь конфликтов любой ценой — даже ценой собственных
              интересов
            </p>
          </div>
          <div className="landing-card">
            <span className="landing-card-emoji">🤝</span>
            <p>
              Помогаешь всем вокруг, но попросить о помощи сам — не можешь
            </p>
          </div>
          <div className="landing-card">
            <span className="landing-card-emoji">🪞</span>
            <p>В отношениях подстраиваешься — и теряешь себя</p>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="landing-section" id="how">
        <h2 className="landing-section-title">Как это работает</h2>
        <div className="landing-card-grid landing-card-grid--3">
          <div className="landing-step-card">
            <span className="landing-step-num">01</span>
            <h3 className="landing-step-title">Выбираешь упражнение</h3>
            <p className="landing-step-desc">
              46 упражнений по 7 главам книги — от простых к глубоким
            </p>
          </div>
          <div className="landing-step-card">
            <span className="landing-step-num">02</span>
            <h3 className="landing-step-title">Работаешь с AI-ассистентом</h3>
            <p className="landing-step-desc">
              Живой диалог, уточняющие вопросы, поддержка на каждом шаге
            </p>
          </div>
          <div className="landing-step-card">
            <span className="landing-step-num">03</span>
            <h3 className="landing-step-title">Строишь свой портрет</h3>
            <p className="landing-step-desc">
              Паттерны, защитные механизмы, зоны роста — всё в одном месте
            </p>
          </div>
        </div>
      </section>

      {/* ── Why AI ── */}
      <section className="landing-section">
        <div className="landing-why-block">
          <p className="landing-why-headline">
            99% мужчин не доходят до конца самостоятельно
          </p>
          <div className="landing-card-grid landing-card-grid--2">
            <div className="landing-why-item">
              <span className="landing-why-icon">💬</span>
              <span>Задаёт вопросы</span>
            </div>
            <div className="landing-why-item">
              <span className="landing-why-icon">🧠</span>
              <span>Помнит контекст</span>
            </div>
            <div className="landing-why-item">
              <span className="landing-why-icon">🤍</span>
              <span>Без осуждения</span>
            </div>
            <div className="landing-why-item">
              <span className="landing-why-icon">🕐</span>
              <span>Доступен 24/7</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="landing-section" id="pricing">
        <h2 className="landing-section-title">Тарифы</h2>
        <PricingTabs />
      </section>

      {/* ── FAQ ── */}
      <section className="landing-section" id="faq">
        <h2 className="landing-section-title">Частые вопросы</h2>
        <FAQAccordion />
      </section>

      {/* ── CTA ── */}
      <section className="landing-cta">
        <h2 className="landing-cta-title">Готов перестать быть удобным?</h2>
        <Link href="/auth" className="landing-btn landing-btn--primary">
          Начать бесплатно
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-left">
            <span className="landing-logo">НеСлавный</span>
            <p className="landing-footer-desc">
              AI-тренажёр по книге «Хватит быть славным парнем»
            </p>
          </div>
          <div className="landing-footer-right">
            <p className="landing-footer-req">
              ИП Орлов Семён Вячеславович
            </p>
            <p className="landing-footer-req">
              ИНН: 381914223321 &middot; ОГРНИП: 321385000066066
            </p>
            <Link href="/legal" className="landing-footer-link">
              Оферта и политика конфиденциальности
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
