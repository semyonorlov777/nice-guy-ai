# Голосовой ввод в чат — План реализации

---

## 1. Текущая архитектура ввода

### Компоненты чата

Два компонента с **идентичной** структурой input area:

- `components/ChatWindow.tsx` — авторизованный чат (упражнения, свободный чат)
- `components/AnonymousChat.tsx` — анонимный чат на лендинге программы

### useChat хук (Vercel AI SDK)

```typescript
// ChatWindow.tsx, строки 39-66
const { messages, sendMessage, status, error, regenerate } = useChat({
  transport: new DefaultChatTransport({
    api: "/api/chat",
    body: { chatId, programId, exerciseId, chatType },
  }),
  messages: initialMessages,
  onFinish: ({ message }) => { /* получение chatId из metadata */ },
});
```

Отправка сообщения: `sendMessage({ text: msgText })` — принимает текст, отправляет как UIMessage.

### Структура input area (JSX)

```
chat-input-wrap (position: fixed, bottom: 0, z-index: 40)
  └─ chat-input-inner (max-width: 640px, margin: 0 auto)
       ├─ chat-input-row (display: flex, align-items: flex-end, gap: 8px)
       │    ├─ textarea.chat-input (flex: 1, max-height: 100px, auto-resize)
       │    └─ button.send-btn (28×28px, border-radius: 50%, gold accent)
       └─ div.input-privacy (font-size: 11px, скрыт на мобильных)
```

```jsx
// ChatWindow.tsx, строки 231-256
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
```

### Обработка ввода

- `handleInput` — динамическая высота textarea (до 100px)
- `handleKeyDown` — Enter без Shift → отправка, Shift+Enter → перенос строки
- `handleSend` — вызывает `sendMessage({ text: input.trim() })`, очищает input

### Ключевые CSS-стили (`app/globals.css`)

```css
.chat-input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--bg-input);
  border: 1.5px solid var(--border);
  border-radius: 20px;
  padding: 8px 12px;
  transition: border-color 0.15s;
}
.chat-input-row:focus-within { border-color: var(--accent-border); }

.chat-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--text-primary);
  resize: none;
  max-height: 100px;
  min-height: 24px;
  line-height: 1.4;
  padding: 4px;
}

.send-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  background: var(--accent);     /* #c9a84c gold */
  color: #0f1114;
  border: none;
  border-radius: 50%;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s, opacity 0.15s;
}
```

### API route (`app/api/chat/route.ts`)

Принимает JSON body: `{ messages: UIMessage[], chatId, programId, exerciseId, chatType }`.
Извлекает текст: `lastClientMsg.parts.filter(p => p.type === "text").map(p => p.text).join("")`.
Streaming через `streamText()` + Gemini 2.5 Flash.

**Голосовой ввод не требует изменений в API route** — транскрибированный текст вставляется в textarea и отправляется как обычное текстовое сообщение.

---

## 2. Web Speech API (бесплатный уровень)

### Поддержка браузеров

| Браузер | Поддержка | Примечание |
|---------|-----------|------------|
| Chrome (desktop/Android) | **Полная** | Основной целевой браузер |
| Edge | **Полная** | Chromium-based |
| Opera | **Полная** | Chromium-based |
| Safari (desktop) | **Ограниченная** | Работает если Siri/Dictation включен |
| Firefox | **Нет** | Не поддерживает |
| iOS Safari | **Нет** | Не работает в PWA, медленный в мобильном Safari |
| iOS (все браузеры) | **Нет** | Все используют WebKit, не поддерживают SpeechRecognition |

### Feature detection

```typescript
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isWebSpeechSupported = !!SpeechRecognition;
```

### Базовое использование

