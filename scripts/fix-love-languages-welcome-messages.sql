-- =============================================================
-- Fix love-languages welcome_message: strip duplicated title prefix.
--
-- Root cause (see docs/runbooks/chat-message-formatting.md):
--   welcome_message is used as the first AI message in the chat
--   history — see app/program/[slug]/(app)/chat/[chatId]/page.tsx:89
--   where `welcomeMessage = mode?.welcome_message || ...`.
--   ChatWindow renders welcomeMessage via ReactMarkdown, so markdown
--   and «ёлочки» starter replies at the end work correctly. But each
--   of the 6 ll_* tool modes begins with «[эмодзи] **[Название]**\n\n»
--   (e.g. `💛 **Мой язык любви**\n\n`) which duplicates welcome_title
--   that was already shown on the welcome screen just before.
--
-- Fix: rewrite welcome_message for 6 ll_* modes — drop the title
--   prefix line and the `\n\n` after it. Keep the rest verbatim:
--   markdown `**Что ты получишь:**`/`**Что ты узнаешь:**` section,
--   `•` bullets and «ёлочки» at the end (starter replies in chat).
-- =============================================================

BEGIN;

-- 1. ll_self_analysis — Мой язык любви
UPDATE program_modes pm
SET welcome_message = E'Многие из нас любят так, как привыкли — а не так, как нам на самом деле нужно. Давай разберёмся, какой язык любви твой.\n\nМы пойдём через конкретные воспоминания и ситуации из твоей жизни — не тест с баллами, а живой разговор. Ты будешь вспоминать моменты, когда чувствовал(а) себя по-настоящему любимым(ой).\n\n**Что ты получишь:**\n• Поймёшь, какой язык любви для тебя главный\n• Увидишь, почему некоторые проявления заботы «не доходят»\n• Получишь формулировку — как объяснить партнёру, что тебе нужно\n\n«Я не уверен(а), какой у меня язык»\n«Мне кажется, я знаю свой — хочу проверить»\n«Партнёр говорит, что я не умею принимать любовь»\n«Мне сложно сформулировать»'
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'll_self_analysis'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'love-languages');

-- 2. ll_partner_analysis — Язык партнёра
UPDATE program_modes pm
SET welcome_message = E'Часто мы обижаемся на партнёра не потому, что он не любит — а потому, что он любит на другом языке. Давай расшифруем его/её.\n\nЯ буду спрашивать про конкретное поведение твоего партнёра — что он/она делает, на что жалуется, что просит. По этим «уликам» мы определим язык.\n\n**Что ты получишь:**\n• Поймёшь, какой язык любви у партнёра\n• Увидишь, что за его/её жалобами стоит неудовлетворённая потребность\n• Получишь 3 конкретных действия на языке партнёра\n\n«Он/она постоянно жалуется, что я мало времени провожу дома»\n«Мне кажется, что бы я ни делал(а) — всё не так»\n«Хочу понять, почему мои подарки не радуют»\n«Мне сложно сформулировать»'
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'll_partner_analysis'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'love-languages');

-- 3. ll_relationship_map — Карта отношений
UPDATE program_modes pm
SET welcome_message = E'Когда оба партнёра любят — но на разных языках — появляется ощущение «я стараюсь, а он/она не замечает». Давай посмотрим на вашу пару сверху.\n\nМы составим карту: где ваши языки совпадают, где расходятся, и где возникают «глухие зоны» — моменты, когда забота одного не доходит до другого.\n\n**Что ты получишь:**\n• Увидишь динамику пары как систему, а не «кто виноват»\n• Найдёшь конкретные точки, где вы «не слышите» друг друга\n• Поймёшь, с чего начать менять\n\n«Мы часто ссоримся из-за бытовых мелочей»\n«Живём как соседи — рядом, но не вместе»\n«Он/она говорит что я не ценю — а я не понимаю, чего не хватает»\n«Мне сложно сформулировать»'
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'll_relationship_map'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'love-languages');

-- 4. ll_theory — Теория 5 языков
UPDATE program_modes pm
SET welcome_message = E'Пять языков любви — идея простая. Но в ней есть нюансы, которые меняют всё: диалекты внутри каждого языка, ловушка «я даю то, что нужно мне», и почему влюблённость маскирует несовпадение.\n\nЯ не буду читать лекцию — мы будем разбирать концепции через твой опыт. Каждую идею ты проверишь на своей жизни.\n\n**Что ты узнаешь:**\n• 5 языков + их диалекты (подтипы внутри каждого)\n• Почему «стадия влюблённости» создаёт иллюзию совпадения\n• Как язык любви формируется в детстве\n\n«Расскажи про все 5 языков — я новичок»\n«Знаю основы, хочу про диалекты»\n«Почему влюблённость проходит?»\n«Как это работает с детьми, а не только с партнёром?»'
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'll_theory'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'love-languages');

-- 5. ll_love_translator — Переводчик любви
UPDATE program_modes pm
SET welcome_message = E'Понять язык партнёра — полдела. Вторая половина — начать на нём говорить. Это как учить иностранный: сначала неловко, потом привыкаешь.\n\nМы вместе составим конкретные действия, фразы и ритуалы на языке твоего партнёра — привязанные к вашей реальной жизни.\n\n**Что ты получишь:**\n• 5-7 конкретных действий на языке партнёра (не абстрактных)\n• Формулировки фраз, если язык партнёра — слова\n• Мини-план на ближайшую неделю\n\n«Язык партнёра — качественное время, а у меня на это нет сил»\n«Он/она хочет слов, а я не умею говорить о чувствах»\n«Хочу удивить партнёра на этой неделе»\n«Мне сложно сформулировать»'
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'll_love_translator'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'love-languages');

-- 6. ll_roleplay — Разговор с партнёром
UPDATE program_modes pm
SET welcome_message = E'Самое сложное — не понять теорию, а сказать партнёру: «Мне нужно вот это». Здесь можно безопасно потренироваться.\n\nЯ буду играть твоего партнёра — так, как он/она обычно реагирует. Ты тренируешь: как объяснить свой язык, как услышать его/её, как не скатиться в обвинения.\n\n**Что ты получишь:**\n• Отработаешь сложный разговор до того, как он случится\n• Найдёшь формулировки, которые не ранят\n• Получишь разбор — что сработало и что можно лучше\n\n«Хочу объяснить партнёру, что мне нужно больше слов»\n«Он/она обижается, когда я прошу — хочу найти другой подход»\n«Мы давно не разговаривали по душам — не знаю как начать»\n«Мне сложно сформулировать»'
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'll_roleplay'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'love-languages');

-- Verification: no title prefix left, starter «ёлочки» preserved at the end.
SELECT mt.key,
  (pm.welcome_message ~ '^[^\n]+ \*\*[^*]+\*\*\n\n') AS still_has_title_prefix,
  (pm.welcome_message LIKE E'%«Мне сложно сформулировать»') AS ends_with_safe_exit_elochka,
  LENGTH(pm.welcome_message) AS msg_len
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
WHERE mt.key LIKE 'll_%'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'love-languages')
  AND pm.enabled = true
ORDER BY pm.sort_order;

COMMIT;
