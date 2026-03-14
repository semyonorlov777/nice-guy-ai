# Миграция чата на Vercel AI SDK

## Текущая архитектура

### Карта файлов

```
Серверная часть (API):
├── app/api/chat/route.ts              # Authenticated chat — SSE стриминг, бизнес-логика (443 строки)
├── app/api/chat/anonymous/route.ts    # Anonymous chat — rate limit, лимиты сообщений (189 строк)
├── app/api/chat/migrate/route.ts      # Миграция анонимных сообщений при регистрации
├── app/api/portrait/update/route.ts   # Auto-update портрета (вызывается из chat/route.ts)
├── lib/gemini.ts                      # streamChat() — Gemini 2.5 Flash, retry logic (52 строки)
└── lib/gemini-portrait.ts             # analyzeForPortrait() — Gemini 2.5 Pro, JSON mode

Клиентская часть (UI):
├── components/ChatWindow.tsx          # Authenticated chat UI — fetch + SSE парсинг (308 строк)
├── components/AnonymousChat.tsx       # Anonymous chat UI — localStorage, InChatAuth (395 строк)
├── components/InChatAuth.tsx          # Popup авторизации в чате
├── app/program/[slug]/(app)/chat/page.tsx           # Страница свободного чата
└── app/program/[slug]/(app)/exercise/[number]/page.tsx  # Страница упражнения

Стили:
└── app/globals.css                    # CSS секции: CHAT ZONE, MESSAGES, INPUT, QUICK REPLIES
```

### Потоки данных

**Authenticated Chat:**
```
ChatWindow.tsx
  → fetch POST /api/chat { message, chatId, programId, exerciseId, chatType }
  → route.ts: auth → balance → program → exercise → portrait → find/create chat → save user msg
  → streamChat(systemPrompt, history, message)
  → SSE stream: chat_id → delta* → done { tokensUsed }
  → save AI msg → deduct tokens → ISSP parse → portrait update
```

**Anonymous Chat:**
```
AnonymousChat.tsx
  → fetch POST /api/chat/anonymous { session_id, messages[], program_slug }
  → anonymous/route.ts: rate limit → validate → message limit → token limit → program
  → streamChat(systemPrompt, history, lastMessage)
  → SSE stream: delta* → done
  (ничего не сохраняется в БД)
```

### Зависимости

| Файл | Импортирует | Таблицы Supabase |
|------|------------|-----------------|
| `app/api/chat/route.ts` | `lib/gemini.ts`, `lib/supabase-server.ts`, `portrait/update/route.ts`, `lib/issp-*` | profiles, programs, exercises, portraits, chats, messages, test_results |
| `app/api/chat/anonymous/route.ts` | `lib/gemini.ts`, `lib/supabase-server.ts`, `lib/config.ts` | programs, app_config |
| `app/api/chat/migrate/route.ts` | `lib/supabase-server.ts` | programs, chats, messages |
| `components/ChatWindow.tsx` | `react`, `react-markdown` | — (через API) |
| `components/AnonymousChat.tsx` | `react`, `react-markdown`, `InChatAuth` | — (через API) |

### Переменные окружения (текущие)

```
GOOGLE_GEMINI_API_KEY          # Ключ для @google/generative-ai
GEMINI_PORTRAIT_MODEL          # Модель портрета (default: gemini-2.5-pro)
NEXT_PUBLIC_SUPABASE_URL       # Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY      # Supabase service role
```

---

## Бизнес-логика которую сохраняем

### Authenticated Chat (`app/api/chat/route.ts`)

| # | Логика | Строки | Описание |
|---|--------|--------|----------|
| 1 | **Auth check** | 15-21 | `supabase.auth.getUser()`, 401 если нет |
| 2 | **Auto-create profile** | 36-58 | Если профиля нет — создать с `DEFAULT_BALANCE = 1000` через service client |
| 3 | **Balance check** | 60-62 | `balance_tokens <= 0` → 403 |
| 4 | **Load program** | 65-74 | `system_prompt`, `free_chat_welcome`, `test_system_prompt` |
| 5 | **Load exercise** | 77-86 | `system_prompt`, `title`, `welcome_message` (если exerciseId) |
| 6 | **Load portrait** | 89-96 | `portrait.content.ai_context` для контекста в system prompt |
| 7 | **Find/create chat** | 98-202 | По user_id + program_id + exercise_id + status="active". Типы: free, exercise, test |
| 8 | **Test mode init** | 149-156 | `test_state: { current_question: 0, status: "in_progress", answers: [] }` |
| 9 | **Welcome message** | 180-190 | Вставка в messages при создании нового чата (не для test) |
| 10 | **Message history** | 204-236 | Загрузка из БД, фильтрация leading "model" msgs (Gemini требование) |
| 11 | **System prompt build** | 212-226 | Program + exercise + portrait ai_context |
| 12 | **Save user message** | 238-252 | `messages.insert({ role: "user", ... })` перед стримингом |
| 13 | **Save AI message** | 297-302 | `messages.insert({ role: "assistant", tokens_used })` после стриминга |
| 14 | **Token deduction** | 304-311 | `Math.max(0, balance - tokensUsed)` → `profiles.update` |
| 15 | **Return chat_id** | 271-277 | SSE event `chat_id` при создании нового чата |
| 16 | **ISSP test parsing** | 320-391 | `parseAIResponse()` → обновление `test_state.answers` → `calculateISSP()` при 35+ ответах |
| 17 | **Portrait auto-update** | 394-413 | Каждые 5 user-сообщений → `updatePortrait()` fire-and-forget (не для test) |
| 18 | **Retry logic** | `lib/gemini.ts:35-48` | 3 попытки с 2с задержкой при 429 от Gemini |

### Anonymous Chat (`app/api/chat/anonymous/route.ts`)

| # | Логика | Строки | Описание |
|---|--------|--------|----------|
| 1 | **IP rate limit** | 7-23, 39-44 | In-memory Map, 30 req/min per IP |
| 2 | **Validate body** | 46-77 | session_id UUID, program_slug, messages array, content ≤ 5000 |
| 3 | **Message limit** | 80-88 | `getConfig("anonymous_chat_max_messages", 10)` → 429 `{ requiresAuth: true }` |
| 4 | **Token limit** | 91-99 | `getConfig("anonymous_chat_token_limit", 100000)` → 429 `{ requiresAuth: true }` |
| 5 | **System prompt** | 114-115 | `anonymous_system_prompt` или fallback |
| 6 | **History filter** | 130-132 | Фильтрация leading "model" messages |

### Chat Migration (`app/api/chat/migrate/route.ts`)

- Auth required
- Создаёт чат + вставляет все сообщения с staggered timestamps
- Если у пользователя уже есть active free chat — возвращает его id

---

## Что меняется при миграции

### Серверная часть

