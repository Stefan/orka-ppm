# Roche Construction PPM Features - Database Schema Guide

## Overview

This guide documents the database schema for the six specialized Construction/Engineering PPM features implemented for Roche:

1. **Shareable Project URLs** - Secure, time-limited URLs for external project access
2. **Monte Carlo Risk Simulations** - Probabilistic risk analysis with statistical results
3. **What-If Scenario Analysis** - Impact modeling for project parameter changes
4. **Integrated Change Management** - Comprehensive change tracking with workflow integration
5. **SAP PO Breakdown Management** - Hierarchical Purchase Order structures with cost tracking
6. **Google Suite Report Generation** - Automated Google Slides report creation

## Migration File

**File**: `011_roche_construction_ppm_features.sql`

**Status**: ✅ Ready for deployment

## Database Tables

### 1. Shareable URLs (`shareable_urls`)

Stores secure, time-limited URLs for external project access with embedded permissions.

**Key Fields**:
- `id` (UUID, PK) - Unique identifier
- `project_id` (UUID, FK) - References projects table
- `token` (VARCHAR) - Cryptographically secure access token
- `permissions` (JSONB) - Permission configuration
- `expires_at` (TIMESTAMP) - URL expiration time
- `access_count` (INTEGER) - Number of times accessed
- `is_revoked` (BOOLEAN) - Revocation status
- `created_by` (UUID, FK) - User who created the URL
- `created_at`, `updated_at` (TIMESTAMP) - Audit timestamps

**Indexes**:
- `idx_shareable_urls_project_id` - Fast project lookups
- `idx_shareable_urls_token` - Fast token validation
- `idx_shareable_urls_expires_at` - Expiration cleanup

**Related Tables**:
- `shareable_url_access_log` - Audit log for access attempts

### 2. Simulation Results (`simulation_results`)

Stores results from Monte Carlo and What-If simulations with statistical analysis.

**Key Fields**:
- `id` (UUID, PK) - Unique identifier
- `project_id` (UUID, FK) - References projects table
- `simulation_type` (ENUM) - Type: monte_carlo, what_if, sensitivity_analysis
- `name` (VARCHAR) - Simulation name
- `config` (JSONB) - Simulation configuration
- `results` (JSONB) - Simulation results
- `percentiles` (JSONB) - P10, P50, P90 values
- `statistics` (JSONB) - Statistical analysis
- `execution_time_ms` (INTEGER) - Performance metric
- `iterations_completed` (INTEGER) - Number of iterations
- `is_cached` (BOOLEAN) - Cache status
- `cache_expires_at` (TIMESTAMP) - Cache expiration
- `created_by` (UUID, FK) - User who ran simulation
- `created_at`, `updated_at` (TIMESTAMP) - Audit timestamps

**Indexes**:
- `idx_simulation_results_project_id` - Fast project lookups
- `idx_simulation_results_type` - Filter by simulation type
- `idx_simulation_results_cache_expires` - Cache management

### 3. Scenario Analyses (`scenario_analyses`)

Stores What-If scenario configurations and impact analysis results.

**Key Fields**:
- `id` (UUID, PK) - Unique identifier
- `project_id` (UUID, FK) - References projects table
- `name` (VARCHAR) - Scenario name
- `base_scenario_id` (UUID, FK) - References parent scenario
- `parameter_changes` (JSONB) - Modified parameters
- `impact_results` (JSONB) - Impact analysis results
- `timeline_impact` (JSONB) - Timeline impact details
- `cost_impact` (JSONB) - Cost impact details
- `resource_impact` (JSONB) - Resource impact details
- `is_active` (BOOLEAN) - Active status
- `is_baseline` (BOOLEAN) - Baseline scenario flag
- `created_by` (UUID, FK) - User who created scenario
- `created_at`, `updated_at` (TIMESTAMP) - Audit timestamps

**Indexes**:
- `idx_scenario_analyses_project_id` - Fast project lookups
- `idx_scenario_analyses_base_scenario` - Scenario hierarchy
- `idx_scenario_analyses_baseline` - Find baseline scenarios

**Constraints**:
- `unique_baseline_per_project` - Only one baseline per project

### 4. Change Requests (`change_requests`)

Comprehensive change management with workflow integration and impact tracking.