```typescript
const recognition = new SpeechRecognition();
recognition.lang = "ru-RU";
recognition.continuous = true;      // не останавливаться после первой фразы
recognition.interimResults = true;  // промежуточные результаты
recognition.maxAlternatives = 1;

let accumulatedTranscript = "";

recognition.onresult = (event: SpeechRecognitionEvent) => {
  let interim = "";
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const transcript = event.results[i][0].transcript;
    if (event.results[i].isFinal) {
      accumulatedTranscript += transcript + " ";
    } else {
      interim += transcript;
    }
  }
  // interim — показывать в UI как "пишется..."
  // accumulatedTranscript — финальный текст
};

recognition.onerror = (event) => {
  // Типы ошибок: "not-allowed", "no-speech", "network", "aborted"
  console.error("Speech error:", event.error);
};

recognition.start();
```

### Auto-restart при паузах (критично для длинных записей)

Chrome обрывает SpeechRecognition при ~5 секунд тишины. Для записей до 60 минут необходим автоматический перезапуск:

```typescript
recognition.onend = () => {
  // Если запись ещё активна (не отменена и не остановлена) — перезапустить
  if (state === "recording" || state === "locked") {
    try {
      recognition.start();
    } catch (e) {
      // Может бросить если уже идёт — ignore
    }
  }
};
```

Пользователь **не должен замечать** перезапуски. Transcript накапливается в `accumulatedTranscript` между рестартами.

### Ограничения

- Требует HTTPS (localhost OK для разработки)
- Аудио обрабатывается на серверах Google (privacy)
- Нет offline-режима
- Нет гарантированного качества для шумных окружений
- Может не работать с VPN/прокси (блокировка серверов Google)

---

## 3. MediaRecorder + OpenAI STT (платный fallback)

### Когда используется

Автоматически, если Web Speech API недоступен (Firefox, iOS, Safari без Dictation). Пользователь видит индикатор "платное распознавание".

### MediaRecorder API

Поддержка: Chrome 49+, Firefox 29+, Safari 14.1+ (desktop), Safari iOS 14.5+.

```typescript
// Определение формата
const mimeTypes = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];
const mimeType = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || "audio/webm";

// Запись
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const recorder = new MediaRecorder(stream, { mimeType });
const chunks: Blob[] = [];

recorder.ondataavailable = (e) => chunks.push(e.data);
recorder.onstop = () => {
  const blob = new Blob(chunks, { type: mimeType });
  // blob готов для отправки на сервер
};

recorder.start();
// ...
recorder.stop();
stream.getTracks().forEach(t => t.stop()); // освободить микрофон
```

### OpenAI gpt-4o-mini-transcribe

- **Модель:** `gpt-4o-mini-transcribe`
- **Цена:** $0.003/мин (округление до секунды)
- **Лимит файла:** 25 MB
- **Форматы:** mp3, mp4, mpeg, mpga, m4a, wav, webm
- **Русский:** `language: "ru"` (или автодетект)

```typescript
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const transcription = await openai.audio.transcriptions.create({
  file: audioFile,               // File object
  model: "gpt-4o-mini-transcribe",
  language: "ru",
});

console.log(transcription.text);  // Распознанный текст
```

### API route `/api/transcribe`

> **Важно:** `gpt-4o-mini-transcribe` не поддерживает `response_format: "verbose_json"` — только `json` (возвращает `{ text }`). Duration для расчёта токенов **передаёт клиент** вместе с аудио в FormData (клиент точно знает сколько секунд шла запись из таймера).