| Компонент | Было | Станет |
|-----------|------|--------|
| **AI SDK** | `@google/generative-ai` → `streamChat()` | `ai` + `@ai-sdk/google` → `streamText()` |
| **Модель** | `genAI.getGenerativeModel({ model: "gemini-2.5-flash" })` | `google("gemini-2.5-flash")` |
| **System prompt** | `systemInstruction: systemPrompt` (в getGenerativeModel) | `system: systemPrompt` (в streamText) |
| **История** | `Content[]` формат Gemini (`role: "model"/"user"`, `parts`) | `CoreMessage[]` формат AI SDK (`role: "assistant"/"user"`, `content`) |
| **Стриминг** | Ручной `ReadableStream` + `TextEncoder` + `data: JSON\n\n` | `result.toUIMessageStreamResponse()` |
| **SSE события** | Custom: `chat_id`, `delta`, `done`, `error` | Стандартный UI message stream протокол |
| **Передача chatId** | SSE event `{ type: "chat_id", chatId }` | `messageMetadata` в stream response |
| **Передача tokensUsed** | SSE event `{ type: "done", tokensUsed }` | `messageMetadata` в `onFinish` part |
| **Post-stream логика** | Внутри `ReadableStream.start()` после `for await` | `onFinish` callback в `streamText()` |
| **Retry при 429** | Ручной в `lib/gemini.ts` (3 попытки) | Встроенный в `@ai-sdk/google` или свой wrapper |
| **Файл gemini.ts** | `streamChat()` — основная функция | Удаляется (заменяется `streamText` inline) |

### Клиентская часть

| Компонент | Было | Станет |
|-----------|------|--------|
| **Стриминг** | `fetch()` + `reader.read()` + ручной SSE парсинг (60 строк) | `useChat` хук (5 строк настройки) |
| **Стейт сообщений** | `useState<Message[]>` + ручное обновление | `messages` из `useChat` |
| **Отправка** | `sendMessage()` с ручным fetch | `sendMessage()` из `useChat` |
| **Статус стриминга** | `useState(isStreaming)` | `status` из `useChat` ("streaming", "ready") |
| **Input** | Ручной `useState(input)` | Ручной `useState(input)` (useChat не управляет input) |
| **Формат сообщений** | `{ role, content }` | `UIMessage { id, role, parts: [{ type: "text", text }] }` |
| **Welcome message** | Рендер из prop если `initialMessages.length === 0` | `initialMessages` с welcome в формате UIMessage |
| **chatId получение** | Из SSE event `chat_id` | Из `message.metadata.chatId` |
| **Retry** | Ручной: удалить последнее, пере-send | `regenerate()` из `useChat` |

---

## Что НЕ меняется

- **CSS/стили** — все классы `.chat-zone`, `.msg`, `.msg-bubble` и т.д. остаются
- **Supabase клиенты** — `createClient()`, `createServiceClient()` без изменений
- **Таблицы БД** — chats, messages, profiles, portraits, test_results — та же структура
- **Portrait update** — `lib/gemini-portrait.ts` и `app/api/portrait/update/route.ts` остаются (используют Gemini Pro напрямую)
- **ISSP тест** — `lib/issp-config.ts`, `lib/issp-parser.ts`, `lib/issp-scoring.ts` без изменений
- **Middleware** — `middleware.ts` без изменений
- **Chat migrate** — `app/api/chat/migrate/route.ts` без изменений
- **InChatAuth** — `components/InChatAuth.tsx` без изменений
- **Страницы chat/page.tsx и exercise/[number]/page.tsx** — серверная загрузка данных та же, только props для нового компонента
- **Config system** — `lib/config.ts` без изменений
- **Portrait промпт** — `lib/prompts/portrait-analyst.ts` без изменений

---

## Риски и потенциальные проблемы

### 1. ENV переменная
**Проблема:** `@ai-sdk/google` ожидает `GOOGLE_GENERATIVE_AI_API_KEY`, у нас `GOOGLE_GEMINI_API_KEY`.
**Решение:** Явно передавать `apiKey` при создании провайдера:
```typescript
const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
```

### 2. Формат истории сообщений (Gemini "user first" requirement)
**Проблема:** Gemini требует чтобы история начиналась с "user". Текущий код фильтрует leading "model" messages. Vercel AI SDK может не делать этого автоматически.
**Решение:** Фильтровать сообщения перед передачей в `streamText()`. AI SDK автоматически маппит `assistant` → `model` для Gemini.

### 3. Token usage формат
**Проблема:** Текущий код использует `response.usageMetadata.totalTokenCount` (Gemini SDK). Vercel AI SDK возвращает `usage: { totalTokens, inputTokens, outputTokens }` (другие имена полей).
**Решение:** Использовать `usage.totalTokens` в `onFinish`.

### 4. Streaming cursor и thinking indicator
**Проблема:** Текущий UI показывает "думаю..." пока content пустой, и streaming cursor во время стриминга. С `useChat` — другая модель: `status === "submitted"` (думаю) и `status === "streaming"` (стриминг).
**Решение:** Использовать `status` из `useChat` вместо проверки пустого content.

### 5. chatId при создании нового чата
**Проблема:** Текущий код отправляет SSE event `chat_id`. С Vercel AI SDK нет кастомных SSE events.
**Решение:** Передавать chatId через `messageMetadata`. Клиент получает из `message.metadata`.

### 6. Ошибки баланса/авторизации (до стриминга)
**Проблема:** Текущий код возвращает JSON ошибки (401, 403, 404) до начала стрима. `useChat` ожидает stream response.
**Решение:** Оставить как есть — `useChat` обрабатывает HTTP ошибки через `onError` callback. Non-200 ответы не парсятся как stream.

### 7. Anonymous chat rate limit (429 с requiresAuth)
**Проблема:** Текущий код при 429 возвращает `{ requiresAuth: true }`, клиент показывает InChatAuth. С `useChat` нужен доступ к response body при ошибке.
**Решение:** В `onError` — проверять `error.message` или использовать кастомный fetch с перехватом 429.

### 8. Retry logic для Gemini 429
**Проблема:** `lib/gemini.ts` имеет retry при 429 от Gemini. `@ai-sdk/google` не имеет встроенного retry.
**Решение:** Обернуть `streamText` в retry wrapper или использовать `maxRetries` параметр `streamText` (если поддерживается). Иначе — свой wrapper.

### 9. Anonymous chat — полная история в каждом запросе
**Проблема:** `useChat` по умолчанию отправляет все сообщения. Это совпадает с текущим поведением anonymous chat. Но формат сообщений другой (UIMessage vs {role, content}).
**Решение:** На сервере конвертировать UIMessage → {role, content} через `convertToModelMessages()`.

### 10. localStorage и useChat
**Проблема:** AnonymousChat сохраняет/загружает сообщения из localStorage. `useChat` управляет своим стейтом.
**Решение:** Использовать `initialMessages` для загрузки из localStorage и `onFinish` для сохранения.

