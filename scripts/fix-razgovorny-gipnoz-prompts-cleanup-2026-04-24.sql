-- =============================================================
-- Fix razgovorny-gipnoz: QR placeholders + anonymous QR + exit + P0 bold
--
-- Аудит npm run check:chats (2026-04-24):
--   ❌ programs.system_prompt / author_chat_system_prompt — literal placeholder
--   ❌ anonymous_system_prompt — нет QUICK REPLIES
--   ❌ 5 hypno_* tool-режимов — placeholder
--   ❌ 5 hypno_* welcome_ai_message — markdown **bold** (P0, visible in UI)
--   ⚠️ free_chat / author_chat welcome_replies — нет exit
-- =============================================================

BEGIN;

-- ─── 1. programs.system_prompt ───
UPDATE programs
SET system_prompt = REPLACE(
  system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Как слова влияют на подсознание»\n«Хочу разобрать реальную ситуацию»\n«Мне сложно сформулировать запрос»'
)
WHERE slug = 'razgovorny-gipnoz';


-- ─── 2. programs.author_chat_system_prompt ───
UPDATE programs
SET author_chat_system_prompt = REPLACE(
  author_chat_system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Как незаметно влиять словами»\n«Как защититься от манипуляций»\n«Мне сложно сформулировать мой вопрос»'
)
WHERE slug = 'razgovorny-gipnoz';


-- ─── 3. anonymous_system_prompt — добавить QR-блок ───
UPDATE programs
SET anonymous_system_prompt = anonymous_system_prompt ||
  E'\n\nФормат Quick Replies: в «ёлочках», каждая на отдельной строке, в конце сообщения, от первого лица пользователя. 3-4 reply + exit. НИКОГДА не склеивай «ёлочки» через пробел в одну строку.\n\nПример:\n\n«Хочу научиться незаметно влиять в переговорах»\n«Замечаю что меня часто "уговаривают"»\n«Интересны встроенные внушения»\n«Мне сложно сформулировать запрос»\n\nЭто ЕДИНСТВЕННЫЙ формат, который рендерится как кнопки. Списки через «—»/«-», нумерация «1. 2. 3.», блок «Что дальше?» — plain-текст без кнопок.'
WHERE slug = 'razgovorny-gipnoz';


-- ─── 4-8. hypno_* tool modes: placeholder → thematic ───
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Услышал внушение в рекламе — разберём»\n«Хочу разобрать диалог с начальником»\n«Мне сложно распознать манипуляции»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'razgovorny-gipnoz' AND mt.key = 'hypno_detect';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Завтра переговоры — готовимся»\n«Разберём недавнюю встречу»\n«Мне сложно сформулировать свою ситуацию»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'razgovorny-gipnoz' AND mt.key = 'hypno_negotiate';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Готов тренировать подстройку»\n«Сыграй роль сложного собеседника»\n«Мне сложно начать симуляцию»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'razgovorny-gipnoz' AND mt.key = 'hypno_rapport';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Дай задание — попробую внушение»\n«Проверь мою фразу»\n«Мне сложно придумать первую фразу»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'razgovorny-gipnoz' AND mt.key = 'hypno_suggest';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Принёс фразу — разбери по слоям»\n«Помоги переписать выступление»\n«Мне сложно выбрать с чего начать»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'razgovorny-gipnoz' AND mt.key = 'hypno_trance';


-- ─── 9-13. P0: welcome_ai_message — убрать **bold** и дублирующий header ───
-- welcome_ai_message рендерится plain-text (NewChatScreen.tsx), markdown виден буквально.
-- Заголовок уже показан в welcome_title — убираем дубль в первой строке.

