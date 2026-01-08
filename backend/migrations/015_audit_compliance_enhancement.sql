-- Migration 015: Audit and Compliance System Enhancement
-- Comprehensive audit logging, compliance monitoring, and data retention

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enhanced audit log table with additional compliance fields
ALTER TABLE change_audit_log 
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20) DEFAULT 'low',
ADD COLUMN IF NOT EXISTS data_integrity_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS audit_trail_complete BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Create compliance frameworks reference table
CREATE TABLE IF NOT EXISTS compliance_frameworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    framework_code VARCHAR(50) UNIQUE NOT NULL,
    framework_name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50),
    effective_date DATE,
    requirements JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert standard compliance frameworks
INSERT INTO compliance_frameworks (framework_code, framework_name, description, version, effective_date, requirements) VALUES
('sox', 'Sarbanes-Oxley Act', 'Financial reporting and corporate governance compliance', '2002', '2002-07-30', '{"audit_trail": true, "data_retention_years": 7, "access_controls": true}'),
('iso_9001', 'ISO 9001 Quality Management', 'Quality management systems requirements', '2015', '2015-09-15', '{"document_control": true, "change_management": true, "audit_trail": true}'),
('iso_27001', 'ISO 27001 Information Security', 'Information security management systems', '2013', '2013-10-01', '{"access_controls": true, "audit_logging": true, "incident_management": true}'),
('gdpr', 'General Data Protection Regulation', 'Data protection and privacy regulation', '2018', '2018-05-25', '{"data_retention": true, "audit_trail": true, "consent_management": true}'),
('construction_industry', 'Construction Industry Standards', 'Industry-specific compliance requirements', '2024', '2024-01-01', '{"safety_compliance": true, "environmental_compliance": true, "quality_assurance": true}');

-- Create compliance monitoring table
CREATE TABLE IF NOT EXISTS compliance_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    framework_code VARCHAR(50) NOT NULL REFERENCES compliance_frameworks(framework_code),
    compliance_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'compliant', 'non_compliant', 'pending', 'exempt'
    compliance_score DECIMAL(5,2) DEFAULT 0.00, -- 0-100 compliance score
    
    -- Compliance check details
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checked_by UUID REFERENCES auth.users(id),
    check_method VARCHAR(50) DEFAULT 'automated', -- 'automated', 'manual', 'hybrid'
    
    -- Compliance requirements
    required_controls JSONB DEFAULT '[]',
    implemented_controls JSONB DEFAULT '[]',
    missing_controls JSONB DEFAULT '[]',
    
    -- Findings and remediation
    findings TEXT,
    remediation_plan TEXT,
    remediation_due_date DATE,
    remediation_completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Evidence and documentation
    evidence_documents JSONB DEFAULT '[]',
    compliance_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit archives table for long-term storage
CREATE TABLE IF NOT EXISTS audit_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    archive_name VARCHAR(255) NOT NULL,
    change_request_ids JSONB NOT NULL, -- Array of change request IDs
    archive_reason TEXT NOT NULL,
    
    -- Archive metadata
    audit_data JSONB NOT NULL, -- Compressed audit data
    archive_size_bytes BIGINT DEFAULT 0,
    record_count INTEGER DEFAULT 0,
    
    -- Retention information
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    retention_until TIMESTAMP WITH TIME ZONE NOT NULL,
    archived_by UUID REFERENCES auth.users(id),
    
    -- Access tracking
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0,
    
    -- Archive status
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'expired', 'deleted'
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create data retention policies table
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name VARCHAR(255) NOT NULL,
    policy_type VARCHAR(50) NOT NULL, -- 'active', 'completed', 'regulatory', 'legal_hold', 'archived'
    
    -- Retention rules
    retention_period_days INTEGER NOT NULL,
    applies_to_entity_types JSONB DEFAULT '[]', -- ['change_requests', 'audit_logs', 'approvals']
    
    -- Policy conditions
    conditions JSONB DEFAULT '{}', -- Conditions for policy application
    priority INTEGER DEFAULT 1, -- Higher priority policies override lower ones
    
    -- Policy metadata
    description TEXT,
    regulatory_basis TEXT,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Insert default data retention policies
