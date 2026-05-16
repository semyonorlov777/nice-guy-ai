# Runbook: автоматический подтяг `.env.local` в рабочие копии

**Когда использовать:** автоматически срабатывает при старте Claude Code в любой `.claude/worktrees/*`. Ручной запуск — только если хук не сработал или для разовой починки существующих рабочих копий.
**Время выполнения:** меньше секунды.
**Требования:** Windows, PowerShell, основной репо и рабочая копия на одном диске (NTFS hard link).

## Зачем

Файл `.env.local` лежит в `.gitignore` — git его в рабочую копию не переносит. Без него `npm run dev` не поднимется (нет ключей Supabase, Gemini, OAuth). Раньше каждую рабочую копию приходилось заполнять вручную или вообще не запускать сайт локально.

Теперь при старте Claude Code хук `SessionStart` запускает скрипт `.claude/hooks/sync-env-to-worktree.ps1`, который создаёт hard link на `.env.local` основного репо.

## Как работает

1. Скрипт определяет, что мы в рабочей копии: сравнивает `git rev-parse --git-common-dir` и `git rev-parse --git-dir`. В основном репо они совпадают — скрипт сразу выходит и ничего не делает.
2. Находит корень основного репо: родитель общего `.git` каталога.
3. Для каждого имени из списка (`.env.local`, `.env.sentry-build-plugin`):
   - если в рабочей копии файла нет — создаёт hard link;
   - если есть и md5 совпадает с основным — ничего не делает;
   - если есть, но md5 отличается (например, после `vercel env pull` в основном репо) — удаляет старый файл и создаёт hard link заново.
4. Если рабочая копия и основной репо на разных дисках (hard link между разделами невозможен) — делает обычную копию и пишет об этом в вывод.

## Что увидите в выводе

При старте Claude Code в свежей рабочей копии:
```
[env-sync] hard link: .env.local
```
Если файл уже синхронизирован — ничего не выводится.

## Ручной запуск

Если хук по какой-то причине не сработал, или хочется починить старую рабочую копию вручную:

```powershell
cd C:\Users\Administrator\Documents\nice-guy-ai\.claude\worktrees\<имя-копии>
& "C:\Users\Administrator\Documents\nice-guy-ai\.claude\hooks\sync-env-to-worktree.ps1"
```

Прогнать по всем рабочим копиям разом:
```powershell
Get-ChildItem -Directory "C:\Users\Administrator\Documents\nice-guy-ai\.claude\worktrees" |
  ForEach-Object {
    Push-Location $_.FullName
    & "C:\Users\Administrator\Documents\nice-guy-ai\.claude\hooks\sync-env-to-worktree.ps1"
    Pop-Location
  }
```

## Если поменялись ключи в основном `.env.local`

- **Через обычное сохранение редактором** — изменения мгновенно видны во всех рабочих копиях (это та же запись на диск, hard link разделяет inode).
- **Через `vercel env pull` или редактор с atomic save** — inode меняется, hard link «отвязывается». При следующем старте Claude Code в рабочей копии хук увидит расхождение md5 и пересоздаст link.

## Верификация

1. В рабочей копии: `Test-Path .env.local` → `True`.
2. `fsutil hardlink list .env.local` показывает два пути: основной репо и текущую рабочую копию.
3. `npm run dev` запускается без ошибок подключения к Supabase.

## Частые ошибки

| Симптом | Причина | Решение |
|---------|---------|---------|
| `[env-sync] failed for .env.local: Access to the path is denied.` | Файл открыт другим процессом (например, dev-сервером) | Остановить процесс и перезапустить Claude Code |
| Хук не запускается | Не нажат «Allow» при первом старте | В Claude Code: `/hooks` → подтвердить SessionStart |
| В выводе `copy (different drives)` | Рабочая копия на другом диске | Перенести `.claude/worktrees` на тот же диск что и основной репо |
| Скрипт молчит, файла нет | В основном репо тоже нет `.env.local` | Создать `.env.local` в основном репо (`vercel env pull` или вручную) |

## Откат

Удалить хук: убрать секцию `SessionStart` из `.claude/settings.json`. Существующие hard link останутся — это просто файлы.
