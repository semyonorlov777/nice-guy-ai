-- Заполняет chapter_title для программы nice-guy
UPDATE exercises SET chapter_title = 'Синдром славного парня'
WHERE chapter = 1 AND program_id = (SELECT id FROM programs WHERE slug = 'nice-guy');

UPDATE exercises SET chapter_title = 'Формирование славного парня'
WHERE chapter = 2 AND program_id = (SELECT id FROM programs WHERE slug = 'nice-guy');

UPDATE exercises SET chapter_title = 'Учитесь радовать единственного важного человека'
WHERE chapter = 3 AND program_id = (SELECT id FROM programs WHERE slug = 'nice-guy');

UPDATE exercises SET chapter_title = 'Сделайте свои потребности приоритетом'
WHERE chapter = 4 AND program_id = (SELECT id FROM programs WHERE slug = 'nice-guy');

UPDATE exercises SET chapter_title = 'Верните себе свою силу'
WHERE chapter = 5 AND program_id = (SELECT id FROM programs WHERE slug = 'nice-guy');

UPDATE exercises SET chapter_title = 'Верните себе свою мужественность'
WHERE chapter = 6 AND program_id = (SELECT id FROM programs WHERE slug = 'nice-guy');

UPDATE exercises SET chapter_title = 'Постройте отношения, которые работают'
WHERE chapter = 7 AND program_id = (SELECT id FROM programs WHERE slug = 'nice-guy');

UPDATE exercises SET chapter_title = 'Получите тот секс, которого заслуживаете'
WHERE chapter = 8 AND program_id = (SELECT id FROM programs WHERE slug = 'nice-guy');

UPDATE exercises SET chapter_title = 'Станьте тем, кем хотите быть'
WHERE chapter = 9 AND program_id = (SELECT id FROM programs WHERE slug = 'nice-guy');