```typescript
// app/api/transcribe/route.ts

import { createClient, createServiceClient } from "@/lib/supabase-server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const STT_TOKENS_PER_MINUTE = 50; // Позже перенести в app_config

export async function POST(request: Request) {
  // 1. Авторизация
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  // 2. Проверка баланса
  const { data: profile } = await supabase
    .from("profiles")
    .select("balance_tokens")
    .eq("id", user.id)
    .single();

  if (!profile || profile.balance_tokens < STT_TOKENS_PER_MINUTE) {
    return Response.json({ error: "Недостаточно токенов для голосового ввода" }, { status: 403 });
  }

  // 3. Получить аудио + duration от клиента
  const formData = await request.formData();
  const audioFile = formData.get("audio") as File | null;
  const durationSec = Number(formData.get("duration")) || 1; // секунды записи от клиента
  if (!audioFile) return Response.json({ error: "Аудио не найдено" }, { status: 400 });
  if (audioFile.size > 25 * 1024 * 1024) {
    return Response.json({ error: "Файл слишком большой (макс. 25 MB)" }, { status: 400 });
  }

  // 4. Расчёт стоимости ДО транскрипции (чтобы не платить OpenAI при недостатке баланса)
  const durationMin = Math.ceil(durationSec / 60);
  const tokensToSpend = durationMin * STT_TOKENS_PER_MINUTE;

  if (profile.balance_tokens < tokensToSpend) {
    return Response.json({ error: "Недостаточно токенов для этой записи" }, { status: 403 });
  }

  // 5. Транскрипция (только json формат, без verbose_json)
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "gpt-4o-mini-transcribe",
      language: "ru",
    });

    // 6. Списание токенов
    const serviceClient = createServiceClient();
    const newBalance = Math.max(0, profile.balance_tokens - tokensToSpend);
    await serviceClient
      .from("profiles")
      .update({ balance_tokens: newBalance })
      .eq("id", user.id);

    return Response.json({
      text: transcription.text,
      tokens_spent: tokensToSpend,
      balance_remaining: newBalance,
    });
  } catch (err) {
    console.error("[transcribe] Error:", err);
    return Response.json({ error: "Ошибка транскрипции" }, { status: 500 });
  }
}
```

**Клиент при отправке:**
```typescript
const formData = new FormData();
formData.append("audio", audioBlob, "recording.webm");
formData.append("duration", String(recordingDurationSeconds)); // из таймера хука
const res = await fetch("/api/transcribe", { method: "POST", body: formData });
```

---

## 4. Архитектура компонентов

### Диаграмма файлов

```
hooks/
  └─ useVoiceInput.ts         ← НОВЫЙ: хук управления голосовым вводом

components/
  ├─ VoiceButton.tsx           ← НОВЫЙ: кнопка микрофона + lock target
  ├─ VoiceOverlay.tsx          ← НОВЫЙ: UI записи (таймер, waveform, interim)
  ├─ ChatWindow.tsx            ← ИЗМЕНИТЬ: интеграция голоса
  └─ AnonymousChat.tsx         ← ИЗМЕНИТЬ: интеграция голоса (только Web Speech)

app/
  ├─ api/transcribe/route.ts   ← НОВЫЙ: платная транскрипция
  └─ globals.css               ← ИЗМЕНИТЬ: стили голосового UI

package.json                   ← ИЗМЕНИТЬ: добавить openai
```

### Хук `useVoiceInput` (`hooks/useVoiceInput.ts`)

#### State machine

```
idle ──(startRecording)──→ recording ──(swipe up to lock)──→ locked
  ↑                           │                                │
  │                      (pointerup)                      (click stop)
  │                           │                                │
  │                           ▼                                ▼
  │                      processing ◄──────────────────────────┘
  │                           │
  └───────(transcript)────────┘
  ↑
  └───────(cancel)────────── recording / locked
```

#### Интерфейс

```typescript
type VoiceState = "idle" | "recording" | "locked" | "processing" | "error";
type VoiceBackend = "web-speech" | "media-recorder" | "none";

interface UseVoiceInputOptions {
  lang?: string;                              // default "ru-RU"
  maxDuration?: number;                       // максимум секунд записи
  onTranscript: (text: string) => void;       // финальный текст → textarea
  onInterim?: (text: string) => void;         // промежуточный текст (Web Speech)
  paidFallbackEnabled?: boolean;              // разрешён ли платный fallback (default true)
}

interface UseVoiceInputReturn {
  // Состояние
  state: VoiceState;
  backend: VoiceBackend;
  isPaidBackend: boolean;
  isSupported: boolean;            // есть ли хоть один backend

  // Данные записи
  duration: number;                // секунды
  interimText: string;             // промежуточный текст
  waveformData: number[];          // амплитуды 0-1 (через AnalyserNode)
  error: string | null;

  // Управление
  startRecording: () => void;      // idle → recording
  stopRecording: () => void;       // recording/locked → processing → idle
  cancelRecording: () => void;     // recording/locked → idle (без транскрипции)
  lockRecording: () => void;       // recording → locked (hands-free)

  // Состояние lock
  isLocked: boolean;               // === state === "locked"
  isNearLimit: boolean;            // осталось < 30 сек до лимита
}
```

