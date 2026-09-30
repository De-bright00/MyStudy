-- SUPABASE CASCADE DELETE FIX SCRIPT
-- Execute this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- This ensures that deleting concepts, materials, or subjects automatically cleans up all associated
-- questions, attempts, mastery records, and study plan items without foreign key constraint errors.

-- 1. Ensure questions cascade delete when concepts are deleted
ALTER TABLE IF EXISTS public.questions 
  DROP CONSTRAINT IF EXISTS questions_concept_id_fkey;

ALTER TABLE IF EXISTS public.questions 
  ADD CONSTRAINT questions_concept_id_fkey 
  FOREIGN KEY (concept_id) 
  REFERENCES public.concepts(id) 
  ON DELETE CASCADE;

-- 2. Ensure attempts cascade delete when questions are deleted
ALTER TABLE IF EXISTS public.attempts 
  DROP CONSTRAINT IF EXISTS attempts_question_id_fkey;

ALTER TABLE IF EXISTS public.attempts 
  ADD CONSTRAINT attempts_question_id_fkey 
  FOREIGN KEY (question_id) 
  REFERENCES public.questions(id) 
  ON DELETE CASCADE;

-- 3. Ensure test student attempts cascade delete when questions are deleted
ALTER TABLE IF EXISTS public.test_student_attempts 
  DROP CONSTRAINT IF EXISTS test_student_attempts_question_id_fkey;

ALTER TABLE IF EXISTS public.test_student_attempts 
  ADD CONSTRAINT test_student_attempts_question_id_fkey 
  FOREIGN KEY (question_id) 
  REFERENCES public.questions(id) 
  ON DELETE CASCADE;

-- 4. Ensure mastery records cascade delete when concepts are deleted
ALTER TABLE IF EXISTS public.mastery 
  DROP CONSTRAINT IF EXISTS mastery_concept_id_fkey;

ALTER TABLE IF EXISTS public.mastery 
  ADD CONSTRAINT mastery_concept_id_fkey 
  FOREIGN KEY (concept_id) 
  REFERENCES public.concepts(id) 
  ON DELETE CASCADE;

-- 5. Ensure study plan items cascade delete when concepts are deleted
ALTER TABLE IF EXISTS public.study_plan_items 
  DROP CONSTRAINT IF EXISTS study_plan_items_concept_id_fkey;

ALTER TABLE IF EXISTS public.study_plan_items 
  ADD CONSTRAINT study_plan_items_concept_id_fkey 
  FOREIGN KEY (concept_id) 
  REFERENCES public.concepts(id) 
  ON DELETE CASCADE;

-- 6. Ensure concepts cascade delete when materials or subjects are deleted
ALTER TABLE IF EXISTS public.concepts 
  DROP CONSTRAINT IF EXISTS concepts_material_id_fkey;

ALTER TABLE IF EXISTS public.concepts 
  ADD CONSTRAINT concepts_material_id_fkey 
  FOREIGN KEY (material_id) 
  REFERENCES public.materials(id) 
  ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.concepts 
  DROP CONSTRAINT IF EXISTS concepts_subject_id_fkey;

ALTER TABLE IF EXISTS public.concepts 
  ADD CONSTRAINT concepts_subject_id_fkey 
  FOREIGN KEY (subject_id) 
  REFERENCES public.subjects(id) 
  ON DELETE CASCADE;

-- 7. Ensure materials cascade delete when subjects are deleted
ALTER TABLE IF EXISTS public.materials 
  DROP CONSTRAINT IF EXISTS materials_subject_id_fkey;

ALTER TABLE IF EXISTS public.materials 
  ADD CONSTRAINT materials_subject_id_fkey 
  FOREIGN KEY (subject_id) 
  REFERENCES public.subjects(id) 
  ON DELETE CASCADE;
