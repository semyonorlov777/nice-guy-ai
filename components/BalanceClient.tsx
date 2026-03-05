"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Payment {
  id: string;
  created_at: string;
  amount: number;
  tokens_added: number;
  yookassa_id: string;
  status: string;
}

const PLAN_NAMES: Record<string, { name: string; tokens: string }> = {
  sub_pro: { name: "Про", tokens: "500" },
  sub_max: { name: "Макс", tokens: "2 000" },
  sub_ultra: { name: "Ультра", tokens: "7 000" },
};

const subscriptions = [
  {
    name: "Про",
    price: 990,
    tokens: "500",
    productKey: "sub_pro",
    features: ["500 токенов в месяц", "Все упражнения", "Психологический портрет"],
  },
  {
    name: "Макс",
    price: 2900,
    tokens: "2 000",
    productKey: "sub_max",
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
    productKey: "sub_ultra",
    features: [
      "7 000 токенов в месяц",
      "Всё из Макса",
      "Приоритетная поддержка",
    ],
  },
];

const tokenPacks = [
  { amount: "500", price: 1290, productKey: "tokens_500" },
  { amount: "2 000", price: 3790, productKey: "tokens_2000" },
  { amount: "7 000", price: 14990, productKey: "tokens_7000" },
];

export function BalanceClient({
  balance,
  payments,
  subscription,
  paymentComplete,
  orderId,
}: {
  balance: number;
  payments: Payment[];
  subscription?: {
    plan: string | null;
    expiresAt: string | null;
    cardLast4: string | null;
  } | null;
  paymentComplete?: boolean;
  orderId?: string;
}) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [loadingProduct, setLoadingProduct] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<
    "polling" | "succeeded" | "timeout" | null
  >(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Payment return polling
  useEffect(() => {
    if (!paymentComplete || !orderId) return;

    setPaymentStatus("polling");
    const startTime = Date.now();

    const checkStatus = async () => {
      try {
        const res = await fetch(
          `/api/payments/status?order_id=${encodeURIComponent(orderId)}`
        );
        const data = await res.json();

        if (data.status === "succeeded") {
          setPaymentStatus("succeeded");
          if (pollingRef.current) clearInterval(pollingRef.current);
          setTimeout(() => router.refresh(), 2000);
          return;
        }

        if (data.status === "canceled") {
          setPaymentStatus(null);
          if (pollingRef.current) clearInterval(pollingRef.current);
          showToast("Платёж отменён");
          return;
        }
      } catch {
        // ignore network errors, keep polling
      }

      if (Date.now() - startTime > 30000) {
        setPaymentStatus("timeout");
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    };

    checkStatus();
    pollingRef.current = setInterval(checkStatus, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [paymentComplete, orderId, router, showToast]);

  const handlePurchase = async (productKey: string) => {
    setLoadingProduct(productKey);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productKey }),
      });
      const data = await res.json();

      if (data.confirmation_url) {
        window.location.href = data.confirmation_url;
      } else {
        showToast(data.error || "Ошибка создания платежа");
      }
    } catch {
      showToast("Ошибка сети");
    } finally {
      setLoadingProduct(null);
    }
  };

  const handleUnlinkCard = async () => {
    const last4 = subscription?.cardLast4 || "";
    if (!confirm(`Отвязать карту •••• ${last4}? Автопродление будет отключено.`)) return;

    setLoadingAction("unlink");
    try {
      await fetch("/api/payments/unlink-card", { method: "POST" });
      showToast("Карта отвязана");
      router.refresh();
    } catch {
      showToast("Ошибка сети");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Отменить подписку? Доступ сохранится до конца оплаченного периода.")) return;

    setLoadingAction("cancel");
    try {
      await fetch("/api/payments/cancel-subscription", { method: "POST" });
      showToast("Подписка отменена");
      router.refresh();
    } catch {
      showToast("Ошибка сети");
    } finally {
      setLoadingAction(null);
    }
  };

  const isAnyLoading = loadingProduct !== null;

  // Subscription state
  const isSubExpired =
    !subscription?.expiresAt ||
    new Date(subscription.expiresAt) <= new Date();
  const hasPlan = !!subscription?.plan;
  const hasCard = !!subscription?.cardLast4;
  const showSubBlock = subscription && !isSubExpired;

  // Resolve plan name from plan key or fallback
  const subPlanKey = subscription?.plan;
  const activePlan = subPlanKey ? PLAN_NAMES[subPlanKey] : null;

  // For states Б and В — find plan name by matching expiresAt existence
  // If plan was canceled but expiresAt still in future, show last known plan info
  const displayPlan = activePlan;

  // State: A = hasPlan && hasCard, B = hasPlan && !hasCard, C = !hasPlan (but expiresAt in future)
  const subState: "A" | "B" | "C" | null = showSubBlock
    ? hasPlan && hasCard
      ? "A"
      : hasPlan && !hasCard
        ? "B"
        : "C"
    : null;

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

        {/* Payment status banner */}
        {paymentStatus && (
          <div className="balance-payment-status">
            {paymentStatus === "polling" && (
              <>
                <span className="balance-payment-status-spinner" />
                Платёж обрабатывается...
              </>
            )}
            {paymentStatus === "succeeded" && (
              <>Оплата прошла! Баланс пополнен</>
            )}
            {paymentStatus === "timeout" && (
              <>Платёж обрабатывается, токены скоро появятся на балансе</>
            )}
          </div>
        )}

        {/* Active subscription block */}
        {subState && (
          <div className={`balance-subscription${subState === "C" ? " canceled" : ""}`}>
            <div className="balance-subscription-header">
              {subState === "A" && (
                <span className="balance-subscription-badge">Активна</span>
              )}
              {subState === "B" && (
                <span className="balance-subscription-badge warning">Не продлится</span>
              )}
              {subState === "C" && (
                <span className="balance-subscription-badge muted">Отменена</span>
              )}
              <span className="balance-subscription-name">
                Подписка {displayPlan?.name || ""}
              </span>
            </div>

            <div className="balance-subscription-details">
              {subscription?.expiresAt && (
                <div className="balance-subscription-expires">
                  {subState === "C" ? "Доступ до" : "Активна до"}{" "}
                  {new Date(subscription.expiresAt).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              )}
              {displayPlan && (
                <div className="balance-subscription-tokens">
                  {displayPlan.tokens} токенов / месяц
                </div>
              )}
            </div>

            {subState === "A" && (
              <>
                <div className="balance-subscription-card">
                  <span className="balance-subscription-card-info">
                    {"\uD83D\uDCB3"} •••• {subscription?.cardLast4}
                  </span>
                  <button
                    className="balance-subscription-unlink"
                    disabled={loadingAction !== null}
                    onClick={handleUnlinkCard}
                  >
                    {loadingAction === "unlink" ? "..." : "Отвязать"}
                  </button>
                </div>
                <button
                  className="balance-subscription-cancel"
                  disabled={loadingAction !== null}
                  onClick={handleCancelSubscription}
                >
                  {loadingAction === "cancel" ? "Отмена..." : "Отменить подписку"}
                </button>
              </>
            )}

            {subState === "B" && (
              <>
                <div className="balance-subscription-note">
                  Карта не привязана. Автопродление отключено.
                </div>
                <button
                  className="balance-subscription-cancel"
                  disabled={loadingAction !== null}
                  onClick={handleCancelSubscription}
                >
                  {loadingAction === "cancel" ? "Отмена..." : "Отменить подписку"}
                </button>
              </>
            )}

            {subState === "C" && (
              <div className="balance-subscription-note">
                Подписка отменена. Доступ сохранится до конца оплаченного периода.
              </div>
            )}
          </div>
        )}

        {/* Subscriptions */}
        <div className="balance-section">
          <h2 className="balance-section-title">Подписки</h2>
          <div className="balance-cards">
            {subscriptions.map((sub) => {
              const isActive = hasPlan && subscription?.plan === sub.productKey;
              return (
                <div
                  key={sub.name}
                  className={`balance-card${sub.recommended ? " recommended" : ""}`}
                >
                  {sub.recommended && !isActive && (
                    <div className="balance-card-badge">Популярный</div>
                  )}
                  {isActive && (
                    <div className="balance-card-badge active">Активна</div>
                  )}
                  <div className="balance-card-name">{sub.name}</div>
                  <div className="balance-card-price">
                    {sub.price.toLocaleString("ru-RU")} ₽
                    <span className="balance-card-period">/мес</span>
                  </div>
                  <div className="balance-card-tokens">
                    {sub.tokens} токенов
                  </div>
                  <ul className="balance-card-features">
                    {sub.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  {isActive ? (
                    <div className="balance-card-btn active-label">
                      Текущий план
                    </div>
                  ) : (
                    <button
                      className={`balance-card-btn${sub.recommended ? " primary" : ""}`}
                      disabled={isAnyLoading}
                      onClick={() => handlePurchase(sub.productKey)}
                    >
                      {loadingProduct === sub.productKey
                        ? "Переход к оплате..."
                        : "Подключить"}
                    </button>
                  )}
                </div>
              );
            })}
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
                  disabled={isAnyLoading}
                  onClick={() => handlePurchase(pack.productKey)}
                >
                  {loadingProduct === pack.productKey
                    ? "Переход к оплате..."
                    : "Купить"}
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
                  <div className="balance-history-desc">
                    +{p.tokens_added.toLocaleString("ru-RU")} токенов
                  </div>
                  <div className="balance-history-amount">
                    {p.amount.toLocaleString("ru-RU")} ₽
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
