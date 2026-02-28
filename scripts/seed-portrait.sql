-- Seed script: insert test portrait for development
-- Run in Supabase SQL Editor
--
-- Prerequisites:
--   1. portraits table exists
--   2. At least one user and one program exist

-- Insert test portrait (upsert: update if already exists)
INSERT INTO portraits (user_id, program_id, content)
SELECT
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM programs WHERE slug = 'nice-guy' LIMIT 1),
  '{
    "version": 1,
    "last_updated": "2026-02-28T12:00:00Z",
    "exercises_completed": 5,
    "nice_guy_patterns": {
      "summary": "Выраженный паттерн угождения на работе, скрытые контракты в отношениях, подавление гнева",
      "patterns": [
        {
          "name": "Угождение",
          "context": "на работе — берёт чужие задачи, не может отказать",
          "intensity": "high",
          "sources": ["exercise_2", "exercise_3"],
          "first_seen": "2026-02-26"
        },
        {
          "name": "Скрытые контракты",
          "context": "ожидает благодарности от жены за переработки",
          "intensity": "medium",
          "sources": ["exercise_5"],
          "first_seen": "2026-02-28"
        },
        {
          "name": "Подавление потребностей",
          "context": "не говорит чего хочет в отношениях",
          "intensity": "noticed",
          "sources": ["exercise_1"],
          "first_seen": "2026-02-26"
        }
      ]
    },
    "key_insights": [
      {
        "text": "Связал критику матери с неспособностью говорить «нет» на работе",
        "source": "exercise_5",
        "source_title": "Упражнение 5",
        "added_at": "2026-02-28"
      },
      {
        "text": "Осознал, что «быть хорошим» — стратегия выживания из детства, а не осознанный выбор",
        "source": "exercise_2",
        "source_title": "Упражнение 2",
        "added_at": "2026-02-27"
      }
    ],
    "family_system": {
      "summary": "Мама — контролирующая, часто критиковала за проявление эмоций. Отец — эмоционально отстранённый, избегал конфликтов.",
      "details": [
        { "source": "exercise_2", "insight": "Мама часто говорила «нормальные дети так не делают»", "added_at": "2026-02-27" },
        { "source": "exercise_4", "insight": "Отец уходил в гараж при любом конфликте", "added_at": "2026-02-27" }
      ]
    },
    "defense_mechanisms": {
      "summary": "Рационализация, избегание",
      "mechanisms": [
        { "name": "Рационализация", "example": "Объясняет угождение как «я просто добрый человек»", "source": "exercise_3" },
        { "name": "Избегание", "example": "Переводит тему когда разговор уходит в детские обиды", "source": "exercise_4" }
      ]
    },
    "growth_zones": {
      "summary": "Начал замечать паттерн угождения в повседневной жизни",
      "observations": [
        { "text": "Впервые назвал своё поведение «угождением», а не «заботой»", "source": "exercise_2", "added_at": "2026-02-27" },
        { "text": "Начал замечать паттерн угождения в момент когда он происходит", "source": "exercise_5", "added_at": "2026-02-28" }
      ]
    },
    "ai_context": "Мужчина ~30 лет. Выраженный паттерн угождения на работе (берёт чужие задачи, не может отказать) и скрытые контракты в отношениях с женой (ожидает благодарности за переработки, но не озвучивает ожидания). Семья: мать контролирующая и критикующая, отец эмоционально отстранённый. Защитные механизмы: рационализация (\"я просто добрый\"), избегание болезненных тем. Зоны роста: начал замечать паттерн угождения и называть его своим именем. В следующих упражнениях стоит углубиться в тему скрытых контрактов и связь с семейной системой."
  }'::jsonb
ON CONFLICT (user_id, program_id)
DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = now();
