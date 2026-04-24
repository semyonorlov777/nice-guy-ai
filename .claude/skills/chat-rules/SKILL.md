---
name: chat-rules
description: "Правила системы чатов Nice Guy AI. Обязательно используй этот скилл при ЛЮБЫХ правках чат-интерфейса, welcome-экранов, quick-replies («ёлочек»), system_prompt режимов, welcome_ai_message, welcome_replies, free_chat_welcome, author_chat_welcome, anonymous_system_prompt, anonymous_quick_replies, промптов для Gemini, компонентов ChatWindow / NewChatScreen / AnonymousChat / InputBar. Триггеры: 'чат', 'чата', 'чату', 'чате', 'чаты', 'welcome', 'welcome-экран', 'welcome сообщение', 'welcome_ai_message', 'welcome_replies', 'ёлочки', 'елочки', 'ёлочка', 'quick reply', 'quick replies', 'quick-reply', 'suggested reply', 'suggested replies', 'system_prompt', 'системный промпт', 'системного промпта', 'промпт режима', 'free_chat_welcome', 'author_chat_welcome', 'anonymous_system_prompt', 'ChatWindow', 'NewChatScreen', 'AnonymousChat', 'кнопки в чате', 'кнопок в чате', 'AI отвечает', 'AI не отвечает', 'Gemini ответ', 'вариант 1', 'parseQuickReplies', 'welcome_message', 'welcome_title', 'welcome_subtitle', 'welcome_mode_label'. Также триггерится когда пользователь жалуется что кнопки не появляются, AI пишет вариант 1, welcome слипается, вложенные кавычки, склеенные ёлочки, или показывает скрин с чат-багом."
---

# Правила системы чатов Nice Guy AI

## Когда этот скилл используется

Автоматически при ЛЮБЫХ упоминаниях чата, welcome, ёлочек, quick-replies, system_prompt, имён полей (welcome_ai_message, welcome_replies, free_chat_welcome и т.д.), имён компонентов (ChatWindow, NewChatScreen, AnonymousChat), жалобах вида «кнопки не появляются» / «AI пишет Вариант 1» / «welcome слипается».

## Обязательный процесс

### Шаг 1. Прочитай runbook ПОЛНОСТЬЮ (source of truth)

Файл: [docs/runbooks/chat-message-formatting.md](../../../docs/runbooks/chat-message-formatting.md)

Это **единственный** документ с правилами чатов на платформе. Он собран за всю историю багов. Читать целиком, не по диагонали. Там ~287 строк — займёт 3-5 минут.

Что там:
- Таблица двух поверхностей рендеринга (welcome-экран NewChatScreen vs диалог ChatWindow) — у них разный pipeline.
- Три уровня контента (program → mode → theme) — где какие поля, как наследуются правила.
- Правила для каждого поля БД (welcome_ai_message, welcome_replies, welcome_message, system_prompt, free_chat_welcome, author_chat_welcome и т.д.) — что можно, что нельзя, какой формат.
- Чеклист для ревью seed-SQL новой книги.
- Диагностика живых багов — «вижу такой косяк → причина → фикс».

### Шаг 2. Свяжись с другими скиллами (не противоречь)

- [`book-to-modes`](../book-to-modes/SKILL.md) — процесс создания книги. REFERENCE.md §5 содержит промпт-шаблон с блоком Quick replies.
- [`book-audit`](../book-audit/SKILL.md) — аудит существующих книг.
- Если обновляешь правила — синхронно обнови и runbook, и скиллы.

### Шаг 3. Делай правки строго по runbook

Любая правка `welcome_ai_message`, `welcome_replies`, `system_prompt`, `free_chat_welcome`, `author_chat_welcome` **обязана** удовлетворять чеклисту из секции «Чеклист для ревью нового seed-SQL». До коммита пройди чеклист по каждому пункту.

### Шаг 4. Проверь в браузере (runtime verification)

Не достаточно `tsc --noEmit` + `npm run build`. Для чат-правок обязательно:
1. `npm run dev` + `/api/auth/dev-login`
2. Открой **изменённый** welcome-экран — убедись что:
   - абзацы читаются (`\n\n` работают, нет стены текста);
   - буллеты `•` на отдельных строках;
   - нет markdown-звёздочек в UI;
   - welcome_replies кнопки появились.
3. Отправь сообщение → AI ответит → внизу должны быть кнопки-«ёлочки» (а не plain-текст `Вариант 1`).
4. Если правил `programs.free_chat_welcome` / `author_chat_welcome` — проверь три сценария: `/program/<slug>/chat` (free), клик на тему на хабе, `/author-chat`.

### Шаг 5. Если нашёл новое правило — запиши в runbook

