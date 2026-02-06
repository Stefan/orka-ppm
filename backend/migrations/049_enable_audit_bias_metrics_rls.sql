-- Migration: Ensure RLS is enabled on public.audit_bias_metrics
-- Lint: "RLS Disabled in Public Entity: public.audit_bias_metrics"
-- Safe to run multiple times (idempotent). Ensures RLS and tenant-scoped policies exist.

-- 1. Enable RLS (no-op if already enabled)
ALTER TABLE public.audit_bias_metrics ENABLE ROW LEVEL SECURITY;

-- 2. Ensure helper exists (no-op if 024 already ran)
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid,
        (current_setting('app.current_tenant_id', true))::uuid
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Replace policies so this migration is idempotent
DROP POLICY IF EXISTS tenant_isolation_select_audit_bias_metrics ON public.audit_bias_metrics;
DROP POLICY IF EXISTS tenant_isolation_insert_audit_bias_metrics ON public.audit_bias_metrics;
DROP POLICY IF EXISTS prevent_update_audit_bias_metrics ON public.audit_bias_metrics;
DROP POLICY IF EXISTS prevent_delete_audit_bias_metrics ON public.audit_bias_metrics;

CREATE POLICY tenant_isolation_select_audit_bias_metrics
    ON public.audit_bias_metrics
    FOR SELECT
    TO authenticated
    USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_insert_audit_bias_metrics
    ON public.audit_bias_metrics
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY prevent_update_audit_bias_metrics
    ON public.audit_bias_metrics
    FOR UPDATE
    TO authenticated
    USING (false);

CREATE POLICY prevent_delete_audit_bias_metrics
    ON public.audit_bias_metrics
    FOR DELETE
    TO authenticated
    USING (false);

COMMENT ON TABLE public.audit_bias_metrics IS 'AI fairness metrics; RLS enabled, tenant-scoped SELECT/INSERT only';
