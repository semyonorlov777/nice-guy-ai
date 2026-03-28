# Nice Guy AI

AI-платформа тренажёров по книгам по психологии и саморазвитию.

🌐 **Production:** [nice-guy-ai.vercel.app](https://nice-guy-ai.vercel.app)

## Программы

- **"No More Mr. Nice Guy"** (Гловер) — 46 упражнений, тест ISSP, портрет, чат с автором
- **"Games People Play"** (Берн) — свободный чат, чат с автором, портрет
- **"5 Love Languages"** (Чепмен) — свободный чат, чат с автором, портрет

Новые книги добавляются через seed SQL → UI подхватывает автоматически.

## Quick Start

```bash
# 1. Установка зависимостей
npm install

# 2. Настройка окружения
cp .env.local.example .env.local
# Заполни переменные — см. docs/env-vars.md

# 3. Запуск
npm run dev

# 4. Авторизация (dev-режим)
# Открой http://localhost:3000/api/auth/dev-login
# Создаст тестовую сессию и перенаправит в приложение
```

## Архитектура

```
Browser → Next.js 16 (Vercel)
            ├── Google Gemini Flash → AI-чат (стриминг)
            ├── Google Gemini Pro   → Психологический портрет
            ├── Supabase            → PostgreSQL + Auth + RLS
            └── YooKassa            → Платежи, подписки
```

## Стек

- **Next.js 16** + TypeScript + Tailwind CSS 4
- **Supabase** — PostgreSQL, Auth (Telegram, Google, Яндекс, Magic Link), RLS
- **Google Gemini API** — Flash (чат), Pro (анализ портретов)
- **Vercel AI SDK** — стриминг чата
- **YooKassa** — платежи, подписки, webhook
- **Sentry** — мониторинг ошибок

## Команды

```bash
npm run dev          # Локальный сервер (localhost:3000)
npm run build        # Проверка сборки
npm run lint         # Линтер
npx tsc --noEmit     # Проверка TypeScript
```

## Документация

| Что | Где |
|-----|-----|
| Полная структура проекта, паттерны, правила | [CLAUDE.md](CLAUDE.md) |
| Почему приняты архитектурные решения | [docs/adr/](docs/adr/) |
| Пошаговые инструкции операций | [docs/runbooks/](docs/runbooks/) |
| Схема базы данных | [docs/schema/](docs/schema/) |
| Справочник env-переменных | [docs/env-vars.md](docs/env-vars.md) |
| Что нового | [CHANGELOG.md](CHANGELOG.md) |

## Для Claude Code

Основной контекст — **[CLAUDE.md](CLAUDE.md)**. AI-навыки в `.claude/skills/`. Архитектурные решения в `docs/adr/`.
