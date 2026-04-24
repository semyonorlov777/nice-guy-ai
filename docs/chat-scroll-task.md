# Бэклог: scroll всей страницы в чате (вместо только области чата)

**Дата:** 2026-04-24
**Статус:** не начато, вне текущего скоупа
**Приоритет:** nice-to-have (не P0 / P1)

## Проблема

У нас чат работает так: фиксированный заголовок сверху, фиксированный input снизу, а список сообщений скроллится **внутри** узкой области `.chat-messages` между ними. Это на десктопе выглядит как ограниченный «окошко» с прокруткой.

У ChatGPT / Claude / Telegram Web — **другая модель**: вся страница скроллится как обычный документ (кроме фиксированного sidebar / header). Это визуально просторнее, ведёт себя как привычная страница, а не «app с окошком».

## Почему не сделано прямо сейчас

- Текущая архитектура: sticky top (ChatHeader / TabBar), `.chat-zone` с `height: 100%`, внутри `.chat-messages` с `overflow-y: auto`. Изменение = переделать flex-column layout + избавиться от внутреннего скролла.
- **Риски регрессий**:
  - **Мобилка iOS Safari** — там свои глюки со 100vh, bottom bar прыгает при фокусе на input.
  - **Telegram WebView** — есть отдельный код в `lib/detect-browser.ts:isTelegramWebView()` и обходы scroll. Они ломаются при смене модели.
  - **Sticky input** — если убрать внутренний scroll, input нужно делать sticky по-новому (position: sticky / fixed). На iOS + виртуальная клавиатура — трудный случай.
  - **Голосовой ввод, streaming cursor, scroll-to-bottom FAB** — всё завязано на `chat-messages` как scroll-container.

## Когда делать

Когда появится ощутимая жалоба от пользователей или фича которую текущий layout блокирует. Сейчас работает, просто выглядит менее современно на десктопе.

## Идеи реализации (когда возьмёмся)

- **Desktop-first:** body scroll, header sticky-top, input sticky-bottom с `position: sticky; bottom: 0;` + `backdrop-filter: blur` как у ChatGPT.
- **Mobile:** оставить текущую модель (фиксированная клавиатура, прыгающий bottom bar на iOS). Conditional render по `matchMedia("(min-width: 768px)")`.
- **Telegram WebView:** conditional — использовать текущую модель (телеграм добавляет свой header, body-scroll с sticky может конфликтовать).
- Перед мёрджем: протестировать на iOS Safari, Android Chrome, Telegram iOS+Android, десктоп Chrome/Firefox/Safari.

## Связанные файлы

- `components/ChatWindow.tsx` — `.chat-zone`, `.chat-messages`, `chat-input-wrap`
- `components/chat/NewChatScreen.tsx` — `.nc-scroll`, `.nc-input-wrap`
- `components/AnonymousChat.tsx` — `.chat-zone`, `.chat-messages`
- `app/globals.css` — стили `.chat-zone`, `.chat-messages`, `.chat-inner`, `.nc-scroll`, `.nc-screen`
- `lib/detect-browser.ts` — `isTelegramWebView()`
- `hooks/` — useWelcomeAnimation scroll-related, useVoiceInput

## Not-goal

Не превращать это в рефакторинг layout всего приложения. Ограничиться только чат-страницами.