Если в процессе работы вылез новый случай, которого в runbook нет — **не молчать**:
1. Добавь секцию в `docs/runbooks/chat-message-formatting.md` в «Диагностика живых багов» (формат: симптом → причина → фикс).
2. Если правило касается проектирования новой книги — также обнови `.claude/skills/book-to-modes/references/REFERENCE.md` §5 / `PLATFORM_MAP.md`.
3. Коммит отдельный, с `docs(runbook): ...` или `docs(skill): ...`.

## Типичные ошибки, которые этот скилл предотвращает

Из истории багов на платформе:

1. **AI пишет `Вариант 1` plain-текстом вместо «ёлочек»** — причина: литеральный placeholder `«Вариант 1»` в system_prompt воспринимается Gemini как literal output. Фикс: тематические примеры по домену режима.
2. **welcome_ai_message слипается в стену** — причина: нет `white-space: pre-line` в `.nc-ai-text` ИЛИ нет `\n\n` между абзацами в БД. Оба — см. runbook.
3. **Вложенные «ёлочки» ломают regex** — `«Что значит «развитие»?»` → парсер захватит только до первого `»`. Убирать внутренние кавычки.
4. **Склеенные «ёлочки» через пробел** — `«Вариант 1» «Вариант 2»` на одной строке не распознаются. Каждая на отдельной.
5. **Пунктуация снаружи кавычек** — `«Текст».` ломает regex `[»]$`.
6. **Markdown в welcome_ai_message** — `**bold**` рендерится буквально (plain-text). В welcome_message через ChatWindow markdown работает.
7. **Дубликат title в начале welcome_ai_message** — заголовок уже рендерится карточкой выше.
8. **Темы без правил quick-replies** — темы наследуют `programs.system_prompt`, поэтому блок Quick replies должен быть там, иначе темы ломаются.
9. **welcome_replies как массив строк вместо объектов** — `["текст"]` → пустые кнопки; нужно `[{"text": "...", "type": "normal"}, ...]`, последний с `type: "exit"`.
10. **Отсутствие `photo_url` локально** — внешние URL авторских фото ломаются через CSP. Читать правило `photo_url = /authors/{slug}.jpg` из `book-to-modes`.

## Правило жёсткости

Этот скилл **обязателен**, не рекомендация. Если пропустить — 99% что появится баг из списка выше. Пользователь прямо сказал: «после твоих правок чатом невозможно пользоваться». Всегда читать runbook, всегда проверять в браузере.

## 🚨 Архитектурный инвариант (единый рендерер + правильный layout)

С 2026-04-23 ВСЕ чат-поверхности (ChatWindow, NewChatScreen, AnonymousChat + любые новые) ОБЯЗАНЫ использовать два компонента из [`components/chat/ChatMessage.tsx`](../../../components/chat/ChatMessage.tsx):

- **`<AIBubble>`** — пузырь AI с ReactMarkdown + `remark-breaks`
- **`<QuickReplyBar>`** — блок кнопок-«ёлочек»

Парсер «ёлочек» — единый: [`lib/chat/parse-quick-replies.ts`](../../../lib/chat/parse-quick-replies.ts). **НЕ дублировать локально.**

**🔥 КРИТИЧНОЕ ПРАВИЛО LAYOUT:** `<QuickReplyBar>` размещается как **SIBLING** (рядом, через `<Fragment>`), а не ВНУТРИ контейнера `.nc-msg`/`.msg`. Иначе кнопки попадут в узкую правую колонку flex-row (баг 2026-04-24, обнаружен после первой итерации единого рендера).

**Шаблон:**
```tsx
import { Fragment } from "react";
import { AIBubble, QuickReplyBar } from "@/components/chat/ChatMessage";
import { parseQuickReplies } from "@/lib/chat/parse-quick-replies";

const { cleanText, replies } = parseQuickReplies(text, isLast && isStreaming);

return (
  <Fragment key={msg.id}>
    <div className="msg msg-ai">            {/* flex-row */}
      <div className="msg-avatar ai" />
      <AIBubble text={cleanText} className="msg-bubble" />
    </div>
    {isLast && !isStreaming && (          {/* SIBLING, НЕ внутри .msg-ai */}
      <QuickReplyBar
        replies={replies}
        onClick={handleSend}
        classNames={{ container: "quick-replies", button: "quick-reply-btn" }}
      />
    )}
  </Fragment>
);
```

**Причина инварианта:** до 2026-04-23 `parseQuickReplies` был локально в ChatWindow; NewChatScreen и AnonymousChat рендерили AI-ответы через голый ReactMarkdown. Пользователь видел «ёлочки» plain-текстом. После первой попытки фикса (монолитный `<ChatMessage>`) кнопки уехали в узкую колонку справа — потребовалась вторая итерация с разделением и правильным layout. Подробный кейс: [`docs/chat-audit-eq-2-0.md`](../../../docs/chat-audit-eq-2-0.md).

**Нарушение = возврат к классу багов.** Если расширяешь API — не создавай обход.
