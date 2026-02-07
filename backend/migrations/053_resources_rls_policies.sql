-- Migration 053: RLS policies for table "resources"
-- The backend enforces resource_* permissions; DB access uses anon or service_role key.
-- Without permissive policies, INSERT fails with 42501 when RLS is enabled on resources.

-- Ensure RLS is enabled (no-op if already on)
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (by name), then create consistent ones
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'resources' AND policyname = 'resources_select') THEN
    DROP POLICY "resources_select" ON public.resources;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'resources' AND policyname = 'resources_insert') THEN
    DROP POLICY "resources_insert" ON public.resources;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'resources' AND policyname = 'resources_update') THEN
    DROP POLICY "resources_update" ON public.resources;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'resources' AND policyname = 'resources_delete') THEN
    DROP POLICY "resources_delete" ON public.resources;
  END IF;
END $$;

-- Allow SELECT (backend list/get/search/utilization)
CREATE POLICY "resources_select" ON public.resources
  FOR SELECT USING (true);

-- Allow INSERT (backend create; permission enforced by API)
CREATE POLICY "resources_insert" ON public.resources
  FOR INSERT WITH CHECK (true);

-- Allow UPDATE (backend update)
CREATE POLICY "resources_update" ON public.resources
  FOR UPDATE USING (true) WITH CHECK (true);

-- Allow DELETE (backend delete)
CREATE POLICY "resources_delete" ON public.resources
  FOR DELETE USING (true);

COMMENT ON POLICY "resources_select" ON public.resources IS 'Backend enforces resource_read; RLS allows anon/service_role to read';
COMMENT ON POLICY "resources_insert" ON public.resources IS 'Backend enforces resource_create; RLS allows anon/service_role to insert';
