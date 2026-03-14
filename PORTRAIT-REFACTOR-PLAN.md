# Рефакторинг портрета: динамическая структура sections[]

## Контекст

Портрет сейчас захардкожен под одну книгу: 5 фиксированных полей (`nice_guy_patterns`, `key_insights`, `family_system`, `defense_mechanisms`, `growth_zones`). При добавлении второй программы (Берн) пришлось бы дублировать типы и рендеринг. Переходим на `sections[]` — массив секций, где каждая описывает себя (id, title, type, data). Код портрета станет универсальным, а специфика программы живёт в промпте (хранится в БД).

## Целевая структура

```typescript
// Discriminated union — полный type safety
export type PortraitSection =
  | { id: string; title: string; icon?: string; type: "patterns"; data: PatternsData }
  | { id: string; title: string; icon?: string; type: "text"; data: TextData }
  | { id: string; title: string; icon?: string; type: "insights"; data: InsightsData }
  | { id: string; title: string; icon?: string; type: "tags"; data: TagsData };

interface PatternsData {
  summary?: string;
  items: Array<{ name: string; description: string; intensity: "high" | "medium" | "noticed" }>;
}
interface TextData { text: string; }
interface InsightsData { items: Array<{ text: string; source?: string; date?: string }>; }
interface TagsData { items: string[]; }

interface PortraitContent {
  version: number;
  exercises_completed: number;
  summary?: string;
  ai_context?: string;        // КРИТИЧНО: остаётся top-level — chat/route.ts его читает
  sections: PortraitSection[];
}
```

---

## Затрагиваемые файлы

| Файл | Что меняется |
|------|-------------|
| `types/portrait.ts` | Полная замена типов: старые интерфейсы → sections-архитектура + convertLegacyPortrait() |
| `app/program/[slug]/(app)/portrait/page.tsx` | Динамический рендер sections[] + COUNT вместо TOTAL_EXERCISES=46 |
| `app/api/portrait/update/route.ts` | Загрузка промпта из programs.portrait_prompt с fallback на файл |
| `lib/prompts/portrait-analyst.ts` | JSON-схема в промпте → sections[] формат |
| `app/globals.css` | +2 CSS-класса для type="tags" (.portrait-tags, .portrait-tag) |
| `app/api/chat/route.ts` | **НЕ ТРОГАТЬ** — ai_context на top-level, строки 220-225 работают |
| `app/api/portrait/route.ts` | Автоматически подхватит новый EMPTY_PORTRAIT, код не меняется |

---

## Изменения по файлам

### 1. `types/portrait.ts` — полная замена

**Было:**
```typescript
interface PortraitContent {
  version: number;
  last_updated: string;
  exercises_completed: number;
  nice_guy_patterns: { summary: string; patterns: PortraitPattern[] };
  key_insights: PortraitInsight[];
  family_system: { summary: string; details: PortraitFamilyDetail[] };
  defense_mechanisms: { summary: string; mechanisms: PortraitDefenseMechanism[] };
  growth_zones: { summary: string; observations: PortraitGrowthObservation[] };
  ai_context: string;
}
```

**Стало:** Discriminated union PortraitSection (см. целевую структуру выше), EMPTY_PORTRAIT с version: 2 и sections: [].

Также добавить `convertLegacyPortrait(old)` — конвертирует старый формат → sections[]. Используется на portrait page до миграции данных.

### 2. `app/program/[slug]/(app)/portrait/page.tsx` — динамический рендер

**Было:**
- Строка 6: `const TOTAL_EXERCISES = 46;`
- Строки 37-41: 5 отдельных проверок `hasPatterns`, `hasInsights`, ...
- Строки 84-167: 5 захардкоженных блоков рендеринга

**Стало:**
- COUNT запрос: `supabase.from("exercises").select("id", { count: "exact", head: true }).eq("program_id", program.id)`
- Backward-compat: если `content` старого формата → `convertLegacyPortrait(content)`
- `isEmpty = !content || content.sections.length === 0`
- Один цикл `content.sections.map()` с switch по `section.type`:
  - **patterns** → переиспользует `.portrait-card`, `.portrait-badge--{intensity}`
  - **insights** → переиспользует `.portrait-insight`, `.portrait-insight-dot`, `.portrait-insight-text`
  - **text** → переиспользует `.portrait-text`
  - **tags** → новые `.portrait-tags` + `.portrait-tag`

### 3. `app/api/portrait/update/route.ts` — промпт из БД

**Было (строка 88):** `analyzeForPortrait(PORTRAIT_ANALYST_PROMPT, userMessage)`

**Стало:** После загрузки chat, загрузить программу:
```typescript
const { data: programRow } = await supabase
  .from("programs").select("portrait_prompt").eq("id", chat.program_id).single();
const promptToUse = programRow?.portrait_prompt || PORTRAIT_ANALYST_PROMPT;
```
Импорт файла остаётся как fallback.

### 4. `lib/prompts/portrait-analyst.ts` — обновить JSON-схему

Заменить секцию ФОРМАТ ОТВЕТА (строки 103-167): старый формат с `nice_guy_patterns` → новый с `sections[]`. Инструкции анализа, терминология Гловера, правила — без изменений.

### 5. `app/globals.css` — +2 класса

```css
.portrait-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.portrait-tag { font-size: 13px; padding: 4px 12px; border-radius: 16px; background: var(--bg-elevated); color: var(--text-secondary); border: 1px solid var(--border-light); }
```

Старые классы (.portrait-mechanism, .portrait-observation) оставить — не мешают.

---

## SQL-миграции

### DDL — добавить колонку (выполнить до деплоя)

```sql
ALTER TABLE programs ADD COLUMN IF NOT EXISTS portrait_prompt TEXT;
```

