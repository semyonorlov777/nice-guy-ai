ALTER TABLE programs
  ADD COLUMN category text NOT NULL DEFAULT 'psychology';

UPDATE programs
SET category = 'marketing'
WHERE slug IN ('pishi-sokraschay', 'heroes-and-outlaws', 'borba-za-vnimanie');

COMMENT ON COLUMN programs.category IS
  'High-level genre. Allowed values today: ''psychology'', ''marketing''. Stored as text (not enum) for cheap future additions.';