---

## Пошаговый план

### Шаг 1: Базовый стриминг

**Цель:** Установить пакеты, создать минимальный API route с `streamText` + `@ai-sdk/google`, убедиться что стриминг работает.

#### 1.1 Установка пакетов

```bash
npm install ai @ai-sdk/google @ai-sdk/react
```

#### 1.2 Создать `lib/ai.ts` — Google provider

```typescript
// lib/ai.ts
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Используем существующую переменную GOOGLE_GEMINI_API_KEY
// (@ai-sdk/google по умолчанию ищет GOOGLE_GENERATIVE_AI_API_KEY)
export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY!,
});
```

#### 1.3 Создать `app/api/chat/v2/route.ts` — минимальный стриминг

```typescript
// app/api/chat/v2/route.ts
import { streamText, type UIMessage } from "ai";
import { google } from "@/lib/ai";
import { createClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Не авторизован" }, { status: 401 });
  }

  // Parse body (пока без бизнес-логики)
  const { message, programId } = await request.json();

  // Минимальный стриминг
  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: "Ты — AI-ассистент. Отвечай на русском.",
    messages: [{ role: "user", content: message }],
  });

  return result.toUIMessageStreamResponse();
}
```

#### 1.4 Проверка

1. Запустить `npm run dev`
2. Отправить POST на `http://localhost:3000/api/chat/v2` с `{ "message": "Привет", "programId": "test" }`
3. Убедиться что стриминг работает и возвращает текст

---

### Шаг 2: ChatWindowV2 на useChat

**Цель:** Создать новый клиентский компонент с `useChat`, сохранив тот же UI и CSS.

#### 2.1 Создать `components/ChatWindowV2.tsx`

```typescript
// components/ChatWindowV2.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat, DefaultChatTransport } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import type { UIMessage } from "ai";

interface ChatWindowV2Props {
  initialMessages: UIMessage[];
  chatId: string | null;
  programId: string;
  exerciseId?: string;
  chatType?: "exercise" | "free" | "test";
  userInitial: string;
  welcomeMessage?: string;
  quickReplies?: string[];
  children?: React.ReactNode;
}

export function ChatWindowV2({
  initialMessages,
  chatId: initialChatId,
  programId,
  exerciseId,
  chatType,
  userInitial,
  welcomeMessage,
  quickReplies,
  children,
}: ChatWindowV2Props) {
  const [currentChatId, setCurrentChatId] = useState<string | null>(initialChatId);
  const [showQuickReplies, setShowQuickReplies] = useState(initialMessages.length === 0);
  const [input, setInput] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isUserScrolledUp = useRef(false);

  const {
    messages,
    sendMessage,
    status,
    error,
    regenerate,
    setMessages,
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat/v2",
      // Кастомизация запроса: отправляем только последнее сообщение + метаданные
      // (историю сервер грузит из БД)
      body: () => ({
        chatId: currentChatId,
        programId,
        exerciseId,
        chatType,
      }),
    }),
    initialMessages,
    onFinish: ({ message }) => {
      // Получаем chatId из metadata ответа
      if (message.metadata?.chatId) {
        setCurrentChatId(message.metadata.chatId as string);
      }
    },
    onError: (err) => {
      console.error("Chat error:", err);
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // --- Scroll logic (без изменений) ---
  const scrollToBottom = useCallback(() => {
    if (messagesRef.current && !isUserScrolledUp.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  function handleScroll() {
    const el = messagesRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    isUserScrolledUp.current = !atBottom;
  }

  // --- Input handling (без изменений) ---
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 100) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // --- Send ---
  function handleSend(text?: string) {
    const msgText = (text || input).trim();
    if (!msgText || isStreaming) return;

    if (!text) {
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }

    setShowQuickReplies(false);
    isUserScrolledUp.current = false;

    sendMessage({
      text: msgText,
    });
  }

  // --- Render helpers ---
  function getMessageText(msg: UIMessage): string {
    return msg.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
  }

  function renderContent(content: string, isAi: boolean) {
    if (!content) return null;
    if (isAi) {
      return <ReactMarkdown>{content}</ReactMarkdown>;
    }
    return content.split("\n\n").map((paragraph, i) => (
      <p key={i}>{paragraph}</p>
    ));
  }

  function isErrorMessage(content: string) {
    return /Ошибка|Недостаточно/.test(content);
  }

  // Show welcome AI message when no history exists
  const showWelcome = welcomeMessage && initialMessages.length === 0;

  return (
    <div className="chat-zone">
      <div className="chat-messages" ref={messagesRef} onScroll={handleScroll}>
        <div className="chat-inner">
          {children}

          {showWelcome && (
            <div className="msg msg-ai">
              <div className="msg-avatar ai">НС</div>
              <div className="msg-bubble">
                <ReactMarkdown>{welcomeMessage}</ReactMarkdown>
              </div>
            </div>
          )}

          {showQuickReplies && quickReplies && quickReplies.length > 0 && (
            <div className="quick-replies">
              {quickReplies.map((text, i) => (
                <button
                  key={i}
                  className="quick-reply-btn"
                  onClick={() => handleSend(text)}
                  disabled={isStreaming}
                >
                  {text}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg) => {
            const isAi = msg.role === "assistant";
            const text = getMessageText(msg);
            const isLast = msg.id === messages[messages.length - 1]?.id;
            const isThinking = status === "submitted" && isLast && isAi && !text;

            if (isThinking) return null;

            return (
              <div key={msg.id} className={`msg ${isAi ? "msg-ai" : "msg-user"}`}>
                <div className={`msg-avatar ${isAi ? "ai" : "user"}`}>
                  {isAi ? "НС" : userInitial}
                </div>
                <div className="msg-bubble">
                  {renderContent(text, isAi)}
                  {status === "streaming" && isLast && isAi && (
                    <span className="streaming-cursor">{"▊"}</span>
                  )}
                  {!isStreaming && isLast && isAi && isErrorMessage(text) && (
                    <button className="retry-btn" onClick={() => regenerate()}>
                      Повторить
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {status === "submitted" && messages.length > 0 && (
            <div className="thinking-indicator">
              думаю
              <span className="thinking-dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </div>
          )}

          {error && (
            <div className="msg msg-ai">
              <div className="msg-avatar ai">НС</div>
              <div className="msg-bubble">
                <p>{error.message || "Произошла ошибка"}</p>
                <button className="retry-btn" onClick={() => regenerate()}>
                  Повторить
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="chat-input-wrap">
        <div className="chat-input-inner">
          <div className="chat-input-row">
            <textarea
              ref={textareaRef}
              className="chat-input"
              placeholder="Или напиши своими словами..."
              rows={1}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
            />
            <button
              className="send-btn"
              onClick={() => handleSend()}
              disabled={isStreaming || !input.trim()}
            >
              {"↑"}
            </button>
          </div>
          <div className="input-privacy">
            {"🔒 Всё, что ты напишешь, остаётся между нами"}
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### 2.2 Создать `components/AnonymousChatV2.tsx`

```typescript
// components/AnonymousChatV2.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat, DefaultChatTransport } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import { InChatAuth } from "@/components/InChatAuth";
import type { UIMessage } from "ai";