#### Ключевая логика

**Определение бэкенда (при инициализации):**
```typescript
const detectBackend = (paidFallbackEnabled: boolean): VoiceBackend => {
  if (typeof window === "undefined") return "none";
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) return "web-speech";
  if (paidFallbackEnabled && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined") {
    return "media-recorder";
  }
  return "none";
};
```

**Визуализация записи — разная для каждого бэкенда:**

**Web Speech:** НЕ использует waveform. SpeechRecognition не предоставляет MediaStream, а запрашивать отдельный `getUserMedia` только ради визуализации — это лишний запрос разрешения на микрофон у пользователя. Вместо waveform показываем **interim text** (промежуточные результаты распознавания в реальном времени) — это даже информативнее waveform.

**MediaRecorder:** использует waveform через AudioContext + AnalyserNode. Stream уже доступен из `getUserMedia` (который нужен для записи), поэтому дополнительных разрешений не требуется.

```typescript
// Waveform — ТОЛЬКО для MediaRecorder бэкенда
// stream уже получен через getUserMedia для записи
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;
const source = audioContext.createMediaStreamSource(stream);
source.connect(analyser);

// RAF loop для обновления waveformData
const dataArray = new Uint8Array(analyser.frequencyBinCount);
function updateWaveform() {
  analyser.getByteTimeDomainData(dataArray);
  // Нормализация в [0..1] и обновление state
  if (state === "recording" || state === "locked") {
    requestAnimationFrame(updateWaveform);
  }
}
```

**Итого в VoiceOverlay:**
| Бэкенд | Визуализация |
|--------|-------------|
| Web Speech | 🔴 таймер + interim text ("я думаю что...") |
| MediaRecorder | 🔴 таймер + waveform (SVG полоски) |

**Таймер:**
```typescript
// setInterval(1000) при state === "recording" || "locked"
// При isNearLimit (duration >= maxDuration - 30) — выставить флаг
// При duration >= maxDuration — автоматический stopRecording()
```

**Cleanup:** остановка recognition/mediaRecorder, закрытие AudioContext, освобождение MediaStream tracks.

### Компонент `VoiceButton` (`components/VoiceButton.tsx`)

#### Props

```typescript
interface VoiceButtonProps {
  voiceInput: UseVoiceInputReturn;
  hasText: boolean;              // есть ли текст в textarea
  isStreaming: boolean;          // идёт ли стриминг ответа
  disabled?: boolean;           // доп. disabled (requiresAuth)
}
```

#### Поведение кнопки

| Условие | Вид | Действие |
|---------|-----|----------|
| `input пустой` + `state === "idle"` | 🎤 Микрофон (gold) | pointerdown → startRecording |
| `input не пустой` | ↑ Send (как сейчас) | click → handleSend |
| `state === "recording"` | 🎤 Микрофон (red pulse) | pointerup → stopRecording |
| `state === "locked"` | ■ Стоп (red) | click → stopRecording |
| `state === "processing"` | ⏳ Spinner | disabled |

#### Push-to-talk + Lock (как в Telegram)

```
                ┌─── Замочек 🔒 (target для свайпа)
                │
  [ textarea ] [│🎤 ]    ← палец зажат
                │
  Свайп вверх на замочек → lock mode (hands-free)
  Отпустить без свайпа → push-to-talk (стоп + распознавание)
```

```typescript
const lockTargetRef = useRef<HTMLDivElement>(null);

function handlePointerDown(e: React.PointerEvent) {
  e.preventDefault();
  startY.current = e.clientY;
  voiceInput.startRecording();
}

function handlePointerMove(e: React.PointerEvent) {
  if (voiceInput.state !== "recording") return;
  const dy = startY.current - e.clientY; // свайп вверх = положительное значение
  if (dy > 40) { // порог в 40px
    voiceInput.lockRecording();
  }
}

function handlePointerUp(e: React.PointerEvent) {
  if (voiceInput.state === "recording" && !voiceInput.isLocked) {
    voiceInput.stopRecording(); // push-to-talk
  }
  // Если locked — не останавливаем
}
```

