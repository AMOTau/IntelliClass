CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('admin', 'teacher', 'learner', 'parent')),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  grade_level text,
  academic_year integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, academic_year)
);

CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS class_subject_teachers (
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, subject_id, teacher_id)
);

CREATE TABLE IF NOT EXISTS class_learners (
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, learner_id)
);

CREATE TABLE IF NOT EXISTS parent_learners (
  parent_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_id, learner_id)
);

CREATE TABLE IF NOT EXISTS materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  subject text,
  class_name text,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES classes(id) ON DELETE SET NULL;

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid REFERENCES materials(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS class_id uuid;

ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS subject_id uuid;

ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS material_id uuid;

ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE quizzes
  ALTER COLUMN title SET NOT NULL;

ALTER TABLE quizzes
  ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE quizzes
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE quizzes
  ALTER COLUMN updated_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quizzes_class_id_fkey'
  ) THEN
    ALTER TABLE quizzes
      ADD CONSTRAINT quizzes_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quizzes_subject_id_fkey'
  ) THEN
    ALTER TABLE quizzes
      ADD CONSTRAINT quizzes_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quizzes_material_id_fkey'
  ) THEN
    ALTER TABLE quizzes
      ADD CONSTRAINT quizzes_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quizzes_created_by_fkey'
  ) THEN
    ALTER TABLE quizzes
      ADD CONSTRAINT quizzes_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  options jsonb NOT NULL,
  correct_answer text NOT NULL,
  explanation text,
  difficulty text,
  topic text,
  question_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS topic text;

CREATE TABLE IF NOT EXISTS homework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  subject text,
  class_name text,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id uuid NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'not_submitted', 'late')),
  score numeric(5, 2),
  feedback text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (homework_id, learner_id)
);

CREATE TABLE IF NOT EXISTS quiz_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers jsonb NOT NULL,
  total_questions integer NOT NULL,
  correct_count integer NOT NULL,
  score numeric(5, 2) NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, learner_id)
);

ALTER TABLE quiz_submissions
  ADD COLUMN IF NOT EXISTS answers jsonb;

ALTER TABLE quiz_submissions
  ADD COLUMN IF NOT EXISTS total_questions integer;

ALTER TABLE quiz_submissions
  ADD COLUMN IF NOT EXISTS correct_count integer;

ALTER TABLE quiz_submissions
  ADD COLUMN IF NOT EXISTS score numeric(5, 2);

ALTER TABLE quiz_submissions
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

ALTER TABLE quiz_submissions
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE quiz_submissions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

CREATE TABLE IF NOT EXISTS quiz_explanations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  explanation text NOT NULL,
  study_suggestion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, question_id, learner_id)
);

CREATE INDEX IF NOT EXISTS idx_materials_teacher_id ON materials (teacher_id);
CREATE INDEX IF NOT EXISTS idx_materials_class_id ON materials (class_id);
CREATE INDEX IF NOT EXISTS idx_quiz_explanations_learner_id ON quiz_explanations (learner_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_by ON quizzes (created_by);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions (quiz_id);
CREATE INDEX IF NOT EXISTS idx_homework_teacher_id ON homework (teacher_id);
CREATE INDEX IF NOT EXISTS idx_submissions_homework_id ON submissions (homework_id);
CREATE INDEX IF NOT EXISTS idx_submissions_learner_id ON submissions (learner_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_by ON quizzes (created_by);
CREATE INDEX IF NOT EXISTS idx_quizzes_class_id ON quizzes (class_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_quiz_id ON quiz_submissions (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_learner_id ON quiz_submissions (learner_id);
CREATE INDEX IF NOT EXISTS idx_class_subject_teachers_teacher_id ON class_subject_teachers (teacher_id);
CREATE INDEX IF NOT EXISTS idx_parent_learners_learner_id ON parent_learners (learner_id);