interface AnonymousChatV2Props {
  programSlug: string;
  welcomeMessage: string;
  quickReplies: string[];
  scrollToSectionId?: string;
  headerTitle?: string;
  headerSubtitle?: string;
}

export function AnonymousChatV2({
  programSlug,
  welcomeMessage,
  quickReplies,
  scrollToSectionId,
  headerTitle,
  headerSubtitle,
}: AnonymousChatV2Props) {
  const [input, setInput] = useState("");
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [mounted, setMounted] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isUserScrolledUp = useRef(false);
  const sessionIdRef = useRef<string>("");

  const storageKeyMessages = `anon_chat_${programSlug}_messages`;
  const storageKeySession = `anon_chat_${programSlug}_session_id`;

  // Загрузка initialMessages из localStorage
  const [savedInitialMessages, setSavedInitialMessages] = useState<UIMessage[]>([]);

  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(storageKeySession);
      if (savedSession) {
        sessionIdRef.current = savedSession;
      } else {
        const newId = crypto.randomUUID();
        sessionIdRef.current = newId;
        localStorage.setItem(storageKeySession, newId);
      }

      const savedMessages = localStorage.getItem(storageKeyMessages);
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages) as Array<{ role: string; content: string }>;
        if (parsed.length > 0) {
          // Конвертируем old format → UIMessage format
          const uiMessages: UIMessage[] = parsed.map((msg, i) => ({
            id: `saved-${i}`,
            role: msg.role as "user" | "assistant",
            parts: [{ type: "text" as const, text: msg.content }],
          }));
          setSavedInitialMessages(uiMessages);
          setShowQuickReplies(false);
        }
      }
    } catch {
      sessionIdRef.current = crypto.randomUUID();
    }
    setMounted(true);
  }, [storageKeyMessages, storageKeySession]);

  const {
    messages,
    sendMessage,
    status,
    error,
    setMessages,
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat/anonymous/v2",
      body: () => ({
        session_id: sessionIdRef.current,
        program_slug: programSlug,
      }),
    }),
    initialMessages: savedInitialMessages,
    onFinish: ({ message, messages: allMessages }) => {
      // Сохраняем сообщения в localStorage
      try {
        const simplified = allMessages.map((m) => ({
          role: m.role,
          content: m.parts
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join(""),
        }));
        localStorage.setItem(storageKeyMessages, JSON.stringify(simplified));
      } catch { /* localStorage full */ }
    },
    onError: (err) => {
      // Проверяем 429 с requiresAuth
      // useChat передаёт ошибку с текстом ответа
      if (err.message?.includes("requiresAuth") || err.message?.includes("429")) {
        setRequiresAuth(true);
      }
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // --- Scroll (включая landing page scroll) ---
  const scrollToBottom = useCallback(() => {
    if (messagesRef.current && !isUserScrolledUp.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      if (scrollToSectionId) {
        const section = document.getElementById(scrollToSectionId);
        if (section) {
          const rect = section.getBoundingClientRect();
          if (rect.top > window.innerHeight || rect.bottom < 0) {
            section.scrollIntoView({ behavior: "smooth" });
          }
        }
      }
    }
  }, [scrollToSectionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  function handleScroll() {
    const el = messagesRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    isUserScrolledUp.current = !atBottom;
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 100) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend(text?: string) {
    const msgText = (text || input).trim();
    if (!msgText || isStreaming || requiresAuth) return;

    if (!text) {
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }

    setShowQuickReplies(false);
    isUserScrolledUp.current = false;
    sendMessage({ text: msgText });
  }

  function getMessageText(msg: UIMessage): string {
    return msg.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
  }

  function renderContent(content: string, isAi: boolean) {
    if (!content) return null;
    if (isAi) return <ReactMarkdown>{content}</ReactMarkdown>;
    return content.split("\n\n").map((paragraph, i) => <p key={i}>{paragraph}</p>);
  }

  async function handleAuthSuccess() {
    try {
      // Конвертируем UIMessage → простой формат для миграции
      const simplifiedMessages = messages.map((m) => ({
        role: m.role,
        content: getMessageText(m),
      }));

      await fetch("/api/chat/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_slug: programSlug,
          messages: simplifiedMessages,
          session_id: sessionIdRef.current,
        }),
      });
    } catch { /* ignore */ }

    try {
      localStorage.removeItem(storageKeyMessages);
      localStorage.removeItem(storageKeySession);
    } catch { /* ignore */ }

    window.location.href = `/program/${programSlug}/chat`;
  }

  if (!mounted) return null;

  return (
    <div className="chat-zone">
      <div className="chat-messages" ref={messagesRef} onScroll={handleScroll}>
        <div className="chat-inner">
          {headerTitle && (
            <div className="chat-section-header">
              <h2>{headerTitle}</h2>
              {headerSubtitle && <p>{headerSubtitle}</p>}
            </div>
          )}

          {messages.length === 0 && (
            <div className="msg msg-ai">
              <div className="msg-avatar ai">НС</div>
              <div className="msg-bubble">
                <ReactMarkdown>{welcomeMessage}</ReactMarkdown>
              </div>
            </div>
          )}

          {showQuickReplies && quickReplies.length > 0 && (
            <div className="quick-replies">
              {quickReplies.map((text, i) => (
                <button key={i} className="quick-reply-btn" onClick={() => handleSend(text)} disabled={isStreaming}>
                  {text}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg) => {
            const isAi = msg.role === "assistant";
            const text = getMessageText(msg);
            const isLast = msg.id === messages[messages.length - 1]?.id;
            const isThinking = status === "submitted" && isLast && isAi && !text;
            if (isThinking) return null;

            return (
              <div key={msg.id} className={`msg ${isAi ? "msg-ai" : "msg-user"}`}>
                <div className={`msg-avatar ${isAi ? "ai" : "user"}`}>
                  {isAi ? "НС" : "?"}
                </div>
                <div className="msg-bubble">
                  {renderContent(text, isAi)}
                  {status === "streaming" && isLast && isAi && (
                    <span className="streaming-cursor">{"▊"}</span>
                  )}
                </div>
              </div>
            );
          })}

          {status === "submitted" && messages.length > 0 && (
            <div className="thinking-indicator">
              думаю<span className="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
            </div>
          )}

          {requiresAuth && <InChatAuth onAuthSuccess={handleAuthSuccess} />}
        </div>
      </div>

      <div className="chat-input-wrap">
        <div className="chat-input-inner">
          <div className="chat-input-row">
            <textarea
              ref={textareaRef}
              className="chat-input"
              placeholder="Напиши сообщение..."
              rows={1}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              disabled={isStreaming || requiresAuth}
            />
            <button
              className="send-btn"
              onClick={() => handleSend()}
              disabled={isStreaming || !input.trim() || requiresAuth}
            >
              {"↑"}
            </button>
          </div>
          <div className="input-privacy">{"🔒 Анонимный чат. Данные не сохраняются на сервере."}</div>
        </div>
      </div>
    </div>
  );
}
```

#### 2.3 Адаптация серверных страниц (props)

В `app/program/[slug]/(app)/chat/page.tsx` и `exercise/[number]/page.tsx` нужно конвертировать `initialMessages` из `{ role, content }[]` в `UIMessage[]`:

```typescript
// Утилита (можно добавить в lib/utils.ts)
function toUIMessages(messages: { role: string; content: string }[]): UIMessage[] {
  return messages.map((msg, i) => ({
    id: `db-${i}`,
    role: msg.role as "user" | "assistant",
    parts: [{ type: "text" as const, text: msg.content }],
  }));
}
```

#### 2.4 Проверка

1. Заменить `ChatWindow` на `ChatWindowV2` в одной странице (например, chat/page.tsx)
2. Проверить что сообщения рендерятся, стриминг работает, CSS выглядит так же
3. Проверить welcome message, quick replies, streaming cursor, thinking indicator

---

### Шаг 3: Бизнес-логика

**Цель:** Перенести всю бизнес-логику в новые API routes: auth, balance, chat creation, message persistence, token deduction, ISSP, portrait update.

#### 3.1 Полный `app/api/chat/v2/route.ts`

```typescript
// app/api/chat/v2/route.ts
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { google } from "@/lib/ai";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { updatePortrait } from "@/app/api/portrait/update/route";
import { parseAIResponse } from "@/lib/issp-parser";
import { calculateISSP } from "@/lib/issp-scoring";
import { ISSP_QUESTIONS } from "@/lib/issp-config";
import type { TestAnswer } from "@/lib/issp-scoring";

const DEFAULT_BALANCE = 1000;

export async function POST(request: Request) {
  const supabase = await createClient();

  // 1. Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Не авторизован" }, { status: 401 });
  }

  // 2. Parse body
  // useChat отправляет { messages: UIMessage[], ...body }
  // body содержит наши кастомные поля
  const body = await request.json();
  const { messages: clientMessages, chatId, programId, exerciseId, chatType } = body;

  // Извлекаем текст последнего user-сообщения
  const lastClientMsg = clientMessages?.[clientMessages.length - 1];
  const message = lastClientMsg?.parts
    ?.filter((p: { type: string }) => p.type === "text")
    ?.map((p: { text: string }) => p.text)
    ?.join("") || lastClientMsg?.content;

  if (!message || !programId) {
    return Response.json({ error: "Не указано сообщение или программа" }, { status: 400 });
  }

  // 3. Get or create user record + check balance
  let { data: userData } = await supabase
    .from("profiles")
    .select("balance_tokens")
    .eq("id", user.id)
    .maybeSingle();

  if (!userData) {
    console.log("[chat] Creating users record for", user.id);
    const serviceClient = createServiceClient();
    const { data: newUser, error: createError } = await serviceClient
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        balance_tokens: DEFAULT_BALANCE,
      })
      .select("balance_tokens")
      .single();

    if (createError) {
      console.error("[chat] Failed to create user record:", createError);
      return Response.json({ error: "Не удалось создать профиль пользователя" }, { status: 500 });
    }
    userData = newUser;
  }

  if (userData.balance_tokens <= 0) {
    return Response.json({ error: "Недостаточно токенов" }, { status: 403 });
  }

  // 4. Load program
  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("id, system_prompt, free_chat_welcome, test_system_prompt")
    .eq("id", programId)
    .single();

  if (!program) {
    console.error("[chat] Program not found:", programId, programError);
    return Response.json({ error: "Программа не найдена" }, { status: 404 });
  }

  // 5. Load exercise (if exercise chat)
  let exercise: { id: string; system_prompt: string; title: string; welcome_message: string | null } | null = null;
  if (exerciseId) {
    const { data } = await supabase
      .from("exercises")
      .select("id, system_prompt, title, welcome_message")
      .eq("id", exerciseId)
      .single();
    exercise = data;
  }

  // 6. Load portrait
  const { data: portrait } = await supabase
    .from("portraits")
    .select("content")
    .eq("user_id", user.id)
    .eq("program_id", programId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 7. Find or create chat
  const isTestMode = chatType === "test";
  let currentChatId = chatId;
  let isNewChat = false;
  let currentChatType = isTestMode ? "test" : exerciseId ? "exercise" : "free";

  if (!currentChatId) {
    if (isTestMode) {
      const { data: existingChat } = await supabase
        .from("chats")
        .select("id")
        .eq("user_id", user.id)
        .eq("program_id", programId)
        .eq("chat_type", "test")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (existingChat) {
        currentChatId = existingChat.id;
      }
    } else {
      let findQuery = supabase
        .from("chats")
        .select("id")
        .eq("user_id", user.id)
        .eq("program_id", programId)
        .eq("status", "active");

      if (exerciseId) {
        findQuery = findQuery.eq("exercise_id", exerciseId);
      } else {
        findQuery = findQuery.is("exercise_id", null);
      }

      const { data: existingChat } = await findQuery.limit(1).maybeSingle();
      if (existingChat) {
        currentChatId = existingChat.id;
      }
    }

    if (!currentChatId) {
      const insertData: Record<string, unknown> = {
        user_id: user.id,
        program_id: programId,
        status: "active",
      };

      if (isTestMode) {
        insertData.chat_type = "test";
        insertData.test_state = {
          current_question: 0,
          status: "in_progress",
          started_at: new Date().toISOString(),
          answers: [],
        };
      } else {
        insertData.exercise_id = exerciseId || null;
        insertData.chat_type = exerciseId ? "exercise" : "free";
      }

      const { data: newChat, error: chatError } = await supabase
        .from("chats")
        .insert(insertData)
        .select("id")
        .single();

      if (chatError || !newChat) {
        console.error("[chat] Failed to create chat:", chatError);
        return Response.json({ error: "Не удалось создать чат" }, { status: 500 });
      }

      currentChatId = newChat.id;
      isNewChat = true;

      if (!isTestMode) {
        const welcomeText = exercise?.welcome_message || program.free_chat_welcome;
        if (welcomeText) {
          await supabase.from("messages").insert({
            chat_id: currentChatId,
            role: "assistant",
            content: welcomeText,
            tokens_used: 0,
          });
        }
      }
    }
  } else {
    const { data: chatData } = await supabase
      .from("chats")
      .select("chat_type")
      .eq("id", currentChatId)
      .single();
    if (chatData?.chat_type) {
      currentChatType = chatData.chat_type;
    }
  }

  // 8. Load message history from DB
  const { data: dbMessages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("chat_id", currentChatId)
    .order("created_at", { ascending: true });

  // 9. Build system prompt
  let systemPrompt = "";
  if (currentChatType === "test") {
    systemPrompt = program.test_system_prompt || "";
  } else {
    systemPrompt = program.system_prompt || "";
    if (exercise?.system_prompt) {
      systemPrompt += `\n\n---\nТЕКУЩЕЕ УПРАЖНЕНИЕ: ${exercise.title}\n${exercise.system_prompt}`;
    }
    if (portrait?.content) {
      const p = portrait.content as { ai_context?: string };
      if (p.ai_context) {
        systemPrompt += `\n\n---\nКОНТЕКСТ ПОЛЬЗОВАТЕЛЯ (из предыдущих упражнений):\n${p.ai_context}`;
      }
    }
  }

  // 10. Build messages for AI SDK
  // Фильтруем leading assistant messages (Gemini требует начинать с user)
  const allDbMessages = (dbMessages || []).map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));
  const firstUserIdx = allDbMessages.findIndex((m) => m.role === "user");
  const historyMessages = firstUserIdx >= 0 ? allDbMessages.slice(firstUserIdx) : [];

  // Добавляем текущее сообщение
  const aiMessages = [
    ...historyMessages,
    { role: "user" as const, content: message },
  ];

  // 11. Save user message BEFORE streaming
  const { error: msgError } = await supabase.from("messages").insert({
    chat_id: currentChatId,
    role: "user",
    content: message,
    tokens_used: 0,
  });

  if (msgError) {
    console.error("[chat] Failed to save user message:", msgError);
    return Response.json({ error: "Не удалось сохранить сообщение" }, { status: 500 });
  }

  // 12. Stream with Vercel AI SDK
  //
  // ⚠️ ВАЖНО: onFinish в Vercel AI SDK может НЕ дождаться завершения async операций.
  // Vercel может закрыть соединение/процесс после отправки последнего чанка,
  // и длинные await внутри onFinish могут не выполниться до конца.
  //
  // Стратегия:
  // - Сохранение AI-сообщения и списание токенов — критичные операции,
  //   делаем через await (быстрые, один INSERT + один UPDATE)
  // - ISSP-парсинг и portrait update — тяжёлые операции,
  //   оборачиваем в Promise и вызываем через .catch() (fire-and-forget)
  //
  // Fallback-план: если при тестировании данные ISSP или портрета не сохраняются —
  // вынести эти операции в отдельный POST endpoint (например /api/chat/post-process),
  // который клиент вызывает после получения "done" через onFinish callback useChat.
  //
  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt || undefined,
    messages: aiMessages,
    onFinish: async ({ text, usage }) => {
      const tokensUsed = usage.totalTokens || 0;

      // Save AI message (критичная операция — await)
      await supabase.from("messages").insert({
        chat_id: currentChatId,
        role: "assistant",
        content: text,
        tokens_used: tokensUsed,
      });

      // Deduct tokens (критичная операция — await)
      if (tokensUsed > 0) {
        const newBalance = Math.max(0, userData.balance_tokens - tokensUsed);
        await supabase
          .from("profiles")
          .update({ balance_tokens: newBalance })
          .eq("id", user.id);
      }

      // ISSP test parsing (fire-and-forget — может быть тяжёлой операцией)
      if (currentChatType === "test") {
        const isspPromise = (async () => {
          const svc = createServiceClient();
          const { data: chatRow } = await svc
            .from("chats")
            .select("test_state")
            .eq("id", currentChatId)
            .single();

          if (chatRow?.test_state) {
            const testState = chatRow.test_state as {
              current_question: number;
              status: string;
              started_at: string;
              answers: TestAnswer[];
            };

            const parsed = parseAIResponse(text, message);
            if (parsed.isConfirmation && parsed.scores.length > 0) {
              for (const score of parsed.scores) {
                const qIdx = testState.current_question;
                if (qIdx >= ISSP_QUESTIONS.length) break;
                const question = ISSP_QUESTIONS[qIdx];
                testState.answers.push({
                  q: question.q,
                  scale: question.scale,
                  type: question.type,
                  rawAnswer: score,
                  score: question.type === "reverse" ? 6 - score : score,
                  text: /^\d$/.test(message.trim()) ? undefined : message,
                });
                testState.current_question++;
              }

              if (testState.answers.length >= 35) {
                testState.status = "completed";
                const isspResult = calculateISSP(testState.answers);

                await svc.from("test_results").insert({
                  user_id: user.id,
                  program_id: programId,
                  chat_id: currentChatId,
                  total_score: isspResult.totalScore,
                  total_raw: isspResult.totalRaw,
                  scores_by_scale: isspResult.scoresByScale,
                  answers: testState.answers,
                  recommended_exercises: isspResult.recommendedExercises,
                  top_scales: isspResult.topScales,
                });

                await svc
                  .from("chats")
                  .update({ test_state: testState, status: "completed" })
                  .eq("id", currentChatId);

                console.log("[ISSP] Test completed for user:", user.id);
              } else {
                await svc
                  .from("chats")
                  .update({ test_state: testState })
                  .eq("id", currentChatId);
              }
            }
          }
        })();
        isspPromise.catch((err) => {
          console.error("[ISSP] Test state update error:", err);
        });
      }

      // Portrait auto-update (fire-and-forget)
      if (currentChatType !== "test") {
        const portraitPromise = (async () => {
          const svc = createServiceClient();
          const { count: userMsgCount } = await svc
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("chat_id", currentChatId)
            .eq("role", "user");

          if (userMsgCount && userMsgCount > 0 && userMsgCount % 5 === 0) {
            console.log("[PORTRAIT] Triggering update for chat:", currentChatId);
            await updatePortrait(currentChatId, "message_count");
          }
        })();
        portraitPromise.catch((err) => {
          console.error("[PORTRAIT] Background update failed:", err);
        });
      }
    },
  });

  // 13. Return stream response with metadata
  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      // Отправляем chatId в metadata (клиент получит в message.metadata)
      if (isNewChat) {
        return { chatId: currentChatId };
      }
      if (part.type === "finish") {
        return {
          chatId: currentChatId,
          tokensUsed: part.usage?.totalTokens,
        };
      }
      return { chatId: currentChatId };
    },
  });
}
```

#### 3.2 Полный `app/api/chat/anonymous/v2/route.ts`

```typescript
// app/api/chat/anonymous/v2/route.ts
import { streamText } from "ai";
import { google } from "@/lib/ai";
import { createServiceClient } from "@/lib/supabase-server";
import { getConfig } from "@/lib/config";

