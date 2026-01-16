-- Migration 011: Roche Construction/Engineering PPM Features (Safe Version)
-- This version safely handles already-existing policies and objects

-- Drop existing policies if they exist (safe approach)
DO $$ 
BEGIN
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
EXCEPTION
    WHEN undefined_table THEN
        -- Tables don't exist yet, that's fine
        NULL;
    WHEN undefined_object THEN
        -- Policies don't exist, that's fine
        NULL;
END $$;

-- Now run the full migration from 011
-- This will create tables if they don't exist and recreate policies