### Компонент `VoiceOverlay` (`components/VoiceOverlay.tsx`)

Появляется **внутри** `chat-input-row`, заменяя textarea во время записи.

#### Props

```typescript
interface VoiceOverlayProps {
  voiceInput: UseVoiceInputReturn;
  onCancel: () => void;
}
```

#### Layout во время записи

**Web Speech (бесплатный) — показывает interim text:**
```
chat-input-row:
┌────────────────────────────────────────────┐
│ ✕  🔴 0:05  "я думаю что..."             │ ■ │
└────────────────────────────────────────────┘
  ↑      ↑           ↑                       ↑
cancel  dot     interim text              stop btn
```

**MediaRecorder (платный) — показывает waveform:**
```
chat-input-row:
┌────────────────────────────────────────────┐
│ ✕  🔴 0:05  ┃▏┃▏┃▏┃▏                    │ ■ │
└────────────────────────────────────────────┘
  ↑      ↑       ↑                           ↑
cancel  dot   waveform                    stop btn
```

**Элементы:**
- **Кнопка отмены (✕)** — слева, cancelRecording
- **Красная точка** — CSS animation pulse
- **Таймер** — `M:SS`, обновляется из `voiceInput.duration`; оранжевый цвет при `isNearLimit`
- **Waveform** — SVG, 20 вертикальных полосок из `voiceInput.waveformData` — **только MediaRecorder**
- **Interim text** — из `voiceInput.interimText` — **только Web Speech**
- **Индикатор режима** — под input row, мелким текстом: "🎙 бесплатное распознавание" или "🎙 платное распознавание (~50 токенов/мин)"

#### Waveform SVG

```typescript
function Waveform({ data }: { data: number[] }) {
  const bars = data.slice(-20);
  return (
    <svg width={80} height={24} className="voice-waveform">
      {bars.map((v, i) => (
        <rect
          key={i}
          x={i * 4}
          y={12 - v * 12}
          width={2}
          height={Math.max(2, v * 24)}
          rx={1}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
```

---

## 5. UX спецификация

### Состояния input area

**1. Idle (обычный режим):**
```
[ textarea "Или напиши своими словами..." ] [ 🎤 ]   ← input пустой
[ textarea "Привет, я хочу..."           ] [ ↑  ]   ← input с текстом
```

**2. Recording (push-to-talk, палец зажат):**
```
[ ✕  🔴 0:03  ┃▏┃▏┃▏▏  ] [ 🎤 ]   ← палец на кнопке
                             ↑ 🔒    ← замочек над кнопкой (target свайпа)
```

**3. Locked (hands-free):**
```
[ ✕  🔴 1:42  ┃▏┃▏┃▏▏  "и ещё я думаю..." ] [ ■ ]   ← кнопка стоп
```

**4. Processing:**
```
[ ⏳ Распознаю речь... ] [ ⏳ ]   ← spinner
```

**5. Результат:**
```
[ textarea "Привет, я хочу рассказать о..." ] [ ↑ ]   ← текст в textarea, можно отредактировать
```

### Поведение после распознавания

Текст **ВСЕГДА вставляется в textarea**, НЕ отправляется автоматически:
- Пользователь может отредактировать
- Кнопка send (↑) появляется автоматически (т.к. input заполнен)
- Пользователь нажимает ↑ для отправки или очищает и начинает заново

### Лимиты длительности

| Контекст | Максимум | Константа |
|----------|----------|-----------|
| AnonymousChat (лендинг) | 5 минут (300 сек) | `MAX_RECORDING_ANONYMOUS` |
| ChatWindow (авторизованный) | 60 минут (3600 сек) | `MAX_RECORDING_AUTHORIZED` |

