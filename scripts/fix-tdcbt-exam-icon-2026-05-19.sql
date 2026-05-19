-- =============================================================================
-- Fix: transdiagnostic-cbt — дубль иконки `check` у Теста и Экзамена
-- Date: 2026-05-19
-- Apply: MCP Supabase execute_sql (УЖЕ ПРИМЕНЕНО на проде)
-- =============================================================================
-- Проблема (из аудита transdiagnostic-cbt-audit.md, P3):
--   `tdcbt_exam.icon` = "check" и `test_tdcbt-mastery.icon` = "check" — на хабе
--   в секции «Инструменты» появлялись две карточки с одной иконкой ✓
--   (Экзамен golden + Тест зелёный). Цветовая дифференциация частично помогала,
--   но семантически — обе карточки про «оценку», и иконка не помогала их различить.
--
-- Решение:
--   Сменить `tdcbt_exam.icon` на `flask` — лабораторная колба ассоциируется
--   с винетками как «лабораторными пробами» case formulation. Тест оставляем
--   с `check` (стандартная иконка для тестов на платформе).
--
--   `flask` присутствует в `INSTRUMENT_ICON_MAP` (components/hub/InstrumentList.tsx).
-- =============================================================================

UPDATE mode_templates SET icon = 'flask' WHERE key = 'tdcbt_exam';

-- Верификация: на хабе не должно быть двух режимов с одинаковой иконкой
SELECT mt.icon, array_agg(mt.key ORDER BY mt.key) as duplicate_keys
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
JOIN programs p ON p.id = pm.program_id
WHERE p.slug = 'transdiagnostic-cbt'
  AND pm.enabled = true
GROUP BY mt.icon
HAVING COUNT(*) > 1;
-- Ожидание: пустой результат (нет дублей).
