#!/usr/bin/env python3
"""
Apply Help Content Migration Script
Applies the help content vector functions migration
"""

import os
import sys

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.database import supabase

def apply_migration():
    """Apply the help content vector functions migration"""
    try:
        migration_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'migrations',
            'help_content_vector_functions.sql'
        )
        
        print(f"Reading migration file: {migration_file}")
        
        with open(migration_file, 'r') as f:
            sql_content = f.read()
        
        print("Applying migration...")
        
        # Execute the migration using Supabase
        try:
            # Note: This is a simplified approach - in production you'd want more sophisticated SQL parsing
            result = supabase.rpc('exec_sql', {'sql': sql_content}).execute()
            print("✓ Migration applied successfully")
        except Exception as e:
            print(f"✗ Migration failed: {e}")
            print("Note: Some functions may already exist or require manual application")
        
    except Exception as e:
        print(f"Error applying migration: {e}")

if __name__ == "__main__":
    apply_migration()