- За 30 секунд до лимита: таймер становится **оранжевым** (предупреждение)
- При достижении лимита: **автостоп** → распознавание → текст в textarea
- Константы в коде, позже можно вынести в `app_config`

### Отмена записи

- **Кнопка ✕** — слева в overlay, при любом state (recording/locked)
- **Свайп влево** — на мобильных, touchmove с порогом 60px влево
- При отмене: запись останавливается, ничего не транскрибируется

### Анимации

- **Pulse** — красная точка пульсирует при записи
- **Waveform** — обновляется через requestAnimationFrame
- **Появление/исчезновение** — overlay анимируется через opacity + transform
- **Lock** — замочек анимируется при свайпе вверх (scale + opacity)

---

## 6. Токеномика

### Текущая экономика проекта

- `balance_tokens` = Gemini API totalTokens (input + output)
- `DEFAULT_BALANCE` = 1000 (для новых пользователей)
- Пакеты: 500 за 1290₽, 2000 за 3790₽, 7000 за 14990₽
- 1 balance_token ≈ 2.58₽ (пакет 500) — 2.14₽ (пакет 7000)
- Типичный запрос Gemini: 300–2000 totalTokens

### Стоимость STT

- OpenAI `gpt-4o-mini-transcribe`: **$0.003/мин** ≈ 0.27₽/мин
- Себестоимость ничтожна по сравнению с ценой balance_tokens

### Конверсия

```
STT_TOKENS_PER_MINUTE = 50
```

- 1 минута STT = 50 balance_tokens ≈ 129₽ (при пакете 500)
- Себестоимость: 0.27₽/мин → наценка ~480x
- Это сознательно: голосовой ввод — premium-функция, стимулирует покупку пакетов
- Позже параметр `stt_tokens_per_minute` вынести в таблицу `app_config` для динамического управления

### Списание

- **Клиент передаёт `duration` (секунды) в FormData** вместе с аудио — из таймера хука `useVoiceInput`
- `gpt-4o-mini-transcribe` поддерживает только `response_format: "json"` (без `verbose_json`), поэтому duration от API недоступен
- Округление вверх до целой минуты: `Math.ceil(duration / 60) * STT_TOKENS_PER_MINUTE`
- Минимальное списание: `STT_TOKENS_PER_MINUTE` (даже за 1 секунду)
- Проверка баланса **ДО** вызова OpenAI (чтобы не платить за транскрипцию при недостатке баланса)
- Расчёт стоимости тоже до транскрипции — по duration от клиента

---

## 7. Пошаговый план реализации

### Шаг 1: useVoiceInput хук + Web Speech API + Lock mode

**Файлы:**
- Создать `hooks/useVoiceInput.ts`

**Что делать:**
1. State machine: idle → recording → locked → processing → idle (+ error, cancel)
2. Feature detection: Web Speech vs MediaRecorder vs none
3. Web Speech API интеграция:
   - `recognition.lang = "ru-RU"`, `continuous = true`, `interimResults = true`
   - Обработка `onresult` — interim + final transcript
   - Auto-restart в `onend` когда state === recording/locked
   - Накопление transcript между рестартами
4. Lock mode: `lockRecording()` переводит state recording → locked
5. Waveform: AudioContext + AnalyserNode + RAF loop — **только для MediaRecorder бэкенда** (stream уже есть). Для Web Speech waveform не создаётся (нет stream без лишнего getUserMedia), вместо него interim text.
6. Таймер: setInterval(1000), автостоп при maxDuration
7. isNearLimit: true когда осталось < 30 сек
8. Cleanup: остановка всех ресурсов при unmount/cancel

**Тест:**
- В Chrome: запустить хук, проверить interimResults, финальный transcript, lock mode
- Console.log для всех состояний

### Шаг 2: VoiceButton + VoiceOverlay + Интеграция в чаты

**Файлы:**
- Создать `components/VoiceButton.tsx`
- Создать `components/VoiceOverlay.tsx`
- Изменить `components/ChatWindow.tsx`
- Изменить `components/AnonymousChat.tsx`
- Изменить `app/globals.css`

