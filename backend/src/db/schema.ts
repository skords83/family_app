export const schema = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '👤',
  photo TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  pin TEXT,
  role TEXT NOT NULL CHECK (role IN ('child', 'parent'))
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
  requires_approval BOOLEAN NOT NULL DEFAULT false
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
  approved_at TIMESTAMPTZ
);

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
`;