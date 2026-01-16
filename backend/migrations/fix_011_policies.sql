-- Fix for Migration 011: Drop and recreate RLS policies, triggers, and functions
-- Run this if you get "already exists" errors

-- ============================================================================
-- STEP 1: Drop existing triggers
-- ============================================================================

DROP TRIGGER IF EXISTS update_shareable_urls_updated_at ON shareable_urls;
DROP TRIGGER IF EXISTS update_simulation_results_updated_at ON simulation_results;
DROP TRIGGER IF EXISTS update_scenario_analyses_updated_at ON scenario_analyses;
DROP TRIGGER IF EXISTS update_change_requests_updated_at ON change_requests;
DROP TRIGGER IF EXISTS update_po_breakdowns_updated_at ON po_breakdowns;
DROP TRIGGER IF EXISTS update_report_templates_updated_at ON report_templates;
DROP TRIGGER IF EXISTS generate_change_request_number_trigger ON change_requests;
DROP TRIGGER IF EXISTS update_parent_po_amounts_trigger ON po_breakdowns;

-- ============================================================================
-- STEP 2: Drop existing functions (CASCADE will drop dependent triggers)
-- ============================================================================

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS generate_change_request_number() CASCADE;
DROP FUNCTION IF EXISTS update_parent_po_amounts() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_shareable_urls() CASCADE;
DROP FUNCTION IF EXISTS get_project_simulation_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_change_request_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_po_breakdown_hierarchy(UUID) CASCADE;

-- ============================================================================
-- STEP 3: Drop existing RLS policies
-- ============================================================================

-- Drop shareable_urls policies
DROP POLICY IF EXISTS "Users can view shareable URLs for projects they have access to" ON shareable_urls;
DROP POLICY IF EXISTS "Users can create shareable URLs for projects they manage" ON shareable_urls;
DROP POLICY IF EXISTS "Users can update their own shareable URLs" ON shareable_urls;

-- Drop simulation_results policies
DROP POLICY IF EXISTS "Users can view simulation results for accessible projects" ON simulation_results;
DROP POLICY IF EXISTS "Users can create simulation results for accessible projects" ON simulation_results;

-- Drop scenario_analyses policies
DROP POLICY IF EXISTS "Users can view scenario analyses for accessible projects" ON scenario_analyses;
DROP POLICY IF EXISTS "Users can manage scenario analyses for accessible projects" ON scenario_analyses;

-- Drop change_requests policies
DROP POLICY IF EXISTS "Users can view change requests for accessible projects" ON change_requests;
DROP POLICY IF EXISTS "Users can create change requests for accessible projects" ON change_requests;
DROP POLICY IF EXISTS "Users can update change requests they created or are assigned to" ON change_requests;

-- Drop po_breakdowns policies
DROP POLICY IF EXISTS "Users can view PO breakdowns for accessible projects" ON po_breakdowns;
DROP POLICY IF EXISTS "Users can manage PO breakdowns for projects they manage" ON po_breakdowns;

-- Drop report_templates policies
DROP POLICY IF EXISTS "Users can view public templates or templates they created" ON report_templates;
DROP POLICY IF EXISTS "Users can create report templates" ON report_templates;
DROP POLICY IF EXISTS "Users can update templates they created" ON report_templates;

-- Drop generated_reports policies
DROP POLICY IF EXISTS "Users can view generated reports for accessible projects" ON generated_reports;
DROP POLICY IF EXISTS "Users can create reports for accessible projects" ON generated_reports;

-- ============================================================================
-- STEP 4: Verification
-- ============================================================================

-- Check that policies are dropped
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN (
        'shareable_urls', 'simulation_results', 'scenario_analyses',
        'change_requests', 'po_breakdowns', 'report_templates', 'generated_reports'
    );
    
    RAISE NOTICE 'Remaining policies on migration tables: %', policy_count;
END $$;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Cleanup complete! You can now re-run migration 011.';
    RAISE NOTICE 'Next step: Execute backend/migrations/011_roche_construction_ppm_features.sql';
END $$;
