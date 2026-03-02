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
    name: "Про",
    price: 990,
    tokens: "500",
    features: ["500 токенов в месяц", "Все упражнения", "Психологический портрет"],
  },
  {
    name: "Макс",
    price: 2900,
    tokens: "2 000",
    recommended: true,
    features: [
      "2 000 токенов в месяц",
      "Все упражнения",
      "Психологический портрет",
      "Свободный чат",
    ],
  },
  {
    name: "Ультра",
    price: 7900,
    tokens: "7 000",
    features: [
      "7 000 токенов в месяц",
      "Всё из Макса",
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
                  <div className="balance-card-badge">Популярный</div>
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

        {/* Anti-fear block */}
        <div className="balance-trust">
          <div className="balance-trust-item">
            <svg className="balance-trust-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9L9 15" />
              <path d="M9 9L15 15" />
            </svg>
            <span>Отмена в 1 клик — прямо в личном кабинете, без звонков</span>
          </div>
          <div className="balance-trust-item">
            <svg className="balance-trust-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span>Напомним за 3 дня до списания</span>
          </div>
          <div className="balance-trust-item">
            <svg className="balance-trust-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span>Без скрытых условий и штрафов за отмену</span>
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
