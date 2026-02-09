# Schedule Management – Database Migration

If you see an error like:

- **"Could not find the table 'public.schedules' in the schema cache"** (code `PGRST205`), or  
- **"Failed to create schedule"** with a message about the schedules table

the schedule tables have not been created in your Supabase database yet.

## Fix: Run the migration in Supabase

1. Open **Supabase Dashboard** → your project → **SQL Editor**.
2. Open the migration file in this repo:  
   `backend/migrations/017_integrated_master_schedule.sql`
3. Copy its full contents and paste into the SQL Editor.
4. Run the script (Run / Execute).

This creates the `schedules`, `tasks`, `task_dependencies`, `wbs_elements`, `schedule_baselines`, `task_resource_assignments` tables and related types, indexes, and triggers.

**Requirements:**

- The `projects` table must already exist (it references `projects(id)`).
- The migration uses `auth.users(id)` for `created_by`; your Supabase project must have Auth enabled.

After the migration completes, try creating a schedule again from the app.
