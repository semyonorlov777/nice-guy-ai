"use client";

import { useState } from "react";

const subscriptions = [
  {
    name: "Старт",
    price: "990",
    period: "/мес",
    features: [
      "Доступ ко всем упражнениям",
      "AI-ассистент",
      "Портрет",
      "Свободный чат",
    ],
  },
  {
    name: "Стандарт",
    price: "2 900",
    period: "/мес",
    label: "Популярный",
    features: [
      "Всё из Старт",
      "Увеличенный лимит",
      "Интенсивные сессии",
      "Приоритетная поддержка",
    ],
  },
  {
    name: "Премиум",
    price: "7 900",
    period: "/мес",
    features: [
      "Всё из Стандарт",
      "Максимальный лимит",
      "Доступ к новым тренажёрам",
      "Персональные рекомендации",
    ],
  },
];

const tokenPacks = [
  {
    name: "Стартовый",
    tokens: "1 000 000",
    price: "1 290",
    desc: "Протестировать платформу",
  },
  {
    name: "Стандартный",
    tokens: "5 000 000",
    price: "3 790",
    label: "Выгодно",
    desc: "Глубокое изучение 1 книги",
  },
  {
    name: "Мега",
    tokens: "50 000 000",
    price: "14 990",
    desc: "Для активных пользователей",
  },
];

type Tab = "subscriptions" | "tokens";

export function PricingTabs() {
  const [tab, setTab] = useState<Tab>("subscriptions");

  return (
    <>
      <div className="landing-pricing-tabs">
        <button
          className={`landing-pricing-tab ${tab === "subscriptions" ? "active" : ""}`}
          onClick={() => setTab("subscriptions")}
        >
          Подписка
        </button>
        <button
          className={`landing-pricing-tab ${tab === "tokens" ? "active" : ""}`}
          onClick={() => setTab("tokens")}
        >
          Пакеты токенов
        </button>
      </div>

      {tab === "subscriptions" && (
        <div className="landing-card-grid landing-card-grid--3">
          {subscriptions.map((plan) => (
            <div
              key={plan.name}
              className={`landing-pricing-card ${plan.label ? "landing-pricing-card--featured" : ""}`}
            >
              {plan.label && (
                <span className="landing-pricing-label">{plan.label}</span>
              )}
              <h3 className="landing-pricing-name">{plan.name}</h3>
              <div className="landing-pricing-price">
                {plan.price} ₽<span className="landing-pricing-period">{plan.period}</span>
              </div>
              <ul className="landing-pricing-features">
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <a href="/auth" className="landing-btn landing-btn--outline landing-btn--full">
                Выбрать
              </a>
            </div>
          ))}
        </div>
      )}

      {tab === "tokens" && (
        <>
          <div className="landing-card-grid landing-card-grid--3">
            {tokenPacks.map((pack) => (
              <div
                key={pack.name}
                className={`landing-pricing-card ${pack.label ? "landing-pricing-card--featured" : ""}`}
              >
                {pack.label && (
                  <span className="landing-pricing-label">{pack.label}</span>
                )}
                <h3 className="landing-pricing-name">{pack.name}</h3>
                <div className="landing-pricing-tokens">{pack.tokens} токенов</div>
                <div className="landing-pricing-price">{pack.price} ₽</div>
                <p className="landing-pricing-desc">{pack.desc}</p>
                <a href="/auth" className="landing-btn landing-btn--outline landing-btn--full">
                  Купить
                </a>
              </div>
            ))}
          </div>
          <p className="landing-tokens-note">
            Токены не сгорают &middot; Единоразовая оплата
          </p>
        </>
      )}
    </>
  );
}