// In-memory rate limit: 30 requests/minute per IP
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 30;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  // 1. Rate limit
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: "Слишком много запросов. Попробуйте позже." },
      { status: 429 }
    );
  }

  // 2. Parse body
  // useChat отправляет { messages: UIMessage[], session_id, program_slug }
  const body = await request.json();
  const { messages: clientMessages, session_id, program_slug } = body;

  if (!session_id || !UUID_RE.test(session_id)) {
    return Response.json({ error: "Невалидный session_id" }, { status: 400 });
  }
  if (!program_slug) {
    return Response.json({ error: "Не указан program_slug" }, { status: 400 });
  }
  if (!Array.isArray(clientMessages) || clientMessages.length === 0) {
    return Response.json({ error: "Пустой массив сообщений" }, { status: 400 });
  }

  // 3. Convert UIMessage → simple format для валидации
  const messages = clientMessages.map((msg: { role: string; parts?: Array<{ type: string; text: string }>; content?: string }) => ({
    role: msg.role as "user" | "assistant",
    content: msg.parts
      ?.filter((p) => p.type === "text")
      ?.map((p) => p.text)
      ?.join("") || msg.content || "",
  }));

  // Validate messages
  for (const msg of messages) {
    if (msg.role !== "user" && msg.role !== "assistant") {
      return Response.json({ error: "Невалидная роль сообщения" }, { status: 400 });
    }
    if (typeof msg.content !== "string" || msg.content.length > 5000) {
      return Response.json({ error: "Сообщение слишком длинное (макс 5000 символов)" }, { status: 400 });
    }
  }

  // 4. Message limit
  const userMessageCount = messages.filter((m: { role: string }) => m.role === "user").length;
  const maxMessages = await getConfig<number>("anonymous_chat_max_messages", 10);
  if (userMessageCount > maxMessages) {
    return Response.json({ requiresAuth: true, reason: "message_limit" }, { status: 429 });
  }

  // 5. Token limit
  const estimatedTokens = messages.map((m: { content: string }) => m.content).join("").length * 1.3;
  const tokenLimit = await getConfig<number>("anonymous_chat_token_limit", 100000);
  if (estimatedTokens > tokenLimit) {
    return Response.json({ requiresAuth: true, reason: "token_limit" }, { status: 429 });
  }

  // 6. Load program
  const supabase = createServiceClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, system_prompt, anonymous_system_prompt")
    .eq("slug", program_slug)
    .single();

  if (!program) {
    return Response.json({ error: "Программа не найдена" }, { status: 404 });
  }

  // 7. System prompt
  const systemPrompt = program.anonymous_system_prompt ||
    (program.system_prompt + "\n\nЭто ознакомительный чат. Отвечай тепло, давай мини-инсайты, но не углубляйся слишком сильно.");

  // 8. Prepare messages for AI SDK
  // Фильтруем leading assistant messages (Gemini требует начинать с user)
  const firstUserIdx = messages.findIndex((m: { role: string }) => m.role === "user");
  const filteredMessages = firstUserIdx >= 0 ? messages.slice(firstUserIdx) : messages;

  // 9. Stream
  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt,
    messages: filteredMessages,
  });

  return result.toUIMessageStreamResponse();
}
```

#### 3.3 Обработка ошибки 429 в AnonymousChatV2

Проблема: когда сервер возвращает 429 с `{ requiresAuth: true }`, `useChat` вызывает `onError`. Нужно корректно обработать.

**Основной подход: проверка лимитов ДО вызова streamText**

Лимиты (message count, token estimate) проверяются на сервере в шагах 4-5 файла `anonymous/v2/route.ts` — ДО вызова `streamText`. Это означает, что сервер возвращает обычный `Response.json({ requiresAuth: true }, { status: 429 })` — не stream response. `useChat` обрабатывает non-200 ответы через `onError` callback:

```typescript
// В AnonymousChatV2
const {
  messages,
  sendMessage,
  status,
  error,
} = useChat({
  transport: new DefaultChatTransport({
    api: "/api/chat/anonymous/v2",
    body: () => ({
      session_id: sessionIdRef.current,
      program_slug: programSlug,
    }),
  }),
  onError: (err) => {
    // useChat пробрасывает текст ошибки из response body
    // Проверяем наличие маркера requiresAuth
    console.error("[anon-chat] Error:", err.message);
    if (
      err.message?.includes("requiresAuth") ||
      err.message?.includes("message_limit") ||
      err.message?.includes("token_limit")
    ) {
      setRequiresAuth(true);
    }
  },
});
```

Этот подход работает потому что:
1. Проверка лимитов (строки 1345-1357 в `anonymous/v2/route.ts`) происходит ДО `streamText`
2. Сервер возвращает обычный JSON ответ с 429 статусом
3. `useChat` не пытается парсить non-200 как stream — вызывает `onError`
4. Текст ошибки из response body доступен в `err.message`

**Запасной вариант: кастомный fetch в transport**

Если `onError` не передаёт достаточно информации из response body (зависит от версии SDK), можно перехватить 429 через кастомный `fetch`:

```typescript
transport: new DefaultChatTransport({
  api: "/api/chat/anonymous/v2",
  body: () => ({
    session_id: sessionIdRef.current,
    program_slug: programSlug,
  }),
  fetch: async (url, options) => {
    const response = await fetch(url, options);
    if (response.status === 429) {
      const data = await response.clone().json();
      if (data.requiresAuth) {
        throw new Error("AUTH_REQUIRED");
      }
    }
    return response;
  },
}),
onError: (err) => {
  if (err.message === "AUTH_REQUIRED") {
    setRequiresAuth(true);
  }
},
```

> **Примечание:** Если `DefaultChatTransport` не поддерживает кастомный `fetch`, можно создать свой transport класс или использовать `TextStreamChatTransport`.

#### 3.4 Проверка

1. **Авторизованный чат:**
   - Создаётся новый чат → chatId приходит в metadata
   - Сообщения сохраняются в БД (user и assistant)
   - Токены списываются
   - Balance check работает (403 при 0)
   - Welcome message показывается
   - Quick replies работают

2. **Exercise чат:**
   - Загружается exercise system prompt
   - Welcome message из exercise
   - Portrait context инъектируется

3. **Test mode:**
   - ISSP парсинг работает
   - test_state обновляется
   - При 35 ответах → calculateISSP → test_results

4. **Portrait auto-update:**
   - Каждые 5 сообщений → updatePortrait вызывается

5. **Анонимный чат:**
   - Rate limit работает
   - Message limit → requiresAuth → InChatAuth
   - localStorage persistence
   - Миграция при авторизации

---

### Шаг 4: Замена и очистка

**Цель:** Заменить старые файлы на V2, удалить старый код, убрать лишние зависимости.

#### 4.1 Замена компонентов

```
# Удалить старые файлы
components/ChatWindow.tsx          → удалить
components/AnonymousChat.tsx       → удалить

