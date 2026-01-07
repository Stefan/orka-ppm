-- Fix for portfolios table missing owner_id column
-- Execute this in Supabase SQL Editor

-- Add owner_id column to portfolios table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portfolios' AND column_name = 'owner_id') THEN
        ALTER TABLE portfolios ADD COLUMN owner_id UUID REFERENCES auth.users(id);
        RAISE NOTICE 'Added owner_id column to portfolios table';
    ELSE
        RAISE NOTICE 'owner_id column already exists in portfolios table';
    END IF;
END $$;

-- Insert sample data for portfolios if none exist
INSERT INTO portfolios (id, name, description, owner_id) 
SELECT 
    '7608eb53-768e-4fa8-94f7-633c92b7a6ab'::UUID,
    'Default Portfolio',
    'Default portfolio for initial setup',
    NULL
WHERE NOT EXISTS (SELECT 1 FROM portfolios WHERE id = '7608eb53-768e-4fa8-94f7-633c92b7a6ab'::UUID);

-- Update existing projects to have the default portfolio_id if they don't have one
UPDATE projects SET portfolio_id = '7608eb53-768e-4fa8-94f7-633c92b7a6ab'::UUID WHERE portfolio_id IS NULL;

-- Verify the fix
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'portfolios' 
ORDER BY ordinal_position;