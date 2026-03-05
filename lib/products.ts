export interface Product {
  key: string;
  type: "token_pack" | "subscription";
  name: string;
  description: string;
  amount: number; // Цена в рублях (целое число)
  tokens: number; // Сколько токенов начислить
}

export const PRODUCTS: Record<string, Product> = {
  // Пакеты токенов
  tokens_500: {
    key: "tokens_500",
    type: "token_pack",
    name: "500 токенов",
    description: "Пакет 500 токенов",
    amount: 1, // TEMP: тест боевых платежей, вернуть 1290
    tokens: 500,
  },
  tokens_2000: {
    key: "tokens_2000",
    type: "token_pack",
    name: "2 000 токенов",
    description: "Пакет 2 000 токенов",
    amount: 3790,
    tokens: 2000,
  },
  tokens_7000: {
    key: "tokens_7000",
    type: "token_pack",
    name: "7 000 токенов",
    description: "Пакет 7 000 токенов",
    amount: 14990,
    tokens: 7000,
  },
  // Подписки (пока работают как разовые платежи за токены)
  sub_pro: {
    key: "sub_pro",
    type: "subscription",
    name: "Подписка Про",
    description: "Подписка Про — 500 токенов/мес",
    amount: 990,
    tokens: 500,
  },
  sub_max: {
    key: "sub_max",
    type: "subscription",
    name: "Подписка Макс",
    description: "Подписка Макс — 2 000 токенов/мес",
    amount: 2900,
    tokens: 2000,
  },
  sub_ultra: {
    key: "sub_ultra",
    type: "subscription",
    name: "Подписка Ультра",
    description: "Подписка Ультра — 7 000 токенов/мес",
    amount: 7900,
    tokens: 7000,
  },
};
