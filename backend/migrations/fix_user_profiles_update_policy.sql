-- Fix: Allow users to update their own profile preferences
-- This migration adds a policy to allow users to update their own user_profiles record

-- Drop the policy if it already exists
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

-- Create policy to allow users to update their own profile
-- Users can only update certain fields (preferences, last_login, etc.)
-- but not security-critical fields like role or is_active
CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id 
        AND role = (SELECT role FROM user_profiles WHERE user_id = auth.uid())
        AND is_active = (SELECT is_active FROM user_profiles WHERE user_id = auth.uid())
    );

-- Add comment for documentation
COMMENT ON POLICY "Users can update their own profile" ON user_profiles IS 
    'Allows users to update their own profile while preventing modification of role and is_active fields';
