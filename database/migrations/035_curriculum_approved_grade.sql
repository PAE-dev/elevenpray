-- Nota con la que se aprobó un curso de la malla (opcional)
ALTER TABLE curriculum_courses
  ADD COLUMN IF NOT EXISTS approved_grade TEXT;
