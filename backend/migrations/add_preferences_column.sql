-- Add preferences column to user_profiles table
-- This column stores user preferences including language settings

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- Add index for better query performance on preferences
CREATE INDEX IF NOT EXISTS idx_user_profiles_preferences ON user_profiles USING gin(preferences);

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.preferences IS 'User preferences stored as JSONB (language, theme, notifications, etc.)';
