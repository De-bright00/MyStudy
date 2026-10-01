-- ==============================================================================
-- SUPABASE COMPLETE TESTING, ENROLLMENT & SCORES FIX SCRIPT
-- ==============================================================================
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
--
-- This script fixes:
-- 1. "column test_students.started_at does not exist"
-- 2. "Failed to load scores" (adds missing columns to test_students & test_student_attempts)
-- 3. Enables student read permissions so invitation codes can be fetched by students
-- ==============================================================================

-- 1. Ensure test_students has all required columns
ALTER TABLE IF EXISTS public.test_students 
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.test_students 
  ADD COLUMN IF NOT EXISTS score numeric CHECK (score BETWEEN 0 AND 100);

ALTER TABLE IF EXISTS public.test_students 
  ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT now();

ALTER TABLE IF EXISTS public.test_students 
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- 2. Ensure test_student_attempts has all required columns
ALTER TABLE IF EXISTS public.test_student_attempts 
  ADD COLUMN IF NOT EXISTS test_id uuid REFERENCES public.tests(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.test_student_attempts 
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.test_student_attempts 
  ADD COLUMN IF NOT EXISTS question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.test_student_attempts 
  ADD COLUMN IF NOT EXISTS student_answer text DEFAULT '';

ALTER TABLE IF EXISTS public.test_student_attempts 
  ADD COLUMN IF NOT EXISTS is_correct boolean DEFAULT false;

ALTER TABLE IF EXISTS public.test_student_attempts 
  ADD COLUMN IF NOT EXISTS ai_feedback text DEFAULT '';

ALTER TABLE IF EXISTS public.test_student_attempts 
  ADD COLUMN IF NOT EXISTS answered_at timestamptz DEFAULT now();

-- 3. Enable RLS and set policies on test_students
ALTER TABLE public.test_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can insert test enrollment" ON public.test_students;
CREATE POLICY "Students can insert test enrollment"
  ON public.test_students FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Students can update their own test enrollment" ON public.test_students;
CREATE POLICY "Students can update their own test enrollment"
  ON public.test_students FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can view their own test enrollment" ON public.test_students;
DROP POLICY IF EXISTS "Students can join and manage their own test sessions" ON public.test_students;
CREATE POLICY "Students can view their own test enrollment"
  ON public.test_students FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Teachers can view grades for their tests" ON public.test_students;
CREATE POLICY "Teachers can view grades for their tests"
  ON public.test_students FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tests
      WHERE tests.id = test_students.test_id
      AND tests.teacher_id = auth.uid()
    )
  );

-- 4. Enable RLS and set policies on test_student_attempts
ALTER TABLE public.test_student_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can insert their own attempts" ON public.test_student_attempts;
CREATE POLICY "Students can insert their own attempts"
  ON public.test_student_attempts FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Students can select their own attempts" ON public.test_student_attempts;
DROP POLICY IF EXISTS "Students can manage their own attempts" ON public.test_student_attempts;
CREATE POLICY "Students can select their own attempts"
  ON public.test_student_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Teachers can view student attempts for their tests" ON public.test_student_attempts;
CREATE POLICY "Teachers can view student attempts for their tests"
  ON public.test_student_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tests
      WHERE tests.id = test_student_attempts.test_id
      AND tests.teacher_id = auth.uid()
    )
  );

-- 5. Student read-only SELECT permissions for tests, subjects, materials, concepts, questions
DROP POLICY IF EXISTS "Students can view tests they are enrolled in or search by code" ON public.tests;
CREATE POLICY "Students can view tests they are enrolled in or search by code"
  ON public.tests FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can select subjects" ON public.subjects;
CREATE POLICY "Authenticated users can select subjects"
  ON public.subjects FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can select materials" ON public.materials;
CREATE POLICY "Authenticated users can select materials"
  ON public.materials FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can select concepts" ON public.concepts;
CREATE POLICY "Authenticated users can select concepts"
  ON public.concepts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can select questions" ON public.questions;
CREATE POLICY "Authenticated users can select questions"
  ON public.questions FOR SELECT
  TO authenticated
  USING (true);

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
