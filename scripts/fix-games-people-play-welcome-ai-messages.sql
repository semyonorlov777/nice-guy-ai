-- =============================================================
-- Fix games-people-play welcome_ai_message: strip markdown artefacts.
--
-- Root cause (see docs/runbooks/chat-message-formatting.md):
--   welcome_ai_message renders as plain text via
--     <div className="nc-ai-text">{welcome.aiMessage}</div>
--   (components/chat/NewChatScreen.tsx:185). All 8 ta_* tool modes
--   start with «🔍 **Название**\n\n» and use **Как это работает:** /
--   **Что ты получишь:** inline — double bug:
--     1. Duplicates welcome_title, which is already shown above.
--     2. `**` pairs are visible literally (no markdown parser here).
--
-- Fix: rewrite 8 modes to plain text — drop title prefix, replace
--   `**Как это работает:**` → `Как это работает:` and `**Что ты
--   получишь:**` → `Что ты получишь:`. Keep `•` bullets and `\n\n`
--   paragraph separators. Content meaning preserved verbatim.
-- =============================================================

BEGIN;

-- 1. ta_diagnostic — Диагностика ТА
UPDATE program_modes pm
SET welcome_ai_message = E'Узнай, какие скрытые паттерны управляют твоими отношениями и решениями. За 10-15 минут определим твой ТА-профиль по методологии Эрика Берна.\n\nКак это работает: Я задаю вопросы про реальные ситуации из твоей жизни — ты отвечаешь как чувствуешь. Никаких правильных ответов.\n\nЧто ты получишь:\n• Свою жизненную позицию (Я+/Ты+ и др.)\n• Основную психологическую игру, в которую ты играешь\n• Своё доминирующее эго-состояние и сценарное предписание'
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'ta_diagnostic'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'games-people-play');

-- 2. ta_game_quiz — Какие игры ты видишь?
UPDATE program_modes pm
SET welcome_ai_message = E'Научись распознавать психологические игры с первого взгляда. Берн описал 36 игр — и большинство из них ты видишь каждый день, просто не знаешь их названий.\n\nКак это работает: Я даю ситуацию — ты определяешь, какая игра разыгрывается, кто в какой роли и зачем.\n\nЧто ты получишь:\n• Навык распознавания скрытых транзакций\n• Знание основных игр из каталога Берна\n• Понимание, зачем люди играют (6 типов выигрыша)'
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'ta_game_quiz'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'games-people-play');

-- 3. ta_game_analysis — Разбор твоей игры
UPDATE program_modes pm
SET welcome_ai_message = E'У каждого есть «любимая» игра — конфликт, который повторяется с разными людьми, но по одному сценарию. Давай разберём твою: найдём крючок, переключение, и главное — зачем тебе этот финал.\n\nКак это работает: Ты описываешь повторяющуюся ситуацию — я раскладываю её по формуле игры Берна.\n\nЧто ты получишь:\n• Название твоей игры из каталога Берна\n• Формулу: кто кого цепляет, через что, ради чего\n• Понимание, какой «выигрыш» ты получаешь'
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'ta_game_analysis'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'games-people-play');

-- 4. ta_ego_states — Кто сейчас говорит?
UPDATE program_modes pm
SET welcome_ai_message = E'В каждый момент ты говоришь из одного из трёх состояний: Родитель, Взрослый или Ребёнок. Научиться их различать — первый шаг к тому, чтобы выбирать, как реагировать, а не действовать на автопилоте.\n\nКак это работает: Мы разберём три эго-состояния через твои реальные ситуации.\n\nЧто ты получишь:\n• Умение различать Р/В/Д в себе\n• Понимание, кто «говорит» в конфликте\n• Навык переключения из автоматического режима в осознанный'
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'ta_ego_states'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'games-people-play');

-- 5. ta_life_script — Твой жизненный сценарий
UPDATE program_modes pm
SET welcome_ai_message = E'Берн обнаружил, что каждый человек к 7 годам уже написал план своей жизни — кто он, чего заслуживает, чем всё закончится. Этот план работает незаметно, как операционная система. Давай найдём твой.\n\nКак это работает: Я задам вопросы о детстве, родительских посланиях и повторяющихся паттернах. Не спеши — нет неправильных ответов.\n\nЧто ты получишь:\n• Понимание своего жизненного сценария\n• Осознание родительских посланий, которые до сих пор действуют\n• Первый шаг к осознанному выбору'
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'ta_life_script'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'games-people-play');

-- 6. ta_script_matrix — Сценарная матрица
UPDATE program_modes pm
SET welcome_ai_message = E'Каждый родитель передаёт два типа посланий: сознательные правила (из своего Родителя) и бессознательные сигналы (из своего Ребёнка). Сценарная матрица — карта, которая показывает, откуда что пришло.\n\nКак это работает: Мы построим матрицу шаг за шагом. Я спрашиваю — ты отвечаешь — я собираю картину.\n\nЧто ты получишь:\n• Карту посланий от мамы и папы\n• Понимание, где контрсценарий, а где предписание\n• Артефакт, к которому можно вернуться'
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'ta_script_matrix'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'games-people-play');

-- 7. ta_game_exit — Выход из игры
UPDATE program_modes pm
SET welcome_ai_message = E'Ты знаешь свою игру. Теперь — потренируйся выходить из неё. Я сыграю роль человека, который тебя провоцирует, а ты попробуешь реагировать по-другому. Безопасное пространство — ошибаться можно и нужно.\n\nКак это работает: Я «забрасываю крючок» — ты практикуешь антитезис: прямой ответ из Взрослого.\n\nЧто ты получишь:\n• Опыт другой реакции на привычную провокацию\n• Конкретные фразы, которые работают\n• Понимание, что чувствуешь, когда НЕ играешь'
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'ta_game_exit'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'games-people-play');

-- 8. ta_permission — Разрешение
UPDATE program_modes pm
SET welcome_ai_message = E'Берн обнаружил, что для выхода из сценария нужно одно: разрешение. Если родитель запретил «Не будь собой» — тебе нужно разрешить себе быть собой. Звучит просто, но это самый мощный инструмент транзактного анализа.\n\nКак это работает: Мы найдём предписание, сформулируем разрешение и составим план.\n\nЧто ты получишь:\n• Формулировку предписания и разрешения\n• Понимание, как автономия выглядит для тебя\n• План: что делать завтра'
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'ta_permission'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'games-people-play');

-- Verification: нет `**` и `🔍 **`/`🎯 **`/`🔎 **` prefixes; first char is Cyrillic letter, not emoji.
SELECT mt.key,
  (pm.welcome_ai_message ~ '\*\*') AS still_has_md_bold,
  (pm.welcome_ai_message ~ '^[A-Za-zА-Яа-яЁё]') AS starts_with_letter,
  LENGTH(pm.welcome_ai_message) AS msg_len,
  (pm.welcome_ai_message LIKE 'Как это работает:%' OR pm.welcome_ai_message LIKE '%\nКак это работает:%') AS has_plain_howto,
  (pm.welcome_ai_message LIKE '%Что ты получишь:%' AND pm.welcome_ai_message NOT LIKE '%**Что ты получишь:**%') AS has_plain_what
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
WHERE mt.key LIKE 'ta_%'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'games-people-play')
  AND pm.enabled = true
ORDER BY pm.sort_order;

COMMIT;
