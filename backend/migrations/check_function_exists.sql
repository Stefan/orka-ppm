-- Helper function to check if a PostgreSQL function exists
-- This function can be called via Supabase RPC to check function existence

CREATE OR REPLACE FUNCTION check_function_exists(func_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = func_name
        AND n.nspname = 'public'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;