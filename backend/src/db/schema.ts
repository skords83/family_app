export const schema = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '👤',
  photo TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  pin TEXT,
  role TEXT NOT NULL CHECK (role IN ('child', 'parent')),
  birthdate DATE
);
-- Add photo column if it doesn't exist yet (safe migration)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='users' AND column_name='photo'
  ) THEN
    ALTER TABLE users ADD COLUMN photo TEXT;
  END IF;
END $$;
-- Add birthdate column if it doesn't exist yet (safe migration)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='users' AND column_name='birthdate'
  ) THEN
    ALTER TABLE users ADD COLUMN birthdate DATE;
  END IF;
END $$;
-- Migrate task_templates.assigned_to from UUID → JSONB (safe)
-- Uses variable to avoid EXECUTE NULL when no constraint exists
DO $$ DECLARE
  v_fk TEXT;
  v_ck TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='task_templates' AND column_name='assigned_to'
      AND data_type = 'uuid'
  ) THEN
    -- Drop FK constraint if present
    SELECT conname INTO v_fk
    FROM pg_constraint
    WHERE conrelid = 'task_templates'::regclass
      AND contype = 'f'
      AND conname LIKE '%assigned_to%'
    LIMIT 1;
    IF v_fk IS NOT NULL THEN
      EXECUTE 'ALTER TABLE task_templates DROP CONSTRAINT ' || quote_ident(v_fk);
    END IF;
    -- Drop recurrence CHECK constraint if present
    SELECT conname INTO v_ck
    FROM pg_constraint
    WHERE conrelid = 'task_templates'::regclass
      AND contype = 'c'
      AND conname LIKE '%recurrence%'
    LIMIT 1;
    IF v_ck IS NOT NULL THEN
      EXECUTE 'ALTER TABLE task_templates DROP CONSTRAINT ' || quote_ident(v_ck);
    END IF;
    -- Convert UUID column to JSONB array
    ALTER TABLE task_templates
      ALTER COLUMN assigned_to TYPE JSONB
      USING CASE
        WHEN assigned_to IS NULL THEN NULL
        ELSE jsonb_build_array(assigned_to::text)
      END;
  END IF;
END $$;
-- Drop recurrence CHECK constraint on fresh installs where assigned_to is already JSONB
-- (covers case where table was created with old definition before this migration ran)
DO $$ DECLARE
  v_ck TEXT;
BEGIN
  SELECT conname INTO v_ck
  FROM pg_constraint
  WHERE conrelid = 'task_templates'::regclass
    AND contype = 'c'
    AND conname LIKE '%recurrence%'
  LIMIT 1;
  IF v_ck IS NOT NULL THEN
    EXECUTE 'ALTER TABLE task_templates DROP CONSTRAINT ' || quote_ident(v_ck);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 1,
  assigned_to JSONB,
  recurrence TEXT NOT NULL,
  due_time TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  icon TEXT,
  category TEXT,
  due_date DATE,
  valid_from DATE,
  valid_until DATE,
  rotation BOOLEAN NOT NULL DEFAULT false,
  available_from TEXT
);
-- Add requires_approval column if it doesn't exist yet (safe migration)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='task_templates' AND column_name='requires_approval'
  ) THEN
    ALTER TABLE task_templates ADD COLUMN requires_approval BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
-- Add icon column (safe migration)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='task_templates' AND column_name='icon'
  ) THEN
    ALTER TABLE task_templates ADD COLUMN icon TEXT;
  END IF;
END $$;
-- Add category column (safe migration)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='task_templates' AND column_name='category'
  ) THEN
    ALTER TABLE task_templates ADD COLUMN category TEXT;
  END IF;
END $$;
-- Add due_date column (safe migration) — concrete date for one-off tasks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='task_templates' AND column_name='due_date'
  ) THEN
    ALTER TABLE task_templates ADD COLUMN due_date DATE;
  END IF;
END $$;
-- Add valid_from / valid_until columns (safe migration) — date range for recurring tasks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='task_templates' AND column_name='valid_from'
  ) THEN
    ALTER TABLE task_templates ADD COLUMN valid_from DATE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='task_templates' AND column_name='valid_until'
  ) THEN
    ALTER TABLE task_templates ADD COLUMN valid_until DATE;
  END IF;
END $$;
-- Add rotation column (safe migration) — fair round-robin assignment
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='task_templates' AND column_name='rotation'
  ) THEN
    ALTER TABLE task_templates ADD COLUMN rotation BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
