-- Идемпотентный скрипт: конвертирует старый формат портретов → sections[]
-- Выполнить ПОСЛЕ деплоя нового кода
-- WHERE: только портреты со старым форматом (есть nice_guy_patterns, нет sections)
--
-- defense_mechanisms маппится как type: "patterns" (items: {name, description, intensity})

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
        'id', 'defense_mechanisms', 'title', 'Защитные механизмы', 'icon', '🛡️', 'type', 'patterns',
        'data', jsonb_build_object('items', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'name', m->>'name', 'description', m->>'example', 'intensity', 'medium'
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
