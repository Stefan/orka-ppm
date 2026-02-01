#!/usr/bin/env python3
"""
Run the feature toggle system migration
"""

import sys
import os
sys.path.append('backend')

from config.database import service_supabase

def run_migration():
    if not service_supabase:
        print("❌ Service Supabase client not available")
        return False

    # Read the migration SQL
    migration_path = "backend/migrations/039_feature_toggle_system.sql"
    with open(migration_path, 'r') as f:
        sql = f.read()

    try:
        # Execute the SQL
        result = service_supabase.rpc('exec_sql', {'sql': sql})
        print("✅ Migration executed successfully")
        return True
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        # Try alternative approach - execute statements one by one
        try:
            statements = [stmt.strip() for stmt in sql.split(';') if stmt.strip() and not stmt.strip().startswith('--')]
            for stmt in statements:
                if stmt:
                    print(f"Executing: {stmt[:50]}...")
                    # This won't work with service_supabase.rpc, need direct SQL execution
                    # For now, just print what we'd execute
            print("⚠️  Manual SQL execution required. Run the SQL from backend/migrations/039_feature_toggle_system.sql in Supabase SQL editor")
            return False
        except Exception as e2:
            print(f"❌ Alternative execution also failed: {e2}")
            return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)