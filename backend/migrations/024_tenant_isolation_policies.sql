-- Migration: Tenant Isolation Row-Level Security Policies
-- Requirements: 9.1, 9.2, 9.3
-- Description: Implement row-level security policies to enforce tenant isolation
--              across all audit trail tables

-- ============================================================================
-- 1. Enable Row-Level Security on all audit tables
-- ============================================================================

ALTER TABLE roche_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_bias_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_ai_predictions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Create helper function to get current user's tenant_id
-- ============================================================================

-- This function retrieves the tenant_id from the current user's JWT claims
-- Adjust based on your authentication setup
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    -- Extract tenant_id from JWT claims
    -- This assumes tenant_id is stored in the JWT token
    RETURN COALESCE(
        (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid,
        (current_setting('app.current_tenant_id', true))::uuid
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. Row-Level Security Policies for roche_audit_logs
-- ============================================================================

-- Policy: Users can only SELECT audit logs from their own tenant
CREATE POLICY tenant_isolation_select_roche_audit_logs
    ON roche_audit_logs
    FOR SELECT
    USING (tenant_id = get_current_tenant_id() OR tenant_id IS NULL);

-- Policy: Users can only INSERT audit logs for their own tenant
CREATE POLICY tenant_isolation_insert_roche_audit_logs
    ON roche_audit_logs
    FOR INSERT
    WITH CHECK (tenant_id = get_current_tenant_id() OR tenant_id IS NULL);

-- Policy: Prevent UPDATE and DELETE operations (append-only requirement)
CREATE POLICY prevent_update_roche_audit_logs
    ON roche_audit_logs
    FOR UPDATE
    USING (false);

CREATE POLICY prevent_delete_roche_audit_logs
    ON roche_audit_logs
    FOR DELETE
    USING (false);

-- ============================================================================
-- 4. Row-Level Security Policies for audit_embeddings
-- ============================================================================

-- Policy: Users can only SELECT embeddings from their own tenant
CREATE POLICY tenant_isolation_select_audit_embeddings
    ON audit_embeddings
    FOR SELECT
    USING (tenant_id = get_current_tenant_id());

-- Policy: Users can only INSERT embeddings for their own tenant
CREATE POLICY tenant_isolation_insert_audit_embeddings
    ON audit_embeddings
    FOR INSERT
    WITH CHECK (tenant_id = get_current_tenant_id());

-- Policy: Users can UPDATE embeddings for their own tenant (for regeneration)
CREATE POLICY tenant_isolation_update_audit_embeddings
    ON audit_embeddings
    FOR UPDATE
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

-- Policy: Users can DELETE embeddings for their own tenant (for cleanup)
CREATE POLICY tenant_isolation_delete_audit_embeddings
    ON audit_embeddings
    FOR DELETE
    USING (tenant_id = get_current_tenant_id());

-- ============================================================================
-- 5. Row-Level Security Policies for audit_anomalies
-- ============================================================================

-- Policy: Users can only SELECT anomalies from their own tenant
CREATE POLICY tenant_isolation_select_audit_anomalies
    ON audit_anomalies
    FOR SELECT
    USING (tenant_id = get_current_tenant_id());

-- Policy: Users can only INSERT anomalies for their own tenant
CREATE POLICY tenant_isolation_insert_audit_anomalies
    ON audit_anomalies
    FOR INSERT
    WITH CHECK (tenant_id = get_current_tenant_id());

-- Policy: Users can UPDATE anomalies for their own tenant (for feedback)
CREATE POLICY tenant_isolation_update_audit_anomalies
    ON audit_anomalies
    FOR UPDATE
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

-- Policy: Prevent DELETE operations on anomalies
CREATE POLICY prevent_delete_audit_anomalies
    ON audit_anomalies
    FOR DELETE
    USING (false);

-- ============================================================================
-- 6. Row-Level Security Policies for audit_ml_models
-- ============================================================================

-- Policy: Users can SELECT shared models (tenant_id IS NULL) or their own tenant models
CREATE POLICY tenant_isolation_select_audit_ml_models
    ON audit_ml_models
    FOR SELECT
    USING (tenant_id IS NULL OR tenant_id = get_current_tenant_id());

-- Policy: Users can only INSERT models for their own tenant
CREATE POLICY tenant_isolation_insert_audit_ml_models
    ON audit_ml_models
    FOR INSERT
    WITH CHECK (tenant_id IS NULL OR tenant_id = get_current_tenant_id());

-- Policy: Users can UPDATE models for their own tenant
CREATE POLICY tenant_isolation_update_audit_ml_models
    ON audit_ml_models
    FOR UPDATE
    USING (tenant_id IS NULL OR tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id IS NULL OR tenant_id = get_current_tenant_id());

-- Policy: Users can DELETE models for their own tenant
CREATE POLICY tenant_isolation_delete_audit_ml_models
    ON audit_ml_models
    FOR DELETE
    USING (tenant_id = get_current_tenant_id());

-- ============================================================================
-- 7. Row-Level Security Policies for audit_integrations
-- ============================================================================

-- Policy: Users can only SELECT integrations from their own tenant
CREATE POLICY tenant_isolation_select_audit_integrations
    ON audit_integrations
    FOR SELECT
    USING (tenant_id = get_current_tenant_id());

-- Policy: Users can only INSERT integrations for their own tenant
CREATE POLICY tenant_isolation_insert_audit_integrations
    ON audit_integrations
    FOR INSERT
    WITH CHECK (tenant_id = get_current_tenant_id());

-- Policy: Users can UPDATE integrations for their own tenant
CREATE POLICY tenant_isolation_update_audit_integrations
    ON audit_integrations
    FOR UPDATE
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

-- Policy: Users can DELETE integrations for their own tenant
CREATE POLICY tenant_isolation_delete_audit_integrations
    ON audit_integrations
    FOR DELETE
    USING (tenant_id = get_current_tenant_id());

-- ============================================================================
-- 8. Row-Level Security Policies for audit_scheduled_reports
-- ============================================================================

-- Policy: Users can only SELECT scheduled reports from their own tenant
CREATE POLICY tenant_isolation_select_audit_scheduled_reports
    ON audit_scheduled_reports
    FOR SELECT
    USING (tenant_id = get_current_tenant_id());

-- Policy: Users can only INSERT scheduled reports for their own tenant
CREATE POLICY tenant_isolation_insert_audit_scheduled_reports
    ON audit_scheduled_reports
    FOR INSERT
    WITH CHECK (tenant_id = get_current_tenant_id());

-- Policy: Users can UPDATE scheduled reports for their own tenant
CREATE POLICY tenant_isolation_update_audit_scheduled_reports
    ON audit_scheduled_reports
    FOR UPDATE
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

-- Policy: Users can DELETE scheduled reports for their own tenant
CREATE POLICY tenant_isolation_delete_audit_scheduled_reports
    ON audit_scheduled_reports
    FOR DELETE
    USING (tenant_id = get_current_tenant_id());

-- ============================================================================
-- 9. Row-Level Security Policies for audit_access_log
-- ============================================================================

-- Policy: Users can only SELECT access logs from their own tenant
CREATE POLICY tenant_isolation_select_audit_access_log
    ON audit_access_log
    FOR SELECT
    USING (tenant_id = get_current_tenant_id());

-- Policy: Users can only INSERT access logs for their own tenant
CREATE POLICY tenant_isolation_insert_audit_access_log
    ON audit_access_log
    FOR INSERT
    WITH CHECK (tenant_id = get_current_tenant_id());

-- Policy: Prevent UPDATE and DELETE operations (append-only requirement)
CREATE POLICY prevent_update_audit_access_log
    ON audit_access_log
    FOR UPDATE
    USING (false);

CREATE POLICY prevent_delete_audit_access_log
    ON audit_access_log
    FOR DELETE
    USING (false);

-- ============================================================================
-- 10. Row-Level Security Policies for audit_bias_metrics
-- ============================================================================

-- Policy: Users can only SELECT bias metrics from their own tenant
CREATE POLICY tenant_isolation_select_audit_bias_metrics
    ON audit_bias_metrics
    FOR SELECT
    USING (tenant_id = get_current_tenant_id());

-- Policy: Users can only INSERT bias metrics for their own tenant
CREATE POLICY tenant_isolation_insert_audit_bias_metrics
    ON audit_bias_metrics
    FOR INSERT
    WITH CHECK (tenant_id = get_current_tenant_id());

-- Policy: Prevent UPDATE and DELETE operations
CREATE POLICY prevent_update_audit_bias_metrics
    ON audit_bias_metrics
    FOR UPDATE
    USING (false);

CREATE POLICY prevent_delete_audit_bias_metrics
    ON audit_bias_metrics
    FOR DELETE
    USING (false);

-- ============================================================================
-- 11. Row-Level Security Policies for audit_ai_predictions
-- ============================================================================

-- Policy: Users can only SELECT AI predictions from their own tenant
CREATE POLICY tenant_isolation_select_audit_ai_predictions
    ON audit_ai_predictions
    FOR SELECT
    USING (tenant_id = get_current_tenant_id());

-- Policy: Users can only INSERT AI predictions for their own tenant
CREATE POLICY tenant_isolation_insert_audit_ai_predictions
    ON audit_ai_predictions
    FOR INSERT
    WITH CHECK (tenant_id = get_current_tenant_id());

-- Policy: Users can UPDATE AI predictions for their own tenant (for review)
CREATE POLICY tenant_isolation_update_audit_ai_predictions
    ON audit_ai_predictions
    FOR UPDATE
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

-- Policy: Prevent DELETE operations
CREATE POLICY prevent_delete_audit_ai_predictions
    ON audit_ai_predictions
    FOR DELETE
    USING (false);

-- ============================================================================
-- 12. Create service role bypass policies (for background jobs)
-- ============================================================================

-- Allow service role to bypass RLS for background processing
-- This is needed for scheduled jobs, model training, etc.
-- Adjust role name based on your setup

-- Example: Grant bypass to service role
-- ALTER TABLE roche_audit_logs FORCE ROW LEVEL SECURITY;
-- GRANT USAGE ON SCHEMA public TO service_role;
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ============================================================================
-- 13. Add comments for documentation
-- ============================================================================

COMMENT ON FUNCTION get_current_tenant_id() IS 
    'Retrieves the current user tenant_id from JWT claims or session variable';

COMMENT ON POLICY tenant_isolation_select_roche_audit_logs ON roche_audit_logs IS 
    'Enforces tenant isolation: users can only SELECT audit logs from their own tenant';

COMMENT ON POLICY prevent_update_roche_audit_logs ON roche_audit_logs IS 
    'Enforces append-only requirement: prevents UPDATE operations on audit logs';

COMMENT ON POLICY prevent_delete_roche_audit_logs ON roche_audit_logs IS 
    'Enforces append-only requirement: prevents DELETE operations on audit logs';

-- ============================================================================
-- Migration complete
-- ============================================================================

-- Add migration tracking
INSERT INTO schema_migrations (version, description, applied_at)
VALUES (
    '024',
    'Tenant Isolation Row-Level Security Policies',
    NOW()
)
ON CONFLICT (version) DO NOTHING;