**Key Fields**:
- `id` (UUID, PK) - Unique identifier
- `project_id` (UUID, FK) - References projects table
- `change_number` (VARCHAR, UNIQUE) - Auto-generated change ID (e.g., PRJ-24-0001)
- `title` (VARCHAR) - Change title
- `description` (TEXT) - Detailed description
- `change_type` (ENUM) - Type: scope, schedule, budget, resource, quality, risk
- `priority` (VARCHAR) - Priority: low, medium, high, critical
- `status` (ENUM) - Status: draft, submitted, under_review, approved, rejected, implemented, cancelled
- `impact_assessment` (JSONB) - Impact analysis
- `justification` (TEXT) - Change justification
- `workflow_instance_id` (UUID, FK) - References workflow system
- `estimated_cost_impact` (DECIMAL) - Estimated cost impact
- `estimated_schedule_impact` (INTEGER) - Estimated schedule impact (days)
- `actual_cost_impact` (DECIMAL) - Actual cost impact
- `actual_schedule_impact` (INTEGER) - Actual schedule impact (days)
- `requested_by` (UUID, FK) - User who requested change
- `assigned_to` (UUID, FK) - User assigned to change
- `approved_by` (UUID, FK) - User who approved change
- `approved_at` (TIMESTAMP) - Approval timestamp
- `created_at`, `updated_at` (TIMESTAMP) - Audit timestamps

**Indexes**:
- `idx_change_requests_project_id` - Fast project lookups
- `idx_change_requests_status` - Filter by status
- `idx_change_requests_number` - Fast change number lookup
- `idx_change_requests_project_status` - Composite index for common queries

**Auto-Generated Fields**:
- `change_number` - Automatically generated using format: `{PROJECT_CODE}-{YEAR}-{SEQUENCE}`

### 5. PO Breakdowns (`po_breakdowns`)

Hierarchical Purchase Order breakdown structures with cost tracking.

**Key Fields**:
- `id` (UUID, PK) - Unique identifier
- `project_id` (UUID, FK) - References projects table
- `name` (VARCHAR) - Breakdown name
- `code` (VARCHAR) - SAP code or custom code
- `sap_po_number` (VARCHAR) - SAP Purchase Order number
- `sap_line_item` (VARCHAR) - SAP line item
- `hierarchy_level` (INTEGER) - Level in hierarchy (0-10)
- `parent_breakdown_id` (UUID, FK) - References parent breakdown
- `cost_center` (VARCHAR) - Cost center code
- `gl_account` (VARCHAR) - General ledger account
- `planned_amount` (DECIMAL) - Planned budget
- `committed_amount` (DECIMAL) - Committed budget
- `actual_amount` (DECIMAL) - Actual spent
- `remaining_amount` (DECIMAL, COMPUTED) - Calculated: planned - actual
- `currency` (VARCHAR) - Currency code (default: USD)
- `breakdown_type` (ENUM) - Type: sap_standard, custom_hierarchy, cost_center, work_package
- `custom_fields` (JSONB) - Custom field values
- `tags` (JSONB) - Tags for categorization
- `import_batch_id` (UUID) - Batch import identifier
- `version` (INTEGER) - Version number
- `is_active` (BOOLEAN) - Active status
- `created_at`, `updated_at` (TIMESTAMP) - Audit timestamps

**Indexes**:
- `idx_po_breakdowns_project_id` - Fast project lookups
- `idx_po_breakdowns_parent` - Hierarchy navigation
- `idx_po_breakdowns_sap_po` - SAP PO number lookup
- `idx_po_breakdowns_project_hierarchy` - Composite index for hierarchy queries

**Triggers**:
- `update_parent_po_amounts_trigger` - Automatically updates parent amounts when child amounts change

### 6. Change Request PO Links (`change_request_po_links`)

Links between change requests and affected PO breakdowns.

**Key Fields**:
- `id` (UUID, PK) - Unique identifier
- `change_request_id` (UUID, FK) - References change_requests
- `po_breakdown_id` (UUID, FK) - References po_breakdowns
- `impact_type` (VARCHAR) - Type: cost_increase, cost_decrease, scope_change, reallocation, new_po, po_cancellation
- `impact_amount` (DECIMAL) - Impact amount
- `impact_percentage` (DECIMAL) - Impact percentage
- `description` (TEXT) - Impact description
- `created_at` (TIMESTAMP) - Creation timestamp

**Indexes**:
- `idx_change_po_links_change_id` - Fast change request lookups
- `idx_change_po_links_po_id` - Fast PO breakdown lookups

**Constraints**:
- `unique_change_po_link` - Unique combination of change, PO, and impact type

### 7. Report Templates (`report_templates`)

Google Slides report templates with data mapping configurations.

