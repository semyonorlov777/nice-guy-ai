"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Payment {
  id: string;
  created_at: string;
  amount: number;
  tokens: number;
  type: string;
  status: string;
}

const subscriptions = [
  {
    name: "Старт",
    price: 990,
    tokens: "3 000",
    features: ["3 000 токенов в месяц", "Все упражнения", "Психологический портрет"],
  },
  {
    name: "Стандарт",
    price: 2900,
    tokens: "10 000",
    recommended: true,
    features: [
      "10 000 токенов в месяц",
      "Все упражнения",
      "Психологический портрет",
      "Свободный чат",
    ],
  },
  {
    name: "Премиум",
    price: 7900,
    tokens: "50 000",
    features: [
      "50 000 токенов в месяц",
      "Всё из Стандарта",
      "Приоритетная поддержка",
    ],
  },
];

const tokenPacks = [
  { amount: "500", price: 1290 },
  { amount: "2 000", price: 3790 },
  { amount: "7 000", price: 14990 },
];

export function BalanceClient({
  balance,
  payments,
}: {
  balance: number;
  payments: Payment[];
}) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <div className="content-scroll">
      <div className="balance-container">
        {/* Header */}
        <div className="balance-header">
          <button className="balance-back" onClick={() => router.back()}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M10 3L5 8L10 13" />
            </svg>
            Назад
          </button>
          <h1 className="balance-title">Тариф и оплата</h1>
        </div>

        {/* Balance display */}
        <div className="balance-display">
          <div className="balance-display-icon">{"\u26A1"}</div>
          <div className="balance-display-info">
            <div className="balance-display-label">Текущий баланс</div>
            <div className="balance-display-value">
              {balance.toLocaleString("ru-RU")}{" "}
              <span className="balance-display-unit">токенов</span>
            </div>
          </div>
        </div>

        {/* Subscriptions */}
        <div className="balance-section">
          <h2 className="balance-section-title">Подписки</h2>
          <div className="balance-cards">
            {subscriptions.map((sub) => (
              <div
                key={sub.name}
                className={`balance-card${sub.recommended ? " recommended" : ""}`}
              >
                {sub.recommended && (
                  <div className="balance-card-badge">Рекомендуем</div>
                )}
                <div className="balance-card-name">{sub.name}</div>
                <div className="balance-card-price">
                  {sub.price.toLocaleString("ru-RU")} ₽
                  <span className="balance-card-period">/мес</span>
                </div>
                <div className="balance-card-tokens">{sub.tokens} токенов</div>
                <ul className="balance-card-features">
                  {sub.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <button
                  className={`balance-card-btn${sub.recommended ? " primary" : ""}`}
                  onClick={() =>
                    showToast("Оплата подписок скоро будет доступна")
                  }
                >
                  Подключить
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Token packs */}
        <div className="balance-section">
          <h2 className="balance-section-title">Пополнить токены</h2>
          <div className="balance-cards">
            {tokenPacks.map((pack) => (
              <div key={pack.amount} className="balance-card">
                <div className="balance-card-name">{pack.amount} токенов</div>
                <div className="balance-card-price">
                  {pack.price.toLocaleString("ru-RU")} ₽
                </div>
                <button
                  className="balance-card-btn"
                  onClick={() =>
                    showToast("Покупка токенов скоро будет доступна")
                  }
                >
                  Купить
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Payment history */}
        <div className="balance-section">
          <h2 className="balance-section-title">История операций</h2>
          {payments.length === 0 ? (
            <div className="balance-empty">Операций пока нет</div>
          ) : (
            <div className="balance-history">
              {payments.map((p) => (
                <div key={p.id} className="balance-history-row">
                  <div className="balance-history-date">
                    {new Date(p.created_at).toLocaleDateString("ru-RU")}
                  </div>
                  <div className="balance-history-desc">{p.type}</div>
                  <div className="balance-history-amount">
                    {p.tokens > 0 ? "+" : ""}
                    {p.tokens.toLocaleString("ru-RU")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && <div className="balance-toast">{toast}</div>}
    </div>
  );
}
