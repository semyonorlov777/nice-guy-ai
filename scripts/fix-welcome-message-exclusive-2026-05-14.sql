-- Migration: fix-welcome-message-exclusive-2026-05-14
-- Linter rule: welcome-message-exclusive (warn)
-- Problem: 9 modes had BOTH welcome_message (legacy markdown body) AND welcome_ai_message + welcome_replies.
--          In chat (lib/chat/prepare-context.ts) legacy wins → modern is wasted.
--          On NewChatScreen welcome card (components/chat/NewChatScreen.tsx:186) modern wins → legacy is wasted.
--          User had to choose ONE source for each mode.
--
-- IMPORTANT: welcome_ai_message renders as PLAIN TEXT on the welcome card. No markdown.
--   - No **bold** (renders literally)
--   - No `- ` bullets (use `•`)
--   - No emoji+title prefix (duplicates welcome_title shown on the card)
--
-- User decisions per mode (after seeing legacy + modern texts side by side):
--   1. nice-guy.author_chat       — keep legacy text body, attach new replies (cleaned of emoji+title prefix)
--   2. nice-guy.exercises         — keep legacy text body, attach new replies (cleaned of **bold** and `- ` bullets)
--   3. nice-guy.free_chat         — pure modern (NULL legacy)
--   4. love-languages.ll_self_analysis  — keep legacy text body (cleaned of **bold**), attach new replies
--   5. love-languages.ll_partner_analysis — same as 4
--   6. love-languages.ll_theory   — keep legacy text body (cleaned), convert legacy inline «...» to structured replies
--   7. love-languages.ll_love_translator   — same as 4
--   8. love-languages.ll_roleplay — same as 4
--   9. love-languages.ll_relationship_map — same as 6 (one reply shortened to fit 60-char limit)

BEGIN;

-- 1. nice-guy.author_chat
UPDATE program_modes
SET welcome_ai_message = $w$Привет. Я Роберт Гловер — автор книги «Хватит быть славным парнем». Рад, что ты здесь. О чём хочешь поговорить?$w$,
    welcome_message = NULL
WHERE program_id = (SELECT id FROM programs WHERE slug = 'nice-guy')
  AND mode_template_id = (SELECT id FROM mode_templates WHERE key = 'author_chat');

-- 2. nice-guy.exercises
UPDATE program_modes
SET welcome_ai_message = $w$В книге 46 упражнений — каждое помогает увидеть конкретный паттерн и сделать реальный шаг. Я проведу тебя через любое из них.

Выбери упражнение из списка или расскажи, с чем хочешь поработать — я подберу подходящее.

Что ты получишь:
• Пошаговое прохождение упражнения с поддержкой
• Конкретный результат: осознание, формулировку или план действий
• Связь упражнения с твоей реальной жизнью$w$,
    welcome_message = NULL
WHERE program_id = (SELECT id FROM programs WHERE slug = 'nice-guy')
  AND mode_template_id = (SELECT id FROM mode_templates WHERE key = 'exercises');

-- 3. nice-guy.free_chat (pure modern — drop legacy)
UPDATE program_modes
SET welcome_message = NULL
WHERE program_id = (SELECT id FROM programs WHERE slug = 'nice-guy')
  AND mode_template_id = (SELECT id FROM mode_templates WHERE key = 'free_chat');

-- 4. love-languages.ll_self_analysis
UPDATE program_modes
SET welcome_ai_message = $w$Многие из нас любят так, как привыкли — а не так, как нам на самом деле нужно. Давай разберёмся, какой язык любви твой.

Мы пойдём через конкретные воспоминания и ситуации из твоей жизни — не тест с баллами, а живой разговор. Ты будешь вспоминать моменты, когда чувствовал(а) себя по-настоящему любимым(ой).

Что ты получишь:
• Поймёшь, какой язык любви для тебя главный
• Увидишь, почему некоторые проявления заботы «не доходят»
• Получишь формулировку — как объяснить партнёру, что тебе нужно$w$,
    welcome_message = NULL
WHERE program_id = (SELECT id FROM programs WHERE slug = 'love-languages')
  AND mode_template_id = (SELECT id FROM mode_templates WHERE key = 'll_self_analysis');

-- 5. love-languages.ll_partner_analysis
UPDATE program_modes
SET welcome_ai_message = $w$Часто мы обижаемся на партнёра не потому, что он не любит — а потому, что он любит на другом языке. Давай расшифруем его/её.

Я буду спрашивать про конкретное поведение твоего партнёра — что он/она делает, на что жалуется, что просит. По этим «уликам» мы определим язык.