**Key Fields**:
- `id` (UUID, PK) - Unique identifier
- `name` (VARCHAR) - Template name
- `template_type` (ENUM) - Type: executive_summary, project_status, risk_assessment, financial_report, custom
- `google_slides_template_id` (VARCHAR) - Google Slides template ID
- `google_drive_folder_id` (VARCHAR) - Google Drive folder ID
- `data_mappings` (JSONB) - Data field mappings
- `chart_configurations` (JSONB) - Chart configurations
- `slide_layouts` (JSONB) - Slide layout definitions
- `version` (VARCHAR) - Template version
- `is_active` (BOOLEAN) - Active status
- `is_default` (BOOLEAN) - Default template flag
- `is_public` (BOOLEAN) - Public access flag
- `allowed_roles` (JSONB) - Allowed user roles
- `tags` (JSONB) - Tags for categorization
- `created_by` (UUID, FK) - User who created template
- `created_at`, `updated_at` (TIMESTAMP) - Audit timestamps

**Indexes**:
- `idx_report_templates_type` - Filter by template type
- `idx_report_templates_active` - Filter active templates
- `idx_report_templates_public` - Filter public templates

**Constraints**:
- `unique_default_per_type` - Only one default template per type

### 8. Generated Reports (`generated_reports`)

Generated Google Slides reports with status tracking.

**Key Fields**:
- `id` (UUID, PK) - Unique identifier
- `project_id` (UUID, FK) - References projects table
- `template_id` (UUID, FK) - References report_templates
- `name` (VARCHAR) - Report name
- `google_drive_url` (TEXT) - Google Drive URL
- `google_slides_id` (VARCHAR) - Google Slides document ID
- `google_drive_file_id` (VARCHAR) - Google Drive file ID
- `generation_status` (ENUM) - Status: pending, in_progress, completed, failed, cancelled
- `progress_percentage` (INTEGER) - Progress (0-100)
- `error_message` (TEXT) - Error details if failed
- `generation_config` (JSONB) - Generation configuration
- `data_snapshot` (JSONB) - Data snapshot used
- `generation_time_ms` (INTEGER) - Performance metric
- `generated_by` (UUID, FK) - User who generated report
- `created_at` (TIMESTAMP) - Creation timestamp
- `completed_at` (TIMESTAMP) - Completion timestamp

**Indexes**:
- `idx_generated_reports_project_id` - Fast project lookups
- `idx_generated_reports_template_id` - Fast template lookups
- `idx_generated_reports_status` - Filter by status

### 9. Shareable URL Access Log (`shareable_url_access_log`)

Audit log for shareable URL access attempts.

**Key Fields**:
- `id` (UUID, PK) - Unique identifier
- `shareable_url_id` (UUID, FK) - References shareable_urls
- `accessed_at` (TIMESTAMP) - Access timestamp
- `ip_address` (INET) - Client IP address
- `user_agent` (TEXT) - Client user agent
- `referer` (TEXT) - HTTP referer
- `access_granted` (BOOLEAN) - Access result
- `denial_reason` (TEXT) - Reason if denied
- `sections_accessed` (JSONB) - Sections accessed
- `session_duration_seconds` (INTEGER) - Session duration

**Indexes**:
- `idx_shareable_url_access_log_url_id` - Fast URL lookups
- `idx_shareable_url_access_log_accessed_at` - Time-based queries
- `idx_shareable_url_access_log_ip` - IP-based queries

## Database Functions

### 1. `cleanup_expired_shareable_urls()`

Automatically marks expired shareable URLs as revoked.

**Returns**: INTEGER (number of URLs marked as revoked)

**Usage**: Should be called from a scheduled job (e.g., daily cron)

### 2. `get_project_simulation_stats(proj_id UUID)`

Returns aggregated simulation statistics for a project.

**Returns**: TABLE with columns:
- `total_simulations` (BIGINT)
- `monte_carlo_count` (BIGINT)
- `what_if_count` (BIGINT)
- `avg_execution_time_ms` (NUMERIC)
- `latest_simulation_date` (TIMESTAMP)

### 3. `get_change_request_stats(proj_id UUID)`

Returns aggregated change request statistics.

**Parameters**: `proj_id` (optional) - If NULL, returns stats for all projects

**Returns**: TABLE with columns:
- `total_changes` (BIGINT)
- `draft_changes` (BIGINT)
- `submitted_changes` (BIGINT)
- `approved_changes` (BIGINT)
- `rejected_changes` (BIGINT)
- `implemented_changes` (BIGINT)
- `total_cost_impact` (NUMERIC)
- `total_schedule_impact` (BIGINT)

