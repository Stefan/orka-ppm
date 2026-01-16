-- Verification Query for Change Management Tables
-- Run this in Supabase SQL Editor to check which tables exist

SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM (
    VALUES 
        ('change_requests'),
        ('change_approvals'),
        ('change_audit_log'),
        ('change_templates'),
        ('change_impacts'),
        ('change_implementations'),
        ('change_notifications'),
        ('change_request_po_links'),
        ('workflow_instances')
) AS required_tables(table_name)
ORDER BY table_name;

-- Also check for any errors in table creation
SELECT 
    'Total change management tables' as metric,
    COUNT(*) as count
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'change_%';
