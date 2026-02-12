-- Migration 076: Fix "type ltree does not exist" during project import
-- The ltree extension may be in schema 'extensions' (after 075) or 'public'.
-- Trigger functions must have search_path including both so ltree resolves.
-- Idempotent: safe to run multiple times.

-- 1. Ensure extensions schema exists (075 may have created it)
CREATE SCHEMA IF NOT EXISTS extensions;

-- 2. Ensure ltree extension exists (no-op if already created by 064/058)
CREATE EXTENSION IF NOT EXISTS ltree;

-- 3. Recreate path trigger functions with search_path = public, extensions
--    so ltree type resolves regardless of which schema contains the extension

CREATE OR REPLACE FUNCTION set_portfolio_path()
RETURNS TRIGGER AS $$
BEGIN
    NEW.path := ('p.' || replace(NEW.id::text, '-', '_'))::ltree;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION set_program_path()
RETURNS TRIGGER AS $$
DECLARE
    p_path ltree;
BEGIN
    SELECT path INTO p_path FROM portfolios WHERE id = NEW.portfolio_id;
    IF p_path IS NULL THEN
        p_path := ('p.' || replace(NEW.portfolio_id::text, '-', '_'))::ltree;
    END IF;
    NEW.path := p_path || ('g.' || replace(NEW.id::text, '-', '_'))::ltree;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION set_project_path()
RETURNS TRIGGER AS $$
DECLARE
    base_path ltree;
BEGIN
    IF NEW.program_id IS NOT NULL THEN
        SELECT path INTO base_path FROM programs WHERE id = NEW.program_id;
    END IF;
    IF base_path IS NULL AND NEW.portfolio_id IS NOT NULL THEN
        base_path := (SELECT path FROM portfolios WHERE id = NEW.portfolio_id);
    END IF;
    IF base_path IS NULL THEN
        base_path := ('p.' || replace(COALESCE(NEW.portfolio_id, NEW.id)::text, '-', '_'))::ltree;
    END IF;
    NEW.path := base_path || ('j.' || replace(NEW.id::text, '-', '_'))::ltree;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, extensions;

COMMENT ON FUNCTION set_project_path() IS 'Set projects.path from program/portfolio. search_path includes extensions for ltree.';