### Миграция данных — конвертация портретов (выполнить ПОСЛЕ деплоя)

```sql
-- Идемпотентный скрипт: конвертирует старый формат → sections[]
-- WHERE: только портреты со старым форматом (есть nice_guy_patterns, нет sections)
UPDATE portraits SET content = jsonb_build_object(
  'version', 2,
  'exercises_completed', COALESCE((content->>'exercises_completed')::int, 0),
  'ai_context', COALESCE(content->>'ai_context', ''),
  'sections', (
    SELECT COALESCE(jsonb_agg(section ORDER BY ord), '[]'::jsonb) FROM (
      SELECT 1 as ord, jsonb_build_object(
        'id', 'nice_guy_patterns', 'title', 'Паттерны', 'icon', '🔄', 'type', 'patterns',
        'data', jsonb_build_object('summary', content->'nice_guy_patterns'->>'summary',
          'items', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'name', p->>'name', 'description', p->>'context', 'intensity', p->>'intensity'
          )), '[]'::jsonb) FROM jsonb_array_elements(content->'nice_guy_patterns'->'patterns') p))
      ) AS section
      WHERE jsonb_array_length(COALESCE(content->'nice_guy_patterns'->'patterns', '[]'::jsonb)) > 0
      UNION ALL
      SELECT 2, jsonb_build_object(
        'id', 'key_insights', 'title', 'Инсайты', 'icon', '💡', 'type', 'insights',
        'data', jsonb_build_object('items', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'text', i->>'text', 'source', COALESCE(i->>'source_title', i->>'source'), 'date', i->>'added_at'
        )), '[]'::jsonb) FROM jsonb_array_elements(content->'key_insights') i))
      ) WHERE jsonb_array_length(COALESCE(content->'key_insights', '[]'::jsonb)) > 0
      UNION ALL
      SELECT 3, jsonb_build_object(
        'id', 'family_system', 'title', 'Семейная система', 'icon', '👨‍👩‍👦', 'type', 'text',
        'data', jsonb_build_object('text', content->'family_system'->>'summary')
      ) WHERE length(COALESCE(content->'family_system'->>'summary', '')) > 0
      UNION ALL
      SELECT 4, jsonb_build_object(
        'id', 'defense_mechanisms', 'title', 'Защитные механизмы', 'icon', '🛡️', 'type', 'insights',
        'data', jsonb_build_object('items', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'text', m->>'name' || ' — ' || m->>'example', 'source', m->>'source'
        )), '[]'::jsonb) FROM jsonb_array_elements(content->'defense_mechanisms'->'mechanisms') m))
      ) WHERE jsonb_array_length(COALESCE(content->'defense_mechanisms'->'mechanisms', '[]'::jsonb)) > 0
      UNION ALL
      SELECT 5, jsonb_build_object(
        'id', 'growth_zones', 'title', 'Зоны роста', 'icon', '🌱', 'type', 'insights',
        'data', jsonb_build_object('items', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'text', o->>'text', 'source', o->>'source', 'date', o->>'added_at'
        )), '[]'::jsonb) FROM jsonb_array_elements(content->'growth_zones'->'observations') o))
      ) WHERE jsonb_array_length(COALESCE(content->'growth_zones'->'observations', '[]'::jsonb)) > 0
    ) sub
  )
), updated_at = now()
WHERE content IS NOT NULL
  AND content ? 'nice_guy_patterns'
  AND NOT content ? 'sections';
```

---

## Маппинг старых секций → sections[]

| Старое поле | section.id | section.type | section.title | Маппинг data |
|-------------|-----------|-------------|---------------|-------------|
| `nice_guy_patterns` | `nice_guy_patterns` | `patterns` | Паттерны | summary → summary, patterns[] → items[] (context → description) |
| `key_insights` | `key_insights` | `insights` | Инсайты | text/source_title/added_at → text/source/date |
| `family_system` | `family_system` | `text` | Семейная система | summary → text |
| `defense_mechanisms` | `defense_mechanisms` | `insights` | Защитные механизмы | name+" — "+example → text, source → source |
| `growth_zones` | `growth_zones` | `insights` | Зоны роста | text/source/added_at → text/source/date |

---

## Риски

| Риск | Вероятность | Митигация |
|------|------------|-----------|
| AI возвращает старый формат после обновления промпта | Низкая | Валидация в update/route.ts: если нет `sections` → warn, не сохранять |
| Между деплоем и миграцией данных портреты пустые | Средняя | `convertLegacyPortrait()` на portrait page конвертирует старый формат on-the-fly |
| Порядок секций меняется между обновлениями | Средняя | Инструкция в промпте: "сохраняй порядок секций" |
| ai_context сломается | Минимальная | Поле остаётся top-level, chat/route.ts код не трогаем |

---

## Порядок выполнения

```
1. SQL DDL: portrait_prompt колонка          ← пользователь вручную
2. types/portrait.ts                          ← новые типы + convertLegacyPortrait
3. portrait/page.tsx                          ← динамический рендер + COUNT
4. portrait/update/route.ts                   ← промпт из БД
5. portrait-analyst.ts                        ← новая JSON-схема
6. globals.css                                ← +2 CSS-класса
7. npm run build                              ← проверка
8. git commit + push                          ← деплой
9. SQL миграция данных                        ← пользователь вручную, ПОСЛЕ деплоя
10. Удалить convertLegacyPortrait (опционально, в следующем коммите)
```

## Верификация

1. `npm run build` — без ошибок
2. /program/nice-guy/portrait рендерит секции (backward-compat до миграции)
3. После SQL-миграции данных — портрет отображается корректно
4. Новый portrait update (5 сообщений в чате) — AI генерирует sections[]
5. ai_context инжектируется в чат (проверить в логах Vercel)
