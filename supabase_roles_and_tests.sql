-- SUPABASE ROLE-BASED ACCESS & TESTING SCHEMA DDL
-- Execute this script in your Supabase SQL Editor to support Teacher/Student roles and Tests.

-- 1. Create Profiles Table (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  role text check (role in ('teacher', 'student')) not null default 'student',
  institution text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- 2. Create Profile Sync Trigger on Signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Recreate trigger if exists
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Create Tests Table
create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users not null,
  title text not null,
  subject_id uuid references public.subjects on delete cascade not null,
  question_count int not null default 5 check (question_count > 0),
  disable_guidance boolean not null default false,
  code text not null unique check (length(code) = 6),
  created_at timestamptz default now()
);

alter table public.tests enable row level security;

-- 4. Create Test Students (Enrollment & Grades) Table
create table if not exists public.test_students (
  id uuid primary key default gen_random_uuid(),
  test_id uuid references public.tests on delete cascade not null,
  student_id uuid references auth.users on delete cascade not null,
  completed boolean not null default false,
  score numeric check (score between 0 and 100),
  started_at timestamptz default now(),
  completed_at timestamptz,
  unique (test_id, student_id)
);

alter table public.test_students enable row level security;

-- 5. Create Test Student Attempts Log
create table if not exists public.test_student_attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid references public.tests on delete cascade not null,
  student_id uuid references auth.users on delete cascade not null,
  question_id uuid references public.questions on delete cascade not null,
  student_answer text not null,
  is_correct boolean not null,
  ai_feedback text not null,
  answered_at timestamptz default now()
);

alter table public.test_student_attempts enable row level security;

-- 6. Row-Level Security Policies

-- Profiles Policies
create policy "Users can read all profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Tests Policies
create policy "Teachers can manage their own tests"
  on public.tests for all
  to authenticated
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

create policy "Students can view tests they are enrolled in or search by code"
  on public.tests for select
  to authenticated
  using (true); -- allowed to fetch test details via invitation code search

-- Test Students Policies
create policy "Teachers can view grades for their tests"
  on public.test_students for select
  to authenticated
  using (
    exists (
      select 1 from public.tests
      where tests.id = test_students.test_id
      and tests.teacher_id = auth.uid()
    )
  );

create policy "Students can join and manage their own test sessions"
  on public.test_students for all
  to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- Test Student Attempts Policies
create policy "Teachers can view student attempts for their tests"
  on public.test_student_attempts for select
  to authenticated
  using (
    exists (
      select 1 from public.tests
      where tests.id = test_student_attempts.test_id
      and tests.teacher_id = auth.uid()
    )
  );

create policy "Students can manage their own attempts"
  on public.test_student_attempts for all
  to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- 7. Student access to educational materials (Read-only SELECT)
drop policy if exists "Authenticated users can select subjects" on public.subjects;
create policy "Authenticated users can select subjects"
  on public.subjects for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can select materials" on public.materials;
create policy "Authenticated users can select materials"
  on public.materials for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can select concepts" on public.concepts;
create policy "Authenticated users can select concepts"
  on public.concepts for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can select questions" on public.questions;
create policy "Authenticated users can select questions"
  on public.questions for select
  to authenticated
  using (true);