# Переименовать V2 → основные
components/ChatWindowV2.tsx        → components/ChatWindow.tsx
components/AnonymousChatV2.tsx     → components/AnonymousChat.tsx
```

#### 4.2 Замена API routes

```
# Удалить старые routes
app/api/chat/route.ts              → удалить
app/api/chat/anonymous/route.ts    → удалить

# Переместить V2 → основные
app/api/chat/v2/route.ts           → app/api/chat/route.ts
app/api/chat/anonymous/v2/route.ts → app/api/chat/anonymous/route.ts
```

#### 4.3 Обновить импорты

В `app/program/[slug]/(app)/chat/page.tsx`:
```typescript
// Было
import { ChatWindow } from "@/components/ChatWindow";

// Стало (после переименования — то же самое, но props изменились)
import { ChatWindow } from "@/components/ChatWindow";
// initialMessages теперь UIMessage[], нужна конвертация
```

В `app/program/[slug]/(app)/exercise/[number]/page.tsx` — аналогично.

В `app/program/[slug]/page.tsx` (лендинг):
```typescript
// Было
import { AnonymousChat } from "@/components/AnonymousChat";
// Стало
import { AnonymousChat } from "@/components/AnonymousChat";
// Props те же, но внутри useChat
```

#### 4.4 Удалить lib/gemini.ts

```
lib/gemini.ts → удалить (streamChat больше не нужен)
```

> **Важно:** `lib/gemini-portrait.ts` НЕ удалять — портрет использует отдельный Gemini Pro клиент.

#### 4.5 Зависимость `@google/generative-ai` — НЕ удаляем

Результат проверки `grep -r "@google/generative-ai" lib/ app/`:

```
lib/gemini.ts:1              → import { GoogleGenerativeAI, Content } from "@google/generative-ai"   ← УДАЛЯЕТСЯ (заменяем на @ai-sdk/google)
lib/gemini-portrait.ts:1     → import { GoogleGenerativeAI } from "@google/generative-ai"            ← ОСТАЁТСЯ (портрет)
app/api/chat/route.ts:8      → import type { Content } from "@google/generative-ai"                  ← УДАЛЯЕТСЯ (заменяем route)
app/api/chat/anonymous/route.ts:4 → import type { Content } from "@google/generative-ai"             ← УДАЛЯЕТСЯ (заменяем route)
```

**Вывод:** `lib/gemini-portrait.ts` активно использует `GoogleGenerativeAI` из `@google/generative-ai` для анализа портретов (Gemini Pro, JSON mode, temperature 0.3). Пакет **НЕ удаляем**.

```bash
# НЕ делаем:
# npm uninstall @google/generative-ai

