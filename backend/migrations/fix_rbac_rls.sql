-- Fix RLS policies for RBAC tables to prevent infinite recursion and allow proper access

-- Fix user_roles table policies
DROP POLICY IF EXISTS "Users can read own role assignments" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage role assignments" ON user_roles;

-- Simple policy: authenticated users can read their own roles
CREATE POLICY "Users can read own role assignments" ON user_roles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role full access on user_roles" ON user_roles
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role')
    WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Fix roles table policies
DROP POLICY IF EXISTS "Admins can manage roles" ON roles;
DROP POLICY IF EXISTS "Anyone can read roles" ON roles;

-- Everyone can read roles (they're not sensitive)
CREATE POLICY "Anyone can read roles" ON roles
    FOR SELECT
    TO authenticated
    USING (true);

-- Service role can manage roles
CREATE POLICY "Service role can manage roles" ON roles
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role')
    WITH CHECK (auth.jwt()->>'role' = 'service_role');
