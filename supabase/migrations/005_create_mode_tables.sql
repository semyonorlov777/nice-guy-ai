-- Таблица 1: каталог режимов (shared across books)
CREATE TABLE mode_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'chat',
  chat_type text,
  route_suffix text NOT NULL,
  is_chat_based boolean NOT NULL DEFAULT true,
  default_sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mode_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read mode templates"
  ON mode_templates FOR SELECT USING (true);

-- Таблица 2: какие режимы включены для конкретной книги
CREATE TABLE program_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  mode_template_id uuid NOT NULL REFERENCES mode_templates(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  access_type text NOT NULL DEFAULT 'free' CHECK (access_type IN ('free', 'paid')),
  welcome_message text,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, mode_template_id)
);

CREATE INDEX idx_program_modes_program ON program_modes(program_id);
ALTER TABLE program_modes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read program modes"
  ON program_modes FOR SELECT USING (true);

-- Seed: mode_templates
INSERT INTO mode_templates (key, name, description, icon, chat_type, route_suffix, is_chat_based, default_sort_order) VALUES
  ('exercises',   'Упражнения с психологом', 'AI проведёт через каждое упражнение книги и поможет разобраться', 'pen',   'exercise', '/exercises',   true,  1),
  ('self_work',   'Самостоятельная работа',  'Выполняй упражнения сам — методист проверит и даст обратную связь', 'clock', 'self_work', '/self-work',  true,  2),
  ('test_issp',   'Тест ИССП',              '35 вопросов · 5 минут · Узнай свой профиль синдрома славного парня', 'check', NULL,       '/test/issp',  false, 3),
  ('author_chat', 'Разговор с автором',      'Общайся с Робертом Гловером — AI воспроизводит стиль и подход автора', 'book', 'author',   '/author-chat', true,  4),
  ('free_chat',   'Свободный чат',           'Просто поговори — о книге, о себе, о чём угодно',                  'chat',  'free',     '/chat',        true,  5);

-- Seed: program_modes for nice-guy
INSERT INTO program_modes (program_id, mode_template_id, sort_order, access_type, config)
SELECT
  p.id,
  mt.id,
  mt.default_sort_order,
  CASE WHEN mt.key IN ('test_issp', 'free_chat') THEN 'free' ELSE 'paid' END,
  CASE WHEN mt.key = 'self_work' THEN '{"coming_soon": true}'::jsonb ELSE '{}'::jsonb END
FROM programs p
CROSS JOIN mode_templates mt
WHERE p.slug = 'nice-guy';
