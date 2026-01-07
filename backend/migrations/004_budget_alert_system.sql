-- Budget Alert System Migration
-- Execute this SQL in Supabase SQL Editor

-- Create budget_alert_rules table
CREATE TABLE IF NOT EXISTS budget_alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE, -- NULL means applies to all projects
    threshold_percentage DECIMAL(5,2) NOT NULL CHECK (threshold_percentage > 0 AND threshold_percentage <= 200),
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('warning', 'critical', 'overrun')),
    recipients JSONB NOT NULL DEFAULT '[]', -- Array of email addresses
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create budget_alerts table
CREATE TABLE IF NOT EXISTS budget_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('warning', 'critical', 'overrun')),
    threshold_percentage DECIMAL(5,2) NOT NULL,
    current_percentage DECIMAL(5,2) NOT NULL,
    budget_amount DECIMAL(12,2) NOT NULL,
    actual_cost DECIMAL(12,2) NOT NULL,
    variance DECIMAL(12,2) NOT NULL,
    message TEXT NOT NULL,
    recipients JSONB NOT NULL DEFAULT '[]',
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_budget_alert_rules_project_id ON budget_alert_rules(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_alert_rules_is_active ON budget_alert_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_budget_alert_rules_threshold ON budget_alert_rules(threshold_percentage);

CREATE INDEX IF NOT EXISTS idx_budget_alerts_project_id ON budget_alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_alert_type ON budget_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_is_resolved ON budget_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_created_at ON budget_alerts(created_at);

-- Create trigger for updated_at timestamp on budget_alert_rules
DO $
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_budget_alert_rules_updated_at') THEN
        CREATE TRIGGER update_budget_alert_rules_updated_at 
        BEFORE UPDATE ON budget_alert_rules 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $;

-- Enable Row Level Security
ALTER TABLE budget_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_alerts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for budget_alert_rules
DO $ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE LOWER(polname) = 'users can view budget_alert_rules' AND schemaname = 'public' AND tablename = 'budget_alert_rules') THEN
        CREATE POLICY "Users can view budget_alert_rules" ON public.budget_alert_rules FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE LOWER(polname) = 'users can insert budget_alert_rules' AND schemaname = 'public' AND tablename = 'budget_alert_rules') THEN
        CREATE POLICY "Users can insert budget_alert_rules" ON public.budget_alert_rules FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE LOWER(polname) = 'users can update budget_alert_rules' AND schemaname = 'public' AND tablename = 'budget_alert_rules') THEN
        CREATE POLICY "Users can update budget_alert_rules" ON public.budget_alert_rules FOR UPDATE USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE LOWER(polname) = 'users can delete budget_alert_rules' AND schemaname = 'public' AND tablename = 'budget_alert_rules') THEN
        CREATE POLICY "Users can delete budget_alert_rules" ON public.budget_alert_rules FOR DELETE USING (auth.role() = 'authenticated');
    END IF;
END $;

-- Create RLS policies for budget_alerts
DO $ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE LOWER(polname) = 'users can view budget_alerts' AND schemaname = 'public' AND tablename = 'budget_alerts') THEN
        CREATE POLICY "Users can view budget_alerts" ON public.budget_alerts FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE LOWER(polname) = 'users can insert budget_alerts' AND schemaname = 'public' AND tablename = 'budget_alerts') THEN
        CREATE POLICY "Users can insert budget_alerts" ON public.budget_alerts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE LOWER(polname) = 'users can update budget_alerts' AND schemaname = 'public' AND tablename = 'budget_alerts') THEN
        CREATE POLICY "Users can update budget_alerts" ON public.budget_alerts FOR UPDATE USING (auth.role() = 'authenticated');
    END IF;
END $;

-- Insert sample budget alert rules for demonstration
INSERT INTO budget_alert_rules (threshold_percentage, alert_type, recipients, is_active) 
VALUES 
    (80.0, 'warning', '["pm@company.com", "finance@company.com"]', true),
    (90.0, 'critical', '["pm@company.com", "finance@company.com", "cfo@company.com"]', true),
    (100.0, 'overrun', '["pm@company.com", "finance@company.com", "cfo@company.com", "ceo@company.com"]', true)
ON CONFLICT DO NOTHING;

-- Create a function to automatically check budget alerts when project costs are updated
CREATE OR REPLACE FUNCTION check_budget_alerts_on_cost_update()
RETURNS TRIGGER AS $
BEGIN
    -- This would trigger budget monitoring for the updated project
    -- In a real implementation, this could call a stored procedure or trigger an external process
    -- For now, we'll just log that a check should be performed
    RAISE NOTICE 'Budget alert check needed for project %', NEW.id;
    RETURN NEW;
END;
$ language 'plpgsql';

-- Create trigger to check budget alerts when project actual_cost is updated
DO $
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_budget_alert_check') THEN
        CREATE TRIGGER trigger_budget_alert_check
        AFTER UPDATE OF actual_cost ON projects
        FOR EACH ROW
        WHEN (OLD.actual_cost IS DISTINCT FROM NEW.actual_cost)
        EXECUTE FUNCTION check_budget_alerts_on_cost_update();
    END IF;
END $;