INSERT INTO data_retention_policies (policy_name, policy_type, retention_period_days, applies_to_entity_types, description, regulatory_basis) VALUES
('Active Projects', 'active', 2555, '["change_requests", "audit_logs", "approvals"]', 'Standard retention for active project changes', 'Industry standard practice'),
('Completed Projects', 'completed', 3650, '["change_requests", "audit_logs", "approvals"]', 'Extended retention for completed projects', 'SOX compliance requirement'),
('Regulatory Compliance', 'regulatory', 5475, '["change_requests", "audit_logs", "approvals"]', 'Long-term retention for regulatory compliance', 'Multiple regulatory frameworks'),
('Legal Hold', 'legal_hold', -1, '["change_requests", "audit_logs", "approvals"]', 'Indefinite retention for legal proceedings', 'Legal department directive');

-- Create compliance violations table
CREATE TABLE IF NOT EXISTS compliance_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    framework_code VARCHAR(50) NOT NULL REFERENCES compliance_frameworks(framework_code),
    
    -- Violation details
    violation_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    description TEXT NOT NULL,
    
    -- Detection information
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    detected_by VARCHAR(50) DEFAULT 'system', -- 'system', 'user', 'auditor'
    detection_method VARCHAR(50) DEFAULT 'automated',
    
    -- Resolution tracking
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'accepted_risk'
    assigned_to UUID REFERENCES auth.users(id),
    resolution_plan TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    -- Impact assessment
    business_impact TEXT,
    regulatory_impact TEXT,
    risk_rating DECIMAL(3,1) DEFAULT 0.0, -- 0.0-10.0 risk rating
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create regulatory approvals tracking table
CREATE TABLE IF NOT EXISTS regulatory_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    
    -- Regulatory body information
    regulatory_body VARCHAR(255) NOT NULL,
    approval_type VARCHAR(100) NOT NULL,
    reference_number VARCHAR(100),
    
    -- Approval status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired'
    submitted_date DATE,
    approval_date DATE,
    expiry_date DATE,
    
    -- Documentation
    submission_documents JSONB DEFAULT '[]',
    approval_documents JSONB DEFAULT '[]',
    conditions TEXT,
    notes TEXT,
    
    -- Tracking
    submitted_by UUID REFERENCES auth.users(id),
    approved_by VARCHAR(255), -- External regulatory official
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit report templates table
CREATE TABLE IF NOT EXISTS audit_report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(255) NOT NULL,
    template_type VARCHAR(50) NOT NULL, -- 'compliance', 'audit_trail', 'violation', 'summary'
    framework_code VARCHAR(50) REFERENCES compliance_frameworks(framework_code),
    
    -- Template configuration
    report_structure JSONB NOT NULL, -- Report sections and fields
    filters JSONB DEFAULT '{}', -- Default filters
    formatting_options JSONB DEFAULT '{}',
    
    -- Template metadata
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    version VARCHAR(20) DEFAULT '1.0',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Insert default audit report templates
INSERT INTO audit_report_templates (template_name, template_type, framework_code, report_structure, description) VALUES
('SOX Compliance Report', 'compliance', 'sox', '{"sections": ["executive_summary", "compliance_status", "audit_trail", "violations", "remediation"], "required_fields": ["change_id", "approval_trail", "financial_impact"]}', 'Standard SOX compliance report template'),
('Complete Audit Trail', 'audit_trail', null, '{"sections": ["change_summary", "full_audit_log", "user_actions", "system_events"], "chronological": true}', 'Complete chronological audit trail report'),
('Compliance Violations Summary', 'violation', null, '{"sections": ["violation_summary", "severity_breakdown", "resolution_status", "trends"], "group_by": "severity"}', 'Summary of compliance violations and resolutions');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_compliance_monitoring_change_request_id ON compliance_monitoring(change_request_id);
CREATE INDEX IF NOT EXISTS idx_compliance_monitoring_framework_code ON compliance_monitoring(framework_code);
CREATE INDEX IF NOT EXISTS idx_compliance_monitoring_status ON compliance_monitoring(compliance_status);
CREATE INDEX IF NOT EXISTS idx_compliance_monitoring_checked_at ON compliance_monitoring(checked_at);