# Пакет остаётся в package.json для lib/gemini-portrait.ts
```

**Миграция портрета на AI SDK — отдельная задача после основной миграции чата.** При миграции портрета нужно будет:
- Заменить `GoogleGenerativeAI` на `google("gemini-2.5-pro")` из `@ai-sdk/google`
- Использовать `generateText()` из `ai` вместо `model.generateContent()`
- Настроить `responseMimeType: "application/json"` через `providerOptions.google`
- После этого можно будет удалить `@google/generative-ai`

#### 4.6 Удалить V2 директории

```
app/api/chat/v2/         → удалить (пустая после переноса)
app/api/chat/anonymous/v2/ → удалить
```

#### 4.7 Финальная проверка

```bash
# 1. TypeScript компиляция
npx tsc --noEmit

# 2. Линтер
npm run lint

# 3. Сборка
npm run build

# 4. Ручное тестирование
npm run dev
```

Чеклист ручного тестирования:
- [ ] Свободный чат: создание нового, продолжение существующего
- [ ] Чат упражнения: welcome message, exercise system prompt
- [ ] ISSP тест: парсинг ответов, завершение теста
- [ ] Портрет: auto-update каждые 5 сообщений
- [ ] Баланс: проверка при 0 токенах
- [ ] Анонимный чат: лендинг, localStorage, лимиты
- [ ] InChatAuth: появляется при достижении лимита
- [ ] Миграция: анонимные сообщения переносятся при регистрации
- [ ] Retry: кнопка "Повторить" при ошибке
- [ ] Streaming cursor: "▊" во время стриминга
- [ ] Thinking indicator: "думаю..." при ожидании
- [ ] Mobile: MobileTabs + чат работают
- [ ] CSS: визуально идентичен старой версии

---

## Переменные окружения

### Без изменений (всё остаётся)

```env
GOOGLE_GEMINI_API_KEY=...          # Используется через createGoogleGenerativeAI({ apiKey })
GEMINI_PORTRAIT_MODEL=...          # Для lib/gemini-portrait.ts (не затрагивается)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Ничего не добавляем