UPDATE program_modes pm
SET welcome_ai_message =
  E'Встроенные внушения, пресуппозиции, псевдологика — они повсюду: в рекламе, в переговорах, в семейных спорах. Когда ты их видишь — они перестают работать.\n\nКак это работает: я даю фразы и диалоги, насыщенные приёмами влияния. Ты находишь их и называешь. Или описываешь ситуацию из жизни — и я разберу, чем тебя «зацепили».\n\nЧто ты получишь:\n• «Рентгеновское зрение» на манипуляции\n• Знание основных паттернов из книги Бакирова\n• Навык разбора реальных ситуаций'
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'razgovorny-gipnoz' AND mt.key = 'hypno_detect';

UPDATE program_modes pm
SET welcome_ai_message =
  E'Каждые переговоры — это три фоновых линии: контакт, отвлечение, воздействие. И пять этапов: ФДИЛС. Давай разберём твою ситуацию по этой карте.\n\nКак это работает: ты описываешь реальную или предстоящую переговорную ситуацию — я анализирую через призму техник влияния и помогаю подготовиться.\n\nЧто ты получишь:\n• Карту переговоров по трём линиям\n• Стратегию по этапам ФДИЛС\n• Конкретные фразы и приёмы для твоей ситуации'
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'razgovorny-gipnoz' AND mt.key = 'hypno_negotiate';

UPDATE program_modes pm
SET welcome_ai_message =
  E'Подстройка — фундамент любого влияния. Пока нет раппорта — нет контакта, а без контакта любые техники бесполезны.\n\nКак это работает: я сыграю роль собеседника с определённым стилем общения. Твоя задача — подстроиться: поймать ключевые слова, темп, систему восприятия — и повести разговор.\n\nЧто ты получишь:\n• Навык считывания стиля собеседника\n• Практику словесной подстройки\n• Умение вести через раппорт'
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'razgovorny-gipnoz' AND mt.key = 'hypno_rapport';

UPDATE program_modes pm
SET welcome_ai_message =
  E'Встроенные внушения — это искусство вплетать идеи в обычную речь так, чтобы собеседник принял их как свои. Не обман — инструмент.\n\nКак это работает: я даю задание — кого убедить, в чём. Ты пишешь фразу, я разбираю какие паттерны использованы и помогаю усилить.\n\nЧто ты получишь:\n• Навык создания встроенных внушений\n• Практику пресуппозиций, кавычек, трюизмов\n• Обратную связь на каждую фразу'
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'razgovorny-gipnoz' AND mt.key = 'hypno_suggest';

UPDATE program_modes pm
SET welcome_ai_message =
  E'Бакиров: «Воздействие происходит в паузах. А если пауз нет, то нет и качественного влияния». Открытость собеседника — это не магия, а три простых слоя: живая речь (образы и сенсорика вместо абстракций), темп и пауза.\n\nКак это работает: ты приносишь фразу, ситуацию или выступление. Я разбираю речь по слоям: что «левополушарно» (абстрактно, формально), что «правополушарно» (живо). Переписываем вместе — короткими порциями, с паузами.\n\nЧто ты получишь:\n• Навык перевода абстракций в образы и детали\n• Чувство паузы — где её ставить и как держать\n• Короткую, собранную речь, которую хочется слушать'
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'razgovorny-gipnoz' AND mt.key = 'hypno_trance';


-- ─── 14. welcome_replies exit ───
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Как слова влияют на подсознание?", "type": "normal"},
  {"text": "Что такое разговорный гипноз?", "type": "normal"},
  {"text": "Как использовать эти техники этично?", "type": "normal"},
  {"text": "Хочу разобраться в механизмах влияния", "type": "exit"}
]'::jsonb
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'razgovorny-gipnoz' AND mt.key = 'free_chat';

UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Как незаметно влиять словами?", "type": "normal"},
  {"text": "Что такое эриксоновский гипноз?", "type": "normal"},
  {"text": "Как защититься от манипуляций?", "type": "normal"},
  {"text": "Расскажи о силе метафор", "type": "exit"}
]'::jsonb
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'razgovorny-gipnoz' AND mt.key = 'author_chat';


COMMIT;
