# ADR-001: Dual AI SDK — Vercel AI SDK + нативный Google SDK

**Статус:** accepted
**Дата:** 2026-03-28

> **Контекст для Claude Code:** Читай при добавлении новой AI-фичи, смене модели, изменении стриминга или работе с портретом.

## Контекст

Платформа использует Google Gemini для двух принципиально разных задач:

1. **Чат** — стриминг ответов в реальном времени, интеграция с React (useChat), метаданные в потоке
2. **Портрет** — одноразовая генерация структурированного JSON (анализ пользователя), нужен `responseMimeType: "application/json"`

На момент принятия решения Vercel AI SDK (`@ai-sdk/google`) не поддерживал `responseMimeType` и `systemInstruction` в нативном формате Google. При этом для чата Vercel AI SDK давал критичные преимущества: стриминг, `useChat`, `toUIMessageStreamResponse()`.

## Решение

Два SDK, одна API-переменная:

### Чат — Vercel AI SDK (`@ai-sdk/google`)

```typescript
// lib/ai.ts
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY!, // Кастомное имя (не GOOGLE_GENERATIVE_AI_API_KEY)
});
```

Используется в `app/api/chat/route.ts`:
```typescript
const result = streamText({
  model: google("gemini-2.5-flash"),
  system: systemPrompt,
  messages: geminiHistory,
  onFinish: async ({ text, usage }) => { /* сохранение, токены, портрет */ },
});
return result.toUIMessageStreamResponse({ messageMetadata: () => ({ chatId }) });
```

### Портрет — нативный Google SDK (`@google/generative-ai`)

```typescript
// lib/gemini-portrait.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-pro",           // Pro — больше reasoning
  systemInstruction: systemPrompt,
  generationConfig: {
    temperature: 0.3,                  // Детерминированность
    responseMimeType: "application/json", // Гарантированный JSON
  },
});
```

### Разделение моделей

| Задача | SDK | Модель | Причина |
|--------|-----|--------|---------|
| Чат | Vercel AI SDK | gemini-2.5-flash | Быстрый, дешёвый, стриминг |
| Портрет | Нативный Google | gemini-2.5-pro | Глубокий reasoning, JSON output |

## Альтернативы

| Вариант | Почему отвергнут |
|---------|------------------|
| Только Vercel AI SDK для всего | Не поддерживал `responseMimeType` для гарантированного JSON |
| Только нативный Google SDK | Потеря стриминга, useChat, UI интеграции |
| OpenAI вместо Gemini | Дороже, нет `responseMimeType`, русский язык хуже |
| Два разных API-ключа | Излишне — один ключ работает для обоих SDK |

## Последствия

**Плюсы:**
- Стриминг чата "из коробки" через Vercel AI SDK
- Гарантированный JSON для портрета через `responseMimeType`
- Один API-ключ (`GOOGLE_GEMINI_API_KEY`) для обоих SDK
- Возможность использовать разные модели (Flash vs Pro) под разные задачи

**Минусы / trade-offs:**
- Две зависимости: `@ai-sdk/google` + `@google/generative-ai`
- Кастомное имя env-переменной (Vercel SDK по умолчанию ищет `GOOGLE_GENERATIVE_AI_API_KEY`)
- При обновлении SDK нужно проверять оба пакета

## Правила для нового кода

**DO:**
- Новая чат-фича (стриминг, интерактив) → используй `lib/ai.ts` + Vercel AI SDK
- Новый фоновый анализ (JSON output, без стриминга) → используй `lib/gemini-portrait.ts`
- Модель портрета настраивается через env `GEMINI_PORTRAIT_MODEL` (default: gemini-2.5-pro)

**DON'T:**
- Не создавай третий файл для AI — всё через `lib/ai.ts` или `lib/gemini-portrait.ts`
- Не используй `GOOGLE_GENERATIVE_AI_API_KEY` — у нас `GOOGLE_GEMINI_API_KEY`
- Не вызывай нативный SDK для стриминга — Vercel AI SDK делает это лучше

## Связанные файлы

- `lib/ai.ts` — Vercel AI SDK провайдер (8 строк)
- `lib/gemini-portrait.ts` — нативный Google SDK для портрета (25 строк)
- `app/api/chat/route.ts` — использует Vercel AI SDK стриминг
- `lib/prompts/portrait-analyst.ts` — промпт для анализа портрета