`@ai-sdk/google` по умолчанию ищет `GOOGLE_GENERATIVE_AI_API_KEY`, но мы явно передаём `apiKey` в `createGoogleGenerativeAI()`, поэтому новых переменных не нужно.

---

## Итого: файлы

### Создаются (в процессе миграции)

| Файл | Назначение |
|------|-----------|
| `lib/ai.ts` | Google provider для Vercel AI SDK |
| `app/api/chat/v2/route.ts` | Новый authenticated chat API |
| `app/api/chat/anonymous/v2/route.ts` | Новый anonymous chat API |
| `components/ChatWindowV2.tsx` | Новый authenticated chat UI |
| `components/AnonymousChatV2.tsx` | Новый anonymous chat UI |

### Удаляются (после замены)

| Файл | Причина |
|------|---------|
| `lib/gemini.ts` | Заменён на `streamText` + `@ai-sdk/google` |
| `components/ChatWindow.tsx` | Заменён на ChatWindowV2 |
| `components/AnonymousChat.tsx` | Заменён на AnonymousChatV2 |
| `app/api/chat/route.ts` | Заменён на v2/route.ts |
| `app/api/chat/anonymous/route.ts` | Заменён на anonymous/v2/route.ts |

### Изменяются

| Файл | Что меняется |
|------|-------------|
| `app/program/[slug]/(app)/chat/page.tsx` | Props: `initialMessages` → `UIMessage[]` format |
| `app/program/[slug]/(app)/exercise/[number]/page.tsx` | Props: `initialMessages` → `UIMessage[]` format |
| `app/program/[slug]/page.tsx` | Import AnonymousChat → AnonymousChatV2 (после rename — тот же) |
| `package.json` | +`ai`, +`@ai-sdk/google`, +`@ai-sdk/react` (`@google/generative-ai` остаётся — нужен для портрета) |

### Не затрагиваются

- `lib/gemini-portrait.ts` — портрет на Gemini Pro (отдельная миграция)
- `app/api/portrait/update/route.ts` — вызывается из onFinish так же
- `app/api/chat/migrate/route.ts` — без изменений
- `components/InChatAuth.tsx` — без изменений
- `lib/issp-*.ts` — без изменений
- `lib/config.ts` — без изменений
- `lib/supabase*.ts` — без изменений
- `app/globals.css` — все CSS остаётся
- `middleware.ts` — без изменений
