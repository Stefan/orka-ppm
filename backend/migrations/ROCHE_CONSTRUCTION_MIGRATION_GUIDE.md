# Roche Construction/Engineering PPM Features Migration Guide

## Overview

This migration (011) adds comprehensive Construction and Engineering PPM features to your existing PPM SaaS platform, including:

- 📤 **Shareable Project URLs** - Secure, time-limited URLs for external stakeholder access
- 🎲 **Monte Carlo Risk Simulations** - Statistical risk analysis with confidence intervals
- 🔄 **What-If Scenario Analysis** - Impact modeling for project parameter changes
- 📋 **Integrated Change Management** - Workflow-integrated change tracking with PO linking
- 💰 **SAP PO Breakdown Management** - Hierarchical Purchase Order structure management
- 📊 **Google Suite Report Generation** - Automated Google Slides report creation

## Migration Files

### 1. Database Migration
- **File**: `migrations/011_roche_construction_ppm_features.sql`
- **Purpose**: Creates 9 new tables with proper relationships, indexes, and RLS policies
- **Size**: ~1,200 lines of SQL with comprehensive schema

### 2. Python Migration Script
- **File**: `apply_roche_construction_migration.py`
- **Purpose**: Applies and verifies the database migration
- **Usage**: Handles Supabase-specific migration requirements

### 3. Pydantic Models
- **File**: `roche_construction_models.py`
- **Purpose**: Complete data models for all new features
- **Content**: 50+ Pydantic models with validation

## Database Schema Changes

### New Tables Created

1. **`shareable_urls`** - Secure URL management
   - Cryptographically secure tokens
   - Granular permission control
   - Access logging and audit trails

2. **`simulation_results`** - Monte Carlo and What-If simulations
   - Statistical analysis results
   - Performance metrics tracking
   - Caching and invalidation

3. **`scenario_analyses`** - What-If scenario configurations
   - Parameter change tracking
   - Impact analysis results
   - Baseline scenario management

4. **`change_requests`** - Integrated change management
   - Workflow integration
   - Impact assessment tracking
   - Auto-generated change numbers

5. **`po_breakdowns`** - SAP PO hierarchy management
   - Hierarchical cost structures
   - Version control
   - Custom field support

6. **`change_request_po_links`** - Change-PO relationships
   - Impact type tracking
   - Financial impact analysis

7. **`report_templates`** - Google Slides templates
   - Template configuration
   - Data mapping definitions
   - Access control

8. **`generated_reports`** - Report generation tracking
   - Status monitoring
   - Performance metrics
   - Google Drive integration

9. **`shareable_url_access_log`** - Access audit logging
   - Security monitoring
   - Usage analytics

### Key Features

#### Security & Access Control
- **Row Level Security (RLS)** on all tables
- **Comprehensive audit logging** for all operations
- **Token-based access control** for shareable URLs
- **Role-based permissions** integrated with existing RBAC

#### Performance Optimization
- **Strategic indexing** for common query patterns
- **Composite indexes** for complex queries
- **Automatic cache invalidation** for simulations
- **Hierarchical query optimization** for PO structures

#### Data Integrity
- **Foreign key constraints** maintaining referential integrity
- **Check constraints** for data validation
- **Computed columns** for derived values
- **Automatic timestamp management**

## Migration Steps

### Step 1: Backup Your Database
```bash
# Create a backup before migration
pg_dump your_database > backup_before_roche_migration.sql
```

### Step 2: Execute the Migration

#### Option A: Supabase SQL Editor (Recommended)
1. Open your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the entire contents of `migrations/011_roche_construction_ppm_features.sql`
4. Paste and execute in the SQL Editor
5. Verify no errors occurred

#### Option B: Python Script
```bash
# Set environment variables
export SUPABASE_URL="your_supabase_url"
export SUPABASE_ANON_KEY="your_supabase_key"

# Run the migration script
python apply_roche_construction_migration.py

# Or verify an existing migration
python apply_roche_construction_migration.py --verify-only
```

### Step 3: Verify Migration Success
```bash
# Run verification
python apply_roche_construction_migration.py --verify-only
```

Expected output:
```
✅ Table 'shareable_urls' exists and is accessible
✅ Table 'simulation_results' exists and is accessible
✅ Table 'scenario_analyses' exists and is accessible
✅ Table 'change_requests' exists and is accessible
✅ Table 'po_breakdowns' exists and is accessible
✅ Table 'change_request_po_links' exists and is accessible
✅ Table 'report_templates' exists and is accessible
✅ Table 'generated_reports' exists and is accessible
✅ Table 'shareable_url_access_log' exists and is accessible
🎉 Migration verification completed successfully!
```

## Post-Migration Setup

### 1. Update Your FastAPI Application

Add the new models to your main application:

