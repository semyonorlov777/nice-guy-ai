# ADR-002: Unified OAuth — единый flow для всех провайдеров

**Статус:** accepted
**Дата:** 2026-03-28

> **Контекст для Claude Code:** Читай при добавлении нового OAuth-провайдера, изменении auth flow, или отладке проблем с авторизацией.

## Контекст

Платформа поддерживает 4 метода входа: Telegram, Google, Яндекс, Magic Link. Каждый OAuth-провайдер имеет свой протокол (OIDC, OAuth 2.0), но конечный результат одинаковый — пользователь в Supabase Auth + профиль в `profiles`.

Проблемы:
1. Supabase Auth не поддерживает Telegram и Яндекс как нативные провайдеры
2. OAuth popup могут блокироваться браузерами (особенно на мобилках)
3. `auth.users` и `profiles` могут рассинхронизироваться (пользователь создан в auth, но profile не обновлён)

## Решение

### Единая точка входа: `findOrCreateOAuthUser()`

Все OAuth-провайдеры (кроме Magic Link) проходят через одну функцию в `lib/oauth-common.ts`:

```typescript
interface FindOrCreateOAuthUserParams {
  provider: string;          // "telegram" | "google" | "yandex"
  emailPrefix: string;       // "tg" | "google" | "ya"
  hmacInput: string;         // Уникальный ID от провайдера
  secret: string;            // TELEGRAM_CLIENT_SECRET | GOOGLE_CLIENT_SECRET | ...
  lookupField: string;       // "telegram_id" | "google_id" | "yandex_id"
  lookupValue: string;       // Значение ID
  existingProfileUpdate: {}; // Что обновить при возврате
  newProfileData: {};        // Что записать при создании
}
```

### Механизм: Fake Email + HMAC Password

Supabase Auth требует email + password. Для OAuth-провайдеров:

1. **Fake email:** `tg_12345@niceguy.local`, `google_abc@niceguy.local`, `ya_xyz@niceguy.local`
2. **HMAC password:** `crypto.createHmac('sha256', SECRET).update(providerUserId).digest('base64url')`

Пароль детерминистичен — один и тот же userId всегда даёт один и тот же пароль.

### Flow: 3 сценария

```
1. Returning user (profile найден по lookupField):
   → signInWithPassword(fakeEmail, hmacPassword)
   → update profile

2. New user (profile не найден):
   → admin.createUser(fakeEmail, hmacPassword)
   → update profile с newProfileData
   → signInWithPassword()

3. Recovery (auth.users есть, profiles нет — рассинхрон):
   → createUser falls → "already been registered"
   → signInWithPassword()
   → update profile с обоими наборами данных
```

### Тройное обнаружение авторизации (AuthSheet.tsx)

Три канала параллельно определяют успех авторизации:

| Канал | Как работает | Когда срабатывает |
|-------|-------------|-------------------|
| postMessage | OAuth popup → `window.opener.postMessage('AUTH_SUCCESS')` | Десктоп, popup не заблокирован |
| onAuthStateChange | Supabase SIGNED_IN event через cookies | Magic Link, cross-tab sync |
| Polling getUser() | Каждые 3 сек проверяет `supabase.auth.getUser()` | Fallback, мобилка |

`calledRef` паттерн гарантирует что `onSuccess` вызывается **ровно один раз**, даже если сработали все 3 канала.

## Альтернативы

| Вариант | Почему отвергнут |
|---------|------------------|
| Supabase нативный OAuth для каждого провайдера | Telegram и Яндекс не поддерживаются нативно |
| Отдельные auth-функции на каждый провайдер | Дублирование логики создания/восстановления пользователей |
| Реальные email вместо fake | Telegram не даёт email, Яндекс не всегда |
| JWT-based auth вместо Supabase | Потеря RLS, row-level security на уровне БД |

## Последствия

**Плюсы:**
- Одна функция для всех провайдеров — DRY, тестируемо
- HMAC пароли детерминистичны и безопасны (не хранятся в открытом виде)
- Recovery-логика автоматически чинит рассинхрон auth/profiles
- RLS работает единообразно — `auth.uid()` один и тот же для любого провайдера

**Минусы / trade-offs:**
- Fake emails (`@niceguy.local`) не позволяют отправлять уведомления OAuth-пользователям
- Google — исключение: использует реальный email (отличается от Telegram/Яндекс паттерна)
- При потере SECRET невозможно восстановить HMAC-пароли (нужен сброс)

## Правила для нового кода

**DO:**
- Новый OAuth-провайдер → создай `lib/{provider}-auth.ts` и вызывай `findOrCreateOAuthUser()`
- Добавь колонку `{provider}_id` в таблицу `profiles`
- Добавь route `/api/auth/{provider}/route.ts` (инициация) и `/api/auth/{provider}/callback/route.ts` (callback)
- Обнови CSP в `next.config.ts` — добавь домен провайдера в `script-src`, `frame-src`, `connect-src`
- Обнови middleware.ts — исключи `/api/auth/{provider}/*` из protection

**DON'T:**
- Не пиши auth-логику заново — используй `findOrCreateOAuthUser()`
- Не используй реальный email для Telegram/Яндекс — у них его может не быть
- Не забывай recovery-сценарий (auth.users есть, profiles нет)
- Не забывай `calledRef` паттерн при добавлении нового канала обнаружения

## Связанные файлы

- `lib/oauth-common.ts` — `findOrCreateOAuthUser()` (93 строки)
- `lib/telegram-auth.ts` — Telegram OIDC верификация
- `lib/google-auth.ts` — Google OAuth логика
- `lib/yandex-auth.ts` — Яндекс OAuth логика
- `components/AuthSheet.tsx` — UI + тройное обнаружение
- `middleware.ts` — исключения для auth-routes
- `next.config.ts` — CSP headers
