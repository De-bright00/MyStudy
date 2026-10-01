-- ==============================================================================
-- SUPABASE TESTS TABLE FIX & QUESTION TYPE SCHEMA PATCH
-- ==============================================================================
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
--
-- This script fixes:
-- 1. "Could not find the 'title' column of 'tests' in the schema cache"
-- 2. Adds the 'question_type' column ('objective', 'theory', 'body', 'mixed')
-- 3. Ensures all foreign keys, defaults, and PostgREST schema cache are refreshed
-- ==============================================================================

-- 1. Ensure table public.tests exists
CREATE TABLE IF NOT EXISTS public.tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES auth.users NOT NULL,
  title text,
  subject_id uuid REFERENCES public.subjects ON DELETE CASCADE NOT NULL,
  question_count int NOT NULL DEFAULT 5 CHECK (question_count > 0),
  question_type text NOT NULL DEFAULT 'mixed' CHECK (question_type IN ('objective', 'theory', 'body', 'mixed')),
  disable_guidance boolean NOT NULL DEFAULT false,
  code text NOT NULL UNIQUE CHECK (length(code) = 6),
  created_at timestamptz DEFAULT now()
);

-- 2. Add title column if it was missing from an existing table
ALTER TABLE public.tests 
  ADD COLUMN IF NOT EXISTS title text;

-- 3. Add question_type column if it was missing
ALTER TABLE public.tests 
  ADD COLUMN IF NOT EXISTS question_type text DEFAULT 'mixed' 
  CHECK (question_type IN ('objective', 'theory', 'body', 'mixed'));

-- 4. Add disable_guidance column if missing
ALTER TABLE public.tests 
  ADD COLUMN IF NOT EXISTS disable_guidance boolean DEFAULT false;

-- 5. Add code column if missing
ALTER TABLE public.tests 
  ADD COLUMN IF NOT EXISTS code text;

-- 6. Populate any null titles from subject names or default
UPDATE public.tests 
SET title = coalesce(title, (SELECT name FROM public.subjects WHERE subjects.id = tests.subject_id), 'Assessment Test')
WHERE title IS NULL;

-- 7. Populate any null question_type
UPDATE public.tests 
SET question_type = 'mixed'
WHERE question_type IS NULL;

-- 8. Set NOT NULL constraints safely now that data is populated
ALTER TABLE public.tests 
  ALTER COLUMN title SET NOT NULL;

ALTER TABLE public.tests 
  ALTER COLUMN question_type SET NOT NULL;

-- 9. Ensure RLS is enabled and policies are active
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can manage their own tests" ON public.tests;
CREATE POLICY "Teachers can manage their own tests"
  ON public.tests FOR ALL
  TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Students can view tests they are enrolled in or search by code" ON public.tests;
CREATE POLICY "Students can view tests they are enrolled in or search by code"
  ON public.tests FOR SELECT
  TO authenticated
  USING (true);

-- 10. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
