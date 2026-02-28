-- Set welcome_message and quick_replies in the config field of the nice-guy program
UPDATE programs
SET config = jsonb_build_object(
  'welcome_message', 'Привет! Расскажи — что привело тебя сюда?

Может, чувствуешь что живёшь не для себя, или что окружающие не ценят то, что ты для них делаешь? А может, просто ощущение что что-то идёт не так — но сложно сформулировать что именно?',
  'quick_replies', jsonb_build_array(
    'Все сидят на шее, а я терплю',
    'Проблемы в отношениях',
    'Просто чувствую что живу не так'
  )
)
WHERE slug = 'nice-guy';
