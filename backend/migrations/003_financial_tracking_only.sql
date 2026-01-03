-- Financial Tracking Table Creation - Task 2.5 Specific Migration
-- This migration creates only the financial_tracking table and related components

-- Create currency_code enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE currency_code AS ENUM ('USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create financial_tracking table
CREATE TABLE IF NOT EXISTS financial_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    planned_amount DECIMAL(12,2) NOT NULL,
    actual_amount DECIMAL(12,2) DEFAULT 0,
    currency currency_code DEFAULT 'USD',
    exchange_rate DECIMAL(10,6) DEFAULT 1.0,
    date_incurred DATE NOT NULL,
    recorded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for financial_tracking table
CREATE INDEX IF NOT EXISTS idx_financial_tracking_project_id ON financial_tracking(project_id);
CREATE INDEX IF NOT EXISTS idx_financial_tracking_category ON financial_tracking(category);
CREATE INDEX IF NOT EXISTS idx_financial_tracking_date_incurred ON financial_tracking(date_incurred);
CREATE INDEX IF NOT EXISTS idx_financial_tracking_currency ON financial_tracking(currency);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$ language 'plpgsql';

-- Create trigger for updated_at timestamp on financial_tracking
DO $
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_financial_tracking_updated_at') THEN
        CREATE TRIGGER update_financial_tracking_updated_at 
        BEFORE UPDATE ON financial_tracking 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $;

-- Enable Row Level Security (RLS) on financial_tracking table
ALTER TABLE financial_tracking ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for financial_tracking
CREATE POLICY IF NOT EXISTS "Users can view financial_tracking" 
ON financial_tracking FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Users can insert financial_tracking" 
ON financial_tracking FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Users can update financial_tracking" 
ON financial_tracking FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Users can delete financial_tracking" 
ON financial_tracking FOR DELETE 
USING (auth.role() = 'authenticated');

-- Grant necessary permissions
GRANT ALL ON financial_tracking TO authenticated;
GRANT ALL ON financial_tracking TO service_role;

-- Add comment to table
COMMENT ON TABLE financial_tracking IS 'Financial tracking records with multi-currency support for project cost management';