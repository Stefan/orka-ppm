-- Migration 062: Link register entries to schedule tasks (optional).
-- Enables "risks/issues linked to this task" from schedule view.
-- If public.tasks does not exist (schedule migration not applied), add column without FK.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tasks'
  ) THEN
    ALTER TABLE registers
      ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
  ELSE
    ALTER TABLE registers
      ADD COLUMN IF NOT EXISTS task_id UUID;
  END IF;
END $$;

COMMENT ON COLUMN registers.task_id IS 'Optional link to a schedule task (e.g. risk tied to a specific task)';

CREATE INDEX IF NOT EXISTS idx_registers_task_id ON registers(task_id) WHERE task_id IS NOT NULL;