CREATE INDEX IF NOT EXISTS idx_audit_archives_change_request_ids ON audit_archives USING GIN(change_request_ids);
CREATE INDEX IF NOT EXISTS idx_audit_archives_created_at ON audit_archives(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_archives_retention_until ON audit_archives(retention_until);
CREATE INDEX IF NOT EXISTS idx_audit_archives_status ON audit_archives(status);

CREATE INDEX IF NOT EXISTS idx_compliance_violations_change_request_id ON compliance_violations(change_request_id);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_framework_code ON compliance_violations(framework_code);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_severity ON compliance_violations(severity);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_status ON compliance_violations(status);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_detected_at ON compliance_violations(detected_at);

CREATE INDEX IF NOT EXISTS idx_regulatory_approvals_change_request_id ON regulatory_approvals(change_request_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_approvals_status ON regulatory_approvals(status);
CREATE INDEX IF NOT EXISTS idx_regulatory_approvals_expiry_date ON regulatory_approvals(expiry_date);

CREATE INDEX IF NOT EXISTS idx_change_audit_log_session_id ON change_audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_change_audit_log_risk_level ON change_audit_log(risk_level);
CREATE INDEX IF NOT EXISTS idx_change_audit_log_archived ON change_audit_log(archived);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_compliance_monitoring_updated_at 
  BEFORE UPDATE ON compliance_monitoring 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_retention_policies_updated_at 
  BEFORE UPDATE ON data_retention_policies 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_violations_updated_at 
  BEFORE UPDATE ON compliance_violations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_regulatory_approvals_updated_at 
  BEFORE UPDATE ON regulatory_approvals 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audit_report_templates_updated_at 
  BEFORE UPDATE ON audit_report_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically check compliance on change request updates
CREATE OR REPLACE FUNCTION trigger_compliance_check()
RETURNS TRIGGER AS $
BEGIN
    -- Insert compliance monitoring record for significant changes
    IF (TG_OP = 'UPDATE' AND (
        OLD.status IS DISTINCT FROM NEW.status OR
        OLD.estimated_cost_impact IS DISTINCT FROM NEW.estimated_cost_impact OR
        OLD.actual_cost_impact IS DISTINCT FROM NEW.actual_cost_impact
    )) OR TG_OP = 'INSERT' THEN
        
        -- Create compliance monitoring entries for applicable frameworks
        INSERT INTO compliance_monitoring (
            change_request_id,
            framework_code,
            compliance_status,
            checked_at,
            check_method
        )
        SELECT 
            NEW.id,
            cf.framework_code,
            'pending',
            NOW(),
            'automated'
        FROM compliance_frameworks cf
        WHERE cf.is_active = true
        AND NOT EXISTS (
            SELECT 1 FROM compliance_monitoring cm 
            WHERE cm.change_request_id = NEW.id 
            AND cm.framework_code = cf.framework_code
        );
    END IF;
    
    RETURN NEW;
END;
$ language 'plpgsql';

-- Trigger to automatically initiate compliance checks
CREATE TRIGGER trigger_compliance_check_on_change
  AFTER INSERT OR UPDATE ON change_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_compliance_check();

-- Function to enforce data retention policies
CREATE OR REPLACE FUNCTION enforce_data_retention()
RETURNS void AS $
DECLARE
    policy_record RECORD;
    cutoff_date TIMESTAMP WITH TIME ZONE;
    affected_count INTEGER;
BEGIN
    -- Process each active retention policy
    FOR policy_record IN 
        SELECT * FROM data_retention_policies 
        WHERE is_active = true 
        ORDER BY priority DESC
    LOOP
        -- Skip indefinite retention policies
        IF policy_record.retention_period_days = -1 THEN
            CONTINUE;
        END IF;
        
        -- Calculate cutoff date
        cutoff_date := NOW() - INTERVAL '1 day' * policy_record.retention_period_days;
        
        -- Apply policy to audit logs
        IF policy_record.applies_to_entity_types::jsonb ? 'audit_logs' THEN
            UPDATE change_audit_log 
            SET archived = true, archived_at = NOW()
            WHERE performed_at < cutoff_date 
            AND archived = false;
            
            GET DIAGNOSTICS affected_count = ROW_COUNT;
            
            -- Log policy enforcement
            INSERT INTO change_audit_log (
                change_request_id,
                event_type,
                event_description,
                performed_by,
                performed_at,
                new_values,
                compliance_notes
            ) VALUES (
                gen_random_uuid(), -- System-level event
                'data_retention',
                'Data retention policy enforced: ' || policy_record.policy_name,
                gen_random_uuid(), -- System user
                NOW(),
                jsonb_build_object('policy_id', policy_record.id, 'affected_records', affected_count),
                'Automated data retention policy enforcement'
            );
        END IF;
    END LOOP;
END;
$ language 'plpgsql';

-- Create a scheduled job placeholder (would be implemented with pg_cron or external scheduler)
-- SELECT cron.schedule('enforce-data-retention', '0 2 * * *', 'SELECT enforce_data_retention();');