Что ты получишь:
• Поймёшь, какой язык любви у партнёра
• Увидишь, что за его/её жалобами стоит неудовлетворённая потребность
• Получишь 3 конкретных действия на языке партнёра$w$,
    welcome_message = NULL
WHERE program_id = (SELECT id FROM programs WHERE slug = 'love-languages')
  AND mode_template_id = (SELECT id FROM mode_templates WHERE key = 'll_partner_analysis');

-- 6. love-languages.ll_theory (legacy inline «...» → structured replies)
UPDATE program_modes
SET welcome_ai_message = $w$Пять языков любви — идея простая. Но в ней есть нюансы, которые меняют всё: диалекты внутри каждого языка, ловушка «я даю то, что нужно мне», и почему влюблённость маскирует несовпадение.

Я не буду читать лекцию — мы будем разбирать концепции через твой опыт. Каждую идею ты проверишь на своей жизни.

Что ты узнаешь:
• 5 языков + их диалекты (подтипы внутри каждого)
• Почему «стадия влюблённости» создаёт иллюзию совпадения
• Как язык любви формируется в детстве$w$,
    welcome_replies = $r$[
      {"text": "Расскажи про все 5 языков — я новичок", "type": "normal"},
      {"text": "Знаю основы, хочу про диалекты", "type": "normal"},
      {"text": "Почему влюблённость проходит?", "type": "normal"},
      {"text": "Как это работает с детьми, а не только с партнёром?", "type": "exit"}
    ]$r$::jsonb,
    welcome_message = NULL
WHERE program_id = (SELECT id FROM programs WHERE slug = 'love-languages')
  AND mode_template_id = (SELECT id FROM mode_templates WHERE key = 'll_theory');

-- 7. love-languages.ll_love_translator
UPDATE program_modes
SET welcome_ai_message = $w$Понять язык партнёра — полдела. Вторая половина — начать на нём говорить. Это как учить иностранный: сначала неловко, потом привыкаешь.

Мы вместе составим конкретные действия, фразы и ритуалы на языке твоего партнёра — привязанные к вашей реальной жизни.

Что ты получишь:
• 5-7 конкретных действий на языке партнёра (не абстрактных)
• Формулировки фраз, если язык партнёра — слова
• Мини-план на ближайшую неделю$w$,
    welcome_message = NULL
WHERE program_id = (SELECT id FROM programs WHERE slug = 'love-languages')
  AND mode_template_id = (SELECT id FROM mode_templates WHERE key = 'll_love_translator');

-- 8. love-languages.ll_roleplay
UPDATE program_modes
SET welcome_ai_message = $w$Самое сложное — не понять теорию, а сказать партнёру: «Мне нужно вот это». Здесь можно безопасно потренироваться.

Я буду играть твоего партнёра — так, как он/она обычно реагирует. Ты тренируешь: как объяснить свой язык, как услышать его/её, как не скатиться в обвинения.

Что ты получишь:
• Отработаешь сложный разговор до того, как он случится
• Найдёшь формулировки, которые не ранят
• Получишь разбор — что сработало и что можно лучше$w$,
    welcome_message = NULL
WHERE program_id = (SELECT id FROM programs WHERE slug = 'love-languages')
  AND mode_template_id = (SELECT id FROM mode_templates WHERE key = 'll_roleplay');

-- 9. love-languages.ll_relationship_map (legacy inline «...» → structured replies; 3rd shortened)
UPDATE program_modes
SET welcome_ai_message = $w$Когда оба партнёра любят — но на разных языках — появляется ощущение «я стараюсь, а он/она не замечает». Давай посмотрим на вашу пару сверху.

Мы составим карту: где ваши языки совпадают, где расходятся, и где возникают «глухие зоны» — моменты, когда забота одного не доходит до другого.

Что ты получишь:
• Увидишь динамику пары как систему, а не «кто виноват»
• Найдёшь конкретные точки, где вы «не слышите» друг друга
• Поймёшь, с чего начать менять$w$,
    welcome_replies = $r$[
      {"text": "Мы часто ссоримся из-за бытовых мелочей", "type": "normal"},
      {"text": "Живём как соседи — рядом, но не вместе", "type": "normal"},
      {"text": "Он/она говорит что я не ценю — не понимаю чего не хватает", "type": "normal"},
      {"text": "Мне сложно сформулировать", "type": "exit"}
    ]$r$::jsonb,
    welcome_message = NULL
WHERE program_id = (SELECT id FROM programs WHERE slug = 'love-languages')
  AND mode_template_id = (SELECT id FROM mode_templates WHERE key = 'll_relationship_map');

COMMIT;
