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
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='task_templates' AND column_name='assigned_to'
      AND data_type = 'uuid'
  ) THEN
    -- Drop FK constraint first (name may vary, use dynamic lookup)
    EXECUTE (
      SELECT 'ALTER TABLE task_templates DROP CONSTRAINT ' || conname
      FROM pg_constraint
      WHERE conrelid = 'task_templates'::regclass
        AND contype = 'f'
        AND conname LIKE '%assigned_to%'
      LIMIT 1
    );
    ALTER TABLE task_templates
      ALTER COLUMN assigned_to TYPE JSONB
      USING CASE
        WHEN assigned_to IS NULL THEN NULL
        ELSE jsonb_build_array(assigned_to::text)
      END;
  END IF;
END $$;

-- Remove old recurrence CHECK constraint if it still exists (safe)
DO $$ BEGIN
  EXECUTE (
    SELECT 'ALTER TABLE task_templates DROP CONSTRAINT ' || conname
    FROM pg_constraint
    WHERE conrelid = 'task_templates'::regclass
      AND contype = 'c'
      AND conname LIKE '%recurrence%'
    LIMIT 1
  );
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 1,
  assigned_to JSONB,
  recurrence TEXT NOT NULL,
  due_time TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS task_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES task_templates(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS point_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  points_cost INTEGER NOT NULL,
  available_to UUID REFERENCES users(id) ON DELETE SET NULL,
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