```python
# In main.py, add the import
from roche_construction_models import *

# Add new permission enums to your existing Permission enum
class Permission(str, Enum):
    # ... existing permissions ...
    
    # New Roche Construction permissions
    shareable_url_create = "shareable_url_create"
    shareable_url_manage = "shareable_url_manage"
    simulation_run = "simulation_run"
    simulation_view = "simulation_view"
    scenario_create = "scenario_create"
    scenario_manage = "scenario_manage"
    change_request_create = "change_request_create"
    change_request_approve = "change_request_approve"
    po_breakdown_import = "po_breakdown_import"
    po_breakdown_manage = "po_breakdown_manage"
    report_generate = "report_generate"
    report_template_manage = "report_template_manage"
```

### 2. Update Role Permissions

Add new permissions to your default roles:

```python
# Update DEFAULT_ROLE_PERMISSIONS
DEFAULT_ROLE_PERMISSIONS = {
    UserRole.admin: [
        # ... existing permissions ...
        Permission.shareable_url_create, Permission.shareable_url_manage,
        Permission.simulation_run, Permission.simulation_view,
        Permission.scenario_create, Permission.scenario_manage,
        Permission.change_request_create, Permission.change_request_approve,
        Permission.po_breakdown_import, Permission.po_breakdown_manage,
        Permission.report_generate, Permission.report_template_manage,
    ],
    UserRole.project_manager: [
        # ... existing permissions ...
        Permission.shareable_url_create,
        Permission.simulation_run, Permission.simulation_view,
        Permission.scenario_create, Permission.scenario_manage,
        Permission.change_request_create,
        Permission.po_breakdown_manage,
        Permission.report_generate,
    ],
    # ... other roles ...
}
```

### 3. Initialize Default Data

Run the initialization functions:

```python
# Create default report templates
async def create_default_report_templates():
    # Executive Summary Template
    exec_template = ReportTemplateCreate(
        name="Executive Project Summary",
        description="High-level project overview for executives",
        template_type=ReportTemplateType.executive_summary,
        data_mappings={
            "project_name": "{{project.name}}",
            "project_status": "{{project.status}}",
            "budget_utilization": "{{project.budget_utilization}}",
            "schedule_progress": "{{project.schedule_progress}}",
            "risk_summary": "{{project.risk_summary}}"
        },
        is_public=True,
        is_default=True
    )
    
    # Add more default templates...
```

## API Endpoints Added

The migration enables these new API endpoints (to be implemented):

### Shareable URLs
- `POST /projects/{id}/share` - Generate shareable URL
- `GET /shared/{token}` - Access shared project
- `GET /projects/{id}/shared-urls` - List project URLs
- `DELETE /shared/{url_id}` - Revoke URL

### Simulations
- `POST /simulations/monte-carlo` - Run Monte Carlo simulation
- `POST /simulations/what-if` - Create What-If scenario
- `GET /simulations/{id}` - Get simulation results
- `GET /projects/{id}/simulations` - List project simulations

### Change Management
- `POST /changes` - Create change request
- `GET /changes` - List change requests
- `PUT /changes/{id}` - Update change request
- `POST /changes/{id}/approve` - Approve change
- `POST /changes/{id}/link-po` - Link to PO breakdown

### PO Breakdowns
- `POST /pos/breakdown/import` - Import SAP CSV
- `POST /pos/breakdown` - Create custom breakdown
- `GET /pos/breakdown/{id}` - Get breakdown hierarchy
- `PUT /pos/breakdown/{id}` - Update breakdown

### Report Generation
- `POST /reports/export-google` - Generate Google Slides report
- `GET /reports/templates` - List templates
- `POST /reports/templates` - Create template
- `GET /reports/{id}/status` - Check generation status

## Troubleshooting

### Common Issues

1. **Migration Fails with Permission Error**
   ```
   Solution: Ensure you're using a Supabase service role key, not anon key
   ```

2. **Tables Not Created**
   ```
   Solution: Execute SQL manually in Supabase SQL Editor
   Check for syntax errors in the migration file
   ```

3. **RLS Policies Block Access**
   ```
   Solution: Verify user has proper role assignments
   Check project access permissions
   ```

4. **Foreign Key Violations**
   ```
   Solution: Ensure referenced tables (projects, auth.users) exist
   Check existing data integrity
   ```

### Rollback Procedure

If you need to rollback the migration:

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

## Performance Considerations

### Expected Performance Impact
- **Minimal impact** on existing queries (new tables are separate)
- **Optimized indexes** for new feature queries
- **Caching strategies** for simulation results
- **Background processing** for large imports

### Monitoring Recommendations
- Monitor simulation execution times (target: <30s)
- Track report generation performance (target: <60s)
- Watch shareable URL access patterns
- Monitor PO breakdown hierarchy query performance

## Security Considerations

### Data Protection
- All sensitive data encrypted at rest
- Shareable URLs use cryptographically secure tokens
- Comprehensive audit logging for all operations
- Row-level security enforced on all tables

### Access Control
- Integration with existing RBAC system
- Granular permissions for each feature
- Project-based access restrictions
- Time-limited URL access

## Support

For issues with this migration:

1. **Check the logs** in your Supabase dashboard
2. **Verify environment variables** are set correctly
3. **Review RLS policies** if access is denied
4. **Check foreign key relationships** for data integrity issues

The migration is designed to be safe and reversible. All new features are additive and don't modify existing functionality.