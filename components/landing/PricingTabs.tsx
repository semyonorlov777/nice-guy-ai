"use client";

import { useState } from "react";

const dFont = { fontFamily: "var(--font-display)" } as const;

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
      {/* Tab switcher */}
      <div className="flex gap-1 bg-[#1c1f26] rounded-xl p-1 w-fit mx-auto mb-8">
        <button
          className={`px-6 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
            tab === "subscriptions"
              ? "bg-[#c9a84c] text-white"
              : "bg-transparent text-[#9a978f] hover:text-[#e0e0e0]"
          }`}
          onClick={() => setTab("subscriptions")}
        >
          Подписка
        </button>
        <button
          className={`px-6 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
            tab === "tokens"
              ? "bg-[#c9a84c] text-white"
              : "bg-transparent text-[#9a978f] hover:text-[#e0e0e0]"
          }`}
          onClick={() => setTab("tokens")}
        >
          Пакеты токенов
        </button>
      </div>

      {/* Subscriptions */}
      {tab === "subscriptions" && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {subscriptions.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col gap-4 bg-[#16181d] border rounded-2xl py-7 px-6 ${
                plan.label ? "border-[#c9a84c]" : "border-[#2a2d35]"
              }`}
            >
              {plan.label && (
                <span className="absolute -top-2.5 left-6 bg-[#c9a84c] text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                  {plan.label}
                </span>
              )}
              <h3 className="text-xl font-semibold text-[#e0e0e0]" style={dFont}>
                {plan.name}
              </h3>
              <div className="text-[32px] font-semibold text-[#c9a84c]" style={dFont}>
                {plan.price} ₽
                <span className="text-base text-[#9a978f] font-normal">{plan.period}</span>
              </div>
              <ul className="flex flex-col gap-2">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-[#9a978f] pl-5 relative before:content-['✓'] before:absolute before:left-0 before:text-[#c9a84c] before:font-semibold">
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/auth"
                className="w-full text-center px-6 py-2.5 rounded-3xl text-sm font-medium text-[#c9a84c] border border-[#c9a84c] hover:bg-[rgba(201,168,76,0.1)] transition mt-auto"
              >
                Выбрать
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Token packs */}
      {tab === "tokens" && (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            {tokenPacks.map((pack) => (
              <div
                key={pack.name}
                className={`relative flex flex-col gap-4 bg-[#16181d] border rounded-2xl py-7 px-6 ${
                  pack.label ? "border-[#c9a84c]" : "border-[#2a2d35]"
                }`}
              >
                {pack.label && (
                  <span className="absolute -top-2.5 left-6 bg-[#c9a84c] text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                    {pack.label}
                  </span>
                )}
                <h3 className="text-xl font-semibold text-[#e0e0e0]" style={dFont}>
                  {pack.name}
                </h3>
                <p className="text-sm text-[#9a978f]">{pack.tokens} токенов</p>
                <div className="text-[32px] font-semibold text-[#c9a84c]" style={dFont}>
                  {pack.price} ₽
                </div>
                <p className="text-[13px] text-[#5f5d57]">{pack.desc}</p>
                <a
                  href="/auth"
                  className="w-full text-center px-6 py-2.5 rounded-3xl text-sm font-medium text-[#c9a84c] border border-[#c9a84c] hover:bg-[rgba(201,168,76,0.1)] transition mt-auto"
                >
                  Купить
                </a>
              </div>
            ))}
          </div>
          <p className="text-center text-[13px] text-[#5f5d57] mt-4">
            Токены не сгорают &middot; Единоразовая оплата
          </p>
        </>
      )}
    </>
  );
}