-- Add available_from column (safe migration) — time-of-day gate for visibility/abhakbarkeit
-- Format: 'HH:MM' (24h). NULL = ganztägig verfügbar.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='task_templates' AND column_name='available_from'
  ) THEN
    ALTER TABLE task_templates ADD COLUMN available_from TEXT;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS task_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES task_templates(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id)
);
-- Add approved_at / approved_by columns if they don't exist yet (safe migration)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='task_instances' AND column_name='approved_at'
  ) THEN
    ALTER TABLE task_instances ADD COLUMN approved_at TIMESTAMPTZ;
    ALTER TABLE task_instances ADD COLUMN approved_by UUID REFERENCES users(id);
  END IF;
END $$;
-- Index for rotation queries: COUNT(*) per (template_id, assigned_to)
CREATE INDEX IF NOT EXISTS idx_task_instances_template_assigned
  ON task_instances (template_id, assigned_to);
CREATE TABLE IF NOT EXISTS point_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Migrate rewards.available_to from UUID → UUID[] (safe)
DO $$ DECLARE
  v_fk TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='rewards' AND column_name='available_to'
      AND data_type = 'uuid'
  ) THEN
    -- Drop FK constraint if present
    SELECT conname INTO v_fk
    FROM pg_constraint
    WHERE conrelid = 'rewards'::regclass
      AND contype = 'f'
      AND conname LIKE '%available_to%'
    LIMIT 1;
    IF v_fk IS NOT NULL THEN
      EXECUTE 'ALTER TABLE rewards DROP CONSTRAINT ' || quote_ident(v_fk);
    END IF;
    -- Convert UUID column to UUID[]
    ALTER TABLE rewards
      ALTER COLUMN available_to TYPE UUID[]
      USING CASE
        WHEN available_to IS NULL THEN NULL
        ELSE ARRAY[available_to]
      END;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  points_cost INTEGER NOT NULL,
  available_to UUID[],
  active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  reject_reason TEXT,
  points_spent INTEGER
);
-- Add rejected_at column if it doesn't exist yet (safe migration)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reward_claims' AND column_name='rejected_at'
  ) THEN
    ALTER TABLE reward_claims ADD COLUMN rejected_at TIMESTAMPTZ;
  END IF;
END $$;
-- Add reject_reason column if it doesn't exist yet (safe migration)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reward_claims' AND column_name='reject_reason'
  ) THEN
    ALTER TABLE reward_claims ADD COLUMN reject_reason TEXT;
  END IF;
END $$;
-- Add points_spent column if it doesn't exist yet (safe migration)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reward_claims' AND column_name='points_spent'
  ) THEN
    ALTER TABLE reward_claims ADD COLUMN points_spent INTEGER;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS calendar_cache (
  id SERIAL PRIMARY KEY,
  source_url TEXT NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS widget_config (
  id SERIAL PRIMARY KEY,
  widgets JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS widget_cache (
  id SERIAL PRIMARY KEY,
  widget_type TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS external_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  raw_data JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, date, type)
);
CREATE INDEX IF NOT EXISTS idx_external_events_source_date
  ON external_events (source, date);
-- Stundenplan: ein JSONB-Blob pro Kind (key: "Mo_0", value: { name, bg, fg })
CREATE TABLE IF NOT EXISTS timetables (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Globale Fachfarben: einmal festgelegt, gelten für alle Stundenpläne
CREATE TABLE IF NOT EXISTS timetable_subject_colors (
  subject    TEXT PRIMARY KEY,
  bg         TEXT NOT NULL,
  fg         TEXT NOT NULL
);
-- NFC UID für User (safe migration)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='users' AND column_name='nfc_uid'
  ) THEN
    ALTER TABLE users ADD COLUMN nfc_uid TEXT UNIQUE;
  END IF;
END $$;
-- Add requires_approval / rejected_at / reject_reason to task_instances (safe migration)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='task_instances' AND column_name='requires_approval'
  ) THEN
    ALTER TABLE task_instances ADD COLUMN requires_approval BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='task_instances' AND column_name='rejected_at'
  ) THEN
    ALTER TABLE task_instances ADD COLUMN rejected_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='task_instances' AND column_name='reject_reason'
  ) THEN
    ALTER TABLE task_instances ADD COLUMN reject_reason TEXT;
  END IF;
END $$;
-- Geburtstage von Personen ohne User-Account (CardDAV-Sync + manuelle Eintraege).
-- Familienmitglieder-Geburtstage kommen direkt aus users.birthdate, keine Duplizierung hier.
CREATE TABLE IF NOT EXISTS birthdays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  birth_month SMALLINT NOT NULL CHECK (birth_month BETWEEN 1 AND 12),
  birth_day SMALLINT NOT NULL CHECK (birth_day BETWEEN 1 AND 31),
  birth_year SMALLINT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'carddav')),
  external_uid TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  fetched_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS birthdays_source_uid_uq
  ON birthdays (source, external_uid) WHERE external_uid IS NOT NULL;
`;