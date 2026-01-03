# Database Schema Enhancement Migration

This directory contains the database migration files for enhancing the AI-Powered PPM Platform schema.

## ⚠️ MIGRATION STATUS: MANUAL ACTION REQUIRED

The database schema enhancement is **partially complete**. Several tables and columns still need to be added manually via Supabase SQL Editor.

**Quick Action Required:**
1. Open your Supabase project dashboard
2. Go to SQL Editor  
3. Copy contents of `002_complete_remaining_schema.sql`
4. Paste and execute in SQL Editor
5. Run `python migrations/verify_schema.py` to confirm success

📋 **See `MANUAL_MIGRATION_GUIDE.md` for detailed instructions**

## Overview

The migration adds the following new tables and enhancements:

### ✅ Already Created:
- `portfolios` - Portfolio management
- `risks` - Risk register with probability/impact tracking  
- `issues` - Issue tracking linked to risks and projects
- Enhanced `projects` table (partial - missing some columns)
- Enhanced `resources` table (partial - missing some columns)

### ❌ Still Missing (requires manual action):
- `workflows` - Configurable workflow templates
- `workflow_instances` - Active workflow executions
- `workflow_approvals` - Individual approval steps
- `financial_tracking` - Detailed financial tracking with multi-currency support
- `milestones` - Project milestone tracking
- `project_resources` - Many-to-many project-resource relationships
- `audit_logs` - Comprehensive audit trail
- Missing columns in `projects` table: `health`, `manager_id`, `team_members`
- Missing columns in `resources` table: `availability`, `current_projects`, `location`

### New Tables Created:
- `portfolios` - Portfolio management
- `risks` - Risk register with probability/impact tracking
- `issues` - Issue tracking linked to risks and projects
- `workflows` - Configurable workflow templates
- `workflow_instances` - Active workflow executions
- `workflow_approvals` - Individual approval steps
- `financial_tracking` - Detailed financial tracking with multi-currency support
- `milestones` - Project milestone tracking
- `project_resources` - Many-to-many project-resource relationships
- `audit_logs` - Comprehensive audit trail

### Enhanced Existing Tables:
- `projects` - Added health, start_date, end_date, actual_cost, manager_id, team_members, portfolio_id
- `resources` - Added email, role, availability, hourly_rate, current_projects, location

### Features Added:
- Custom enum types for consistent data validation
- Comprehensive indexing for performance
- Row Level Security (RLS) policies
- Audit triggers for change tracking
- Updated_at timestamp triggers
- Foreign key relationships and constraints

## Migration Files

1. **`002_complete_remaining_schema.sql`** - **REQUIRED** - Complete remaining migration (MANUAL EXECUTION NEEDED)
2. **`MANUAL_MIGRATION_GUIDE.md`** - **READ FIRST** - Step-by-step instructions for completing migration
3. **`supabase_schema_enhancement.sql`** - Original comprehensive migration (partially applied)
4. **`001_initial_schema_enhancement.sql`** - Alternative comprehensive migration
5. **`apply_remaining_migration.py`** - Python script that provides migration instructions
6. **`verify_schema.py`** - Schema verification script (use to check status)

## ⚠️ IMMEDIATE ACTION REQUIRED

**Current Status:** Migration is incomplete - manual execution needed

**To Complete Migration:**
1. Follow instructions in `MANUAL_MIGRATION_GUIDE.md`
2. Execute `002_complete_remaining_schema.sql` in Supabase SQL Editor
3. Run `python migrations/verify_schema.py` to confirm success

## How to Apply the Migration

### Option 1: Supabase SQL Editor (RECOMMENDED)

1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Copy the contents of `supabase_schema_enhancement.sql`
4. Paste into the SQL Editor
5. Click "Run" to execute the migration
6. Verify success by checking the Tables view

### Option 2: Python Script

1. Ensure you have the required environment variables:
   ```bash
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. Install dependencies:
   ```bash
   pip install supabase python-dotenv
   ```

3. Run the verification script:
   ```bash
   cd backend/migrations
   python verify_schema.py
   ```

## Verification

After applying the migration, run the verification script to ensure everything is working:

```bash
cd backend/migrations
python verify_schema.py
```

The script will:
- Check that all required tables exist
- Verify that all required columns are present
- Test basic data operations
- Provide a summary of the schema status

## Expected Output

After successful migration, you should see:

```
✓ Connected to Supabase

=== Verifying Tables ===
✓ portfolios
✓ projects
✓ resources
✓ risks
✓ issues
✓ workflows
✓ workflow_instances
✓ workflow_approvals
✓ financial_tracking
✓ milestones
✓ project_resources
✓ audit_logs

=== Verifying Project Table Columns ===
✓ projects.id
✓ projects.name
✓ projects.description
✓ projects.status
✓ projects.portfolio_id
✓ projects.budget
✓ projects.health
✓ projects.start_date
✓ projects.end_date
✓ projects.actual_cost
✓ projects.manager_id
✓ projects.team_members

=== Verifying Resource Table Columns ===
✓ resources.id
✓ resources.name
✓ resources.email
✓ resources.role
✓ resources.skills
✓ resources.capacity
✓ resources.availability
✓ resources.hourly_rate
✓ resources.current_projects
✓ resources.location

=== Testing Data Operations ===
✓ Portfolio creation test passed
✓ Test data cleanup completed

=== Schema Verification Summary ===
🎉 All schema requirements verified successfully!

The database schema enhancement is complete and ready for use.
```

## Troubleshooting

### Common Issues:

1. **Permission Errors**: Ensure you're using the service role key, not the anon key
2. **Type Already Exists**: The migration is idempotent - you can run it multiple times safely
3. **Column Already Exists**: The migration checks for existing columns before adding them
4. **Foreign Key Errors**: Ensure the referenced tables exist before creating relationships

### Manual Column Addition:

If some columns fail to add automatically, you can add them manually via Supabase dashboard:

1. Go to Table Editor
2. Select the table (projects or resources)
3. Click "Add Column"
4. Add the missing columns with appropriate types

### Required Column Types:

**Projects table additions:**
- `health`: `health_indicator` enum (green, yellow, red)
- `start_date`: `date`
- `end_date`: `date`
- `actual_cost`: `numeric(12,2)`
- `manager_id`: `uuid` (foreign key to auth.users)
- `team_members`: `jsonb`
- `portfolio_id`: `uuid` (foreign key to portfolios)

**Resources table additions:**
- `email`: `varchar(255)` (unique)
- `role`: `varchar(100)`
- `availability`: `integer` (0-100)
- `hourly_rate`: `numeric(8,2)`
- `current_projects`: `jsonb`
- `location`: `varchar(255)`

## Next Steps

After successful migration:

1. Update your API models to include the new fields
2. Implement the new endpoints for risks, issues, workflows, and financial tracking
3. Update the frontend to use the enhanced data models
4. Test the new functionality with the enhanced schema

## Support

If you encounter issues with the migration:

1. Check the Supabase logs for detailed error messages
2. Verify your environment variables are correct
3. Ensure you have the necessary permissions
4. Run the verification script to identify specific issues