### 4. `get_po_breakdown_hierarchy(proj_id UUID)`

Returns hierarchical PO breakdown structure as JSON.

**Returns**: JSONB (nested hierarchy structure)

### 5. `generate_change_request_number()`

Trigger function that auto-generates unique change request numbers.

**Format**: `{PROJECT_CODE}-{YEAR}-{SEQUENCE}`
- PROJECT_CODE: First 3 characters of project name (uppercase)
- YEAR: Last 2 digits of current year
- SEQUENCE: 4-digit sequence number (0001, 0002, etc.)

**Example**: `PRJ-24-0001`

### 6. `update_parent_po_amounts()`

Trigger function that automatically updates parent PO breakdown amounts when child amounts change.

**Behavior**: Recursively updates all parent breakdowns up the hierarchy.

## Row Level Security (RLS)

All tables have RLS enabled with policies based on:
- Project access (portfolio owner, project manager, project resources)
- User ownership (created_by field)
- Public access flags (for templates)

## Performance Optimization

### Indexes

All tables include optimized indexes for:
- Foreign key lookups
- Common filter conditions
- Composite queries
- Time-based queries

### Caching

Simulation results include built-in caching with:
- `is_cached` flag
- `cache_expires_at` timestamp
- Automatic invalidation on risk data changes

### Computed Columns

PO breakdowns use computed columns for:
- `remaining_amount` = `planned_amount` - `actual_amount`

## Data Integrity

### Constraints

- Foreign key constraints ensure referential integrity
- Check constraints validate data ranges
- Unique constraints prevent duplicates
- NOT NULL constraints ensure required fields

### Triggers

- Automatic timestamp updates (`updated_at`)
- Auto-generated change request numbers
- Cascading PO breakdown amount updates

## Migration Application

### Prerequisites

1. Supabase database connection
2. Service role key with admin privileges
3. Python environment with required packages

### Application Steps

```bash
# Verify migration file exists
ls backend/migrations/011_roche_construction_ppm_features.sql

# Apply migration (if using custom script)
python backend/migrations/apply_migration.py

# Verify migration
python backend/migrations/verify_roche_construction_migration.py
```

### Verification

After applying the migration, verify:

1. All 9 tables exist
2. All indexes are created
3. All functions are available
4. RLS policies are active
5. Triggers are functioning

## Rollback Plan

If rollback is needed:

```sql
-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS shareable_url_access_log CASCADE;
DROP TABLE IF EXISTS generated_reports CASCADE;
DROP TABLE IF EXISTS report_templates CASCADE;
DROP TABLE IF EXISTS change_request_po_links CASCADE;
DROP TABLE IF EXISTS po_breakdowns CASCADE;
DROP TABLE IF EXISTS change_requests CASCADE;
DROP TABLE IF EXISTS scenario_analyses CASCADE;
DROP TABLE IF EXISTS simulation_results CASCADE;
DROP TABLE IF EXISTS shareable_urls CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS shareable_permission_level CASCADE;
DROP TYPE IF EXISTS simulation_type CASCADE;
DROP TYPE IF EXISTS change_request_type CASCADE;
DROP TYPE IF EXISTS change_request_status CASCADE;
DROP TYPE IF EXISTS po_breakdown_type CASCADE;
DROP TYPE IF EXISTS report_template_type CASCADE;
DROP TYPE IF EXISTS report_generation_status CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS cleanup_expired_shareable_urls() CASCADE;
DROP FUNCTION IF EXISTS get_project_simulation_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_change_request_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_po_breakdown_hierarchy(UUID) CASCADE;
DROP FUNCTION IF EXISTS generate_change_request_number() CASCADE;
DROP FUNCTION IF EXISTS update_parent_po_amounts() CASCADE;
```

## Next Steps

After database schema setup:

1. ✅ Create Pydantic models (completed)
2. ✅ Write property tests for schema consistency (completed)
3. ⏭️ Implement service layer for each feature
4. ⏭️ Create API endpoints
5. ⏭️ Build frontend components
6. ⏭️ Integration testing

## Support

For questions or issues:
- Review the design document: `.kiro/specs/roche-construction-ppm-features/design.md`
- Check requirements: `.kiro/specs/roche-construction-ppm-features/requirements.md`
- Review migration file: `backend/migrations/011_roche_construction_ppm_features.sql`