**Что делать:**

**VoiceButton.tsx:**
1. Рендерит 🎤 (idle, input пуст) или ↑ (input не пуст) или ■ (locked) или ⏳ (processing)
2. pointerdown/pointerup/pointermove для push-to-talk + lock (свайп вверх)
3. Lock target (замочек) над кнопкой — появляется при pointerdown
4. CSS: визуальный размер 28×28 (как send-btn), но touch target 44×44 (через padding/min-width/min-height); gold в idle, red pulse при recording

**VoiceOverlay.tsx:**
1. Заменяет textarea внутри chat-input-row при recording/locked/processing
2. Кнопка отмены ✕, красная точка, таймер, waveform SVG, interim text
3. Индикатор режима под input row

**Интеграция в ChatWindow.tsx:**
```jsx
const voiceInput = useVoiceInput({
  lang: "ru-RU",
  maxDuration: 3600, // 60 мин
  onTranscript: (text) => {
    setInput(prev => prev ? prev + " " + text : text);
    // Обновить высоту textarea
  },
  paidFallbackEnabled: true,
});

// В JSX:
<div className="chat-input-row">
  {voiceInput.state !== "idle" ? (
    <VoiceOverlay voiceInput={voiceInput} onCancel={() => voiceInput.cancelRecording()} />
  ) : (
    <textarea ... />
  )}
  <VoiceButton voiceInput={voiceInput} hasText={!!input.trim()} isStreaming={isStreaming} />
</div>
```

**Интеграция в AnonymousChat.tsx:**
```jsx
const voiceInput = useVoiceInput({
  lang: "ru-RU",
  maxDuration: 300, // 5 мин
  onTranscript: (text) => setInput(prev => prev ? prev + " " + text : text),
  paidFallbackEnabled: false, // только Web Speech
});

// VoiceButton отображается ТОЛЬКО если voiceInput.isSupported
```

**CSS (globals.css):**
```css
.voice-btn {
  /* Визуально 28×28, но touch target 44×44 (Apple HIG minimum) */
  width: 28px;
  height: 28px;
  min-width: 44px;
  min-height: 44px;
  padding: 8px;             /* (44 - 28) / 2 = 8px padding для touch area */
  box-sizing: content-box;
  -webkit-tap-highlight-color: transparent;
  border-radius: 50%;
  /* На десктопе убрать лишний padding */
  @media (min-width: 769px) {
    min-width: unset;
    min-height: unset;
    padding: 0;
  }
}
.voice-btn.recording {
  background: #e53935;
  animation: voice-pulse 1.2s infinite;
}

@keyframes voice-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(229, 57, 53, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(229, 57, 53, 0); }
}

.voice-overlay { display: flex; align-items: center; gap: 8px; flex: 1; }
.voice-timer { font-variant-numeric: tabular-nums; font-size: 13px; }
.voice-timer.near-limit { color: #ff9800; }
.voice-waveform { flex-shrink: 0; }
.voice-interim { flex: 1; font-size: 13px; color: var(--text-muted); overflow: hidden; }
.voice-cancel { /* Кнопка ✕ */ }
.voice-lock-target { /* Замочек над кнопкой при recording */ }
.voice-mode-indicator { font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 4px; }
```

**Тест:**
- ChatWindow: нажать 🎤, наговорить текст, убедиться что текст появился в textarea
- Lock mode: зажать, свайп вверх, отпустить, говорить hands-free, нажать стоп
- AnonymousChat: проверить что кнопка появляется в Chrome, не появляется в Firefox

### Шаг 3: Fallback — MediaRecorder + /api/transcribe

**Файлы:**
- Создать `app/api/transcribe/route.ts`
- Изменить `hooks/useVoiceInput.ts` (добавить MediaRecorder путь)
- Изменить `package.json` (добавить `openai`)

**Что делать:**

1. `npm install openai`
2. API route `/api/transcribe` (код в разделе 3 выше):
   - Авторизация через Supabase
   - Проверка баланса (минимум STT_TOKENS_PER_MINUTE)
   - Транскрипция через OpenAI SDK
   - Списание токенов из balance_tokens
