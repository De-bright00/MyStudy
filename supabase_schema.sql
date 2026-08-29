-- SUPABASE DATABASE SCHEMA DDL
-- Paste this script into the Supabase SQL Editor to initialize all tables and policies.

-- 1. Create tables

-- Subjects the student is studying
create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  created_at timestamptz default now()
);

-- Source material the student submitted (notes, pasted text, or a topic with no material)
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references subjects not null,
  title text not null,
  raw_text text, -- extracted/pasted text
  source_type text check (source_type in ('upload','paste','topic_only')),
  created_at timestamptz default now()
);

-- Concepts extracted from material — the unit that mastery is tracked against
create table if not exists concepts (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references materials not null,
  subject_id uuid references subjects not null,
  name text not null,
  summary text, -- AI-generated concise summary
  simple_explanation text, -- AI-generated "explain simpler" version
  created_at timestamptz default now()
);

-- Generated practice questions, tagged to a concept and a difficulty
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid references concepts not null,
  question_type text check (question_type in ('mcq','short_answer','flashcard')),
  prompt text not null,
  options jsonb, -- for mcq, e.g. ["Option A", "Option B", ...]
  correct_answer text not null,
  difficulty int check (difficulty between 1 and 5) not null,
  created_at timestamptz default now()
);

-- Each attempt a student makes, plus the AI's feedback
create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions not null,
  user_id uuid references auth.users not null,
  student_answer text not null,
  is_correct boolean not null,
  ai_feedback text not null,
  answered_at timestamptz default now()
);

-- Rolling mastery score per concept per student — this is what the whole app reacts to
create table if not exists mastery (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid references concepts not null,
  user_id uuid references auth.users not null,
  score numeric default 50, -- 0-100, starts neutral
  last_updated timestamptz default now(),
  unique (concept_id, user_id)
);

-- Generated study plan entries
create table if not exists study_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  concept_id uuid references concepts not null,
  priority int not null, -- lower = more urgent
  suggested_minutes int not null,
  planned_date date,
  completed boolean default false
);

-- 2. Enable Row Level Security (RLS) on all tables

alter table subjects enable row level security;
alter table materials enable row level security;
alter table concepts enable row level security;
alter table questions enable row level security;
alter table attempts enable row level security;
alter table mastery enable row level security;
alter table study_plan_items enable row level security;

-- 3. Create RLS Policies

-- Subjects: Owner has full access
create policy "Users can manage their own subjects"
  on subjects for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Materials: Access allowed if user owns the subject
create policy "Users can manage materials in their subjects"
  on materials for all
  to authenticated
  using (
    exists (
      select 1 from subjects 
      where subjects.id = materials.subject_id 
      and subjects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from subjects 
      where subjects.id = materials.subject_id 
      and subjects.user_id = auth.uid()
    )
  );

-- Concepts: Access allowed if user owns the subject
create policy "Users can manage concepts in their subjects"
  on concepts for all
  to authenticated
  using (
    exists (
      select 1 from subjects 
      where subjects.id = concepts.subject_id 
      and subjects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from subjects 
      where subjects.id = concepts.subject_id 
      and subjects.user_id = auth.uid()
    )
  );

-- Questions: Access allowed if concept's subject is owned by user
create policy "Users can manage questions under their concepts"
  on questions for all
  to authenticated
  using (
    exists (
      select 1 from concepts
      join subjects on concepts.subject_id = subjects.id
      where concepts.id = questions.concept_id
      and subjects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from concepts
      join subjects on concepts.subject_id = subjects.id
      where concepts.id = questions.concept_id
      and subjects.user_id = auth.uid()
    )
  );

-- Attempts: Owner has full access
create policy "Users can manage their own attempts"
  on attempts for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Mastery: Owner has full access
create policy "Users can manage their own mastery"
  on mastery for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Study Plan Items: Owner has full access
create policy "Users can manage their own study plan items"
  on study_plan_items for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
