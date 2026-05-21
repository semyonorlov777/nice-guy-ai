# check-book-spawn-task.ps1
#
# Stop-hook: блокирует завершение сессии, если в свежих коммитах появилась
# новая книга (`feat(<slug>):` + новый `scripts/seed-<slug>.sql`),
# но в jsonl-транскрипте сессии нет вызова `mcp__ccd_session__spawn_task`
# с title «Аудит книги ...».
#
# Поведение:
#   exit 0  — всё ок: либо не сессия по book-to-modes, либо spawn_task уже создан.
#   exit 0 + JSON {decision:"block"} — блокирует завершение, агент должен
#                                       создать spawn_task и попробовать снова.
#
# Защита от ложных срабатываний:
#   - смотрит только последние 10 коммитов текущей ветки/HEAD;
#   - триггер только если в diff коммита есть НОВЫЙ файл `scripts/seed-<slug>.sql`
#     (статус `A`), не правка существующего;
#   - не блокирует если git/jsonl недоступны (graceful degradation — лучше
#     пропустить, чем заблокировать чужую сессию).

$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# 1. Читаем JSON со stdin (формат Stop-hook от Claude Code).
try {
    $stdinRaw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($stdinRaw)) {
        exit 0
    }
    $hookInput = $stdinRaw | ConvertFrom-Json
    $transcriptPath = $hookInput.transcript_path
}
catch {
    # stdin сломан — не блокируем (хук должен быть незаметным в норме).
    exit 0
}

if (-not $transcriptPath -or -not (Test-Path -LiteralPath $transcriptPath)) {
    exit 0
}

# 2. Ищем в ЛОКАЛЬНЫХ коммитах текущей ветки (которые ещё не в origin/main)
#    паттерн `feat(<slug>):` с новым seed-файлом. Это гарантирует что хук
#    смотрит только на работу текущей сессии, а не на исторические коммиты.
$newBookSlug = $null
try {
    # origin/main..HEAD — локальные коммиты, которых нет в main.
    # Если origin/main не существует (свежий clone) — fallback на последние 5.
    $recentCommits = git log "origin/main..HEAD" --format="%H|%s" 2>$null
    if ($LASTEXITCODE -ne 0) {
        $recentCommits = git log -5 --format="%H|%s" 2>$null
    }
    if ($LASTEXITCODE -ne 0 -or -not $recentCommits) {
        exit 0
    }

    foreach ($line in $recentCommits) {
        if ($line -notmatch "^([0-9a-f]+)\|feat\(([a-z0-9-]+)\):") {
            continue
        }
        $commitHash = $matches[1]
        $slug = $matches[2]

        # Берём только статус `A` (added), чтобы отличить новую книгу от правки.
        $diffStatus = git show --name-status --format="" $commitHash 2>$null
        if ($LASTEXITCODE -ne 0) {
            continue
        }

        $hasNewSeed = $false
        foreach ($diffLine in $diffStatus) {
            if ($diffLine -match "^A\s+scripts/seed-$([regex]::Escape($slug))\.sql$") {
                $hasNewSeed = $true
                break
            }
        }

        if ($hasNewSeed) {
            $newBookSlug = $slug
            break
        }
    }
}
catch {
    exit 0
}

if (-not $newBookSlug) {
    # Не сессия по book-to-modes (нет новой книги в коммитах).
    exit 0
}

# 3. Парсим jsonl: ищем mcp__ccd_session__spawn_task с title «Аудит книги ...».
$hasAuditSpawn = $false
try {
    $reader = [System.IO.StreamReader]::new($transcriptPath, [System.Text.Encoding]::UTF8)
    try {
        while (-not $reader.EndOfStream) {
            $jsonLine = $reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($jsonLine)) { continue }
            if ($jsonLine -notmatch "mcp__ccd_session__spawn_task") { continue }
            if ($jsonLine -match "Аудит книги") {
                $hasAuditSpawn = $true
                break
            }
        }
    }
    finally {
        $reader.Dispose()
    }
}
catch {
    # Если jsonl не читается — не блокируем.
    exit 0
}

if ($hasAuditSpawn) {
    exit 0
}

# 4. Блокируем завершение.
$reason = @"
Этап 6.3 скилла book-to-modes пропущен.

Книга ${newBookSlug} закоммичена локально (feat(${newBookSlug}): ... + scripts/seed-${newBookSlug}.sql),
но в сессии нет вызова mcp__ccd_session__spawn_task с title «Аудит книги ...».

Создай chip-карточку сейчас:
- title: «Аудит книги ${newBookSlug} после деплоя»
- prompt: шаблон из .claude/skills/book-to-modes/SKILL.md §6.3

Без chip заказчик не сможет одним кликом запустить book-audit, и Этап 6 проваливается.
После создания spawn_task — можно завершать сессию (хук пропустит).
"@

$blockResponse = @{
    decision = "block"
    reason   = $reason
}

$json = $blockResponse | ConvertTo-Json -Compress -Depth 5

# Пишем UTF-8 байты напрямую в stdout, минуя console encoding.
# Windows PowerShell 5.1 иначе делает двойную перекодировку (UTF-8 → CP1252).
$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
$stdout = [System.Console]::OpenStandardOutput()
$stdout.Write($utf8Bytes, 0, $utf8Bytes.Length)
$stdout.Flush()
exit 0