3. В `useVoiceInput.ts` — MediaRecorder путь:
   - `getUserMedia({ audio: true })`
   - MediaRecorder с `audio/webm;codecs=opus`
   - При stopRecording: blob → FormData → fetch /api/transcribe → text
4. Env: `OPENAI_API_KEY` в `.env.local` и Vercel

**Тест:**
- В Firefox/Safari: нажать 🎤, наговорить текст, проверить транскрипцию
- Проверить списание токенов
- Проверить ошибку при недостатке баланса

### Шаг 4: UX polish

**Файлы:**
- Изменить `app/globals.css`
- Возможно `components/VoiceOverlay.tsx`, `components/VoiceButton.tsx`

**Что делать:**
1. Анимация появления/исчезновения overlay (opacity + transform)
2. Свайп влево для отмены (touchmove на мобильных)
3. Анимация замочка при свайпе вверх (scale, opacity, position)
4. Проверка safe area insets для мобильных (уже есть в chat-input-wrap)
5. Haptic feedback через `navigator.vibrate(50)` при начале/стопе записи (если поддерживается)
6. Toast/уведомление при отказе в доступе к микрофону
7. Тестирование на реальных устройствах (iPhone, Android, iPad)

> **Примечание:** touch target 44×44px для кнопки микрофона заложен в CSS сразу в Шаге 2 (через min-width/min-height + padding на мобиле), не откладывается на polish.

---

## 8. Чеклист тестирования

### Функциональность

- [ ] **Chrome desktop**: Web Speech API, русский язык, interim results
- [ ] **Chrome Android**: Web Speech API, push-to-talk, lock mode
- [ ] **Safari desktop**: Web Speech или fallback на MediaRecorder + OpenAI
- [ ] **Safari iOS**: MediaRecorder + OpenAI (Web Speech не работает)
- [ ] **Firefox desktop**: MediaRecorder + OpenAI
- [ ] **Edge desktop**: Web Speech API

### UX

- [ ] Push-to-talk: зажать → говорить → отпустить → текст в textarea
- [ ] Lock mode: зажать → свайп вверх → отпустить → говорить → нажать стоп
- [ ] Отмена: нажать ✕ → запись отменена, ничего не произошло
- [ ] Свайп влево для отмены (мобильные)
- [ ] Interim results: текст появляется в реальном времени (Web Speech)
- [ ] Waveform: визуализация амплитуды при записи
- [ ] Таймер: корректный счёт, оранжевый за 30 сек до лимита
- [ ] Автостоп при достижении лимита

### Лимиты

- [ ] AnonymousChat: автостоп через 5 минут
- [ ] ChatWindow: автостоп через 60 минут
- [ ] Предупреждение за 30 секунд (оранжевый таймер)

### Платный fallback

- [ ] Индикатор "платное распознавание" отображается
- [ ] Токены списываются корректно (STT_TOKENS_PER_MINUTE * ceil(minutes))
- [ ] При недостатке баланса: ошибка "Недостаточно токенов"
- [ ] AnonymousChat: платный fallback отключён, кнопка скрыта если Web Speech недоступен

### Edge cases

- [ ] Нет разрешения на микрофон: информативная ошибка
- [ ] Потеря сети во время Web Speech: graceful handling
- [ ] Очень длинная запись (5+ минут): transcript корректно накапливается
- [ ] Web Speech auto-restart при паузах: пользователь не замечает
- [ ] Размер blob > 25 MB: ошибка на клиенте до отправки
- [ ] Параллельный стриминг ответа: кнопка микрофона disabled

### Зависимости

- [ ] `npm install openai` добавлен в package.json
- [ ] `OPENAI_API_KEY` задан в .env.local
- [ ] `OPENAI_API_KEY` задан в Vercel Environment Variables
- [ ] Сборка `npm run build` проходит без ошибок
- [ ] TypeScript `npx tsc --noEmit` без ошибок
