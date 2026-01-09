#!/usr/bin/env python3
"""
Apply Translation System Migration
Creates translation cache and analytics tables
"""

import os
import sys
import asyncio
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from config.database import supabase
from config.settings import settings

async def apply_translation_migration():
    """Apply the translation system migration"""
    
    print("🔄 Applying Translation System Migration...")
    
    # Validate settings
    if not settings.validate_required_settings():
        print("❌ Required settings not configured")
        return False
    
    try:
        # Read the migration SQL file
        migration_file = Path(__file__).parent / "019_translation_system.sql"
        
        if not migration_file.exists():
            print(f"❌ Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        print("📄 Executing migration SQL...")
        
        # Execute the migration
        # Note: Supabase Python client doesn't support raw SQL execution
        # This would typically be done through the Supabase dashboard or CLI
        print("⚠️  Please execute the following SQL in your Supabase dashboard:")
        print("=" * 60)
        print(migration_sql)
        print("=" * 60)
        
        # For now, we'll create the tables using the Python client
        # This is a simplified version - the full SQL should be run in Supabase
        
        # Check if tables already exist
        try:
            # Try to query the translation_cache table
            result = supabase.table("translation_cache").select("id").limit(1).execute()
            print("✅ Translation cache table already exists")
        except Exception:
            print("⚠️  Translation cache table needs to be created manually")
        
        try:
            # Try to query the translation_analytics table
            result = supabase.table("translation_analytics").select("id").limit(1).execute()
            print("✅ Translation analytics table already exists")
        except Exception:
            print("⚠️  Translation analytics table needs to be created manually")
        
        print("✅ Translation system migration preparation complete")
        print("📝 Please run the SQL commands above in your Supabase dashboard")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False

def main():
    """Main function"""
    print("🚀 Translation System Migration Tool")
    print("=" * 50)
    
    # Print environment info
    settings.print_debug_info()
    print()
    
    # Run migration
    success = asyncio.run(apply_translation_migration())
    
    if success:
        print("\n✅ Migration preparation completed successfully!")
        print("📋 Next steps:")
        print("1. Copy the SQL commands above")
        print("2. Go to your Supabase dashboard")
        print("3. Navigate to SQL Editor")
        print("4. Paste and execute the SQL commands")
        print("5. Verify the tables were created successfully")
    else:
        print("\n❌ Migration preparation failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()