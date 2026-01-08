#!/usr/bin/env python3
"""
Migration script to transition from monolithic main.py to modular architecture

This script helps migrate the existing monolithic backend/main.py to the new
modular structure by backing up the old file and replacing it with the new one.
"""

import os
import shutil
from datetime import datetime

def migrate_to_modular():
    """Migrate from monolithic to modular architecture"""
    
    print("🔄 Starting migration to modular architecture...")
    
    # Backup the original main.py
    backup_filename = f"main_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.py"
    
    try:
        # Create backup
        if os.path.exists("main.py"):
            shutil.copy2("main.py", backup_filename)
            print(f"✅ Backed up original main.py to {backup_filename}")
        
        # Replace main.py with the new modular version
        if os.path.exists("main_new.py"):
            shutil.copy2("main_new.py", "main.py")
            print("✅ Replaced main.py with modular version")
            
            # Remove the temporary new file
            os.remove("main_new.py")
            print("✅ Cleaned up temporary files")
        else:
            print("❌ main_new.py not found - cannot complete migration")
            return False
        
        print("\n🎉 Migration completed successfully!")
        print("\nNext steps:")
        print("1. Test the application to ensure all endpoints work correctly")
        print("2. Gradually move remaining endpoints from the backup file to appropriate routers")
        print("3. Update any imports in other files that reference the old structure")
        print("4. Run your test suite to verify everything works")
        print(f"5. Keep the backup file ({backup_filename}) until you're confident the migration is successful")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False

def rollback_migration():
    """Rollback to the original monolithic structure"""
    
    print("🔄 Rolling back to monolithic architecture...")
    
    # Find the most recent backup
    backup_files = [f for f in os.listdir(".") if f.startswith("main_backup_") and f.endswith(".py")]
    
    if not backup_files:
        print("❌ No backup files found - cannot rollback")
        return False
    
    # Get the most recent backup
    backup_files.sort(reverse=True)
    latest_backup = backup_files[0]
    
    try:
        # Restore the backup
        shutil.copy2(latest_backup, "main.py")
        print(f"✅ Restored main.py from {latest_backup}")
        
        print("\n🎉 Rollback completed successfully!")
        print("The original monolithic structure has been restored.")
        
        return True
        
    except Exception as e:
        print(f"❌ Rollback failed: {e}")
        return False

def check_migration_status():
    """Check the current migration status"""
    
    print("🔍 Checking migration status...")
    
    # Check if modular structure exists
    modular_dirs = ["config", "auth", "models", "routers", "utils"]
    modular_exists = all(os.path.exists(d) for d in modular_dirs)
    
    # Check if backup exists
    backup_files = [f for f in os.listdir(".") if f.startswith("main_backup_") and f.endswith(".py")]
    
    # Check main.py size (rough indicator of monolithic vs modular)
    main_py_size = 0
    if os.path.exists("main.py"):
        main_py_size = os.path.getsize("main.py")
    
    print(f"\nStatus Report:")
    print(f"- Modular directories exist: {'✅' if modular_exists else '❌'}")
    print(f"- Backup files found: {len(backup_files)}")
    print(f"- Current main.py size: {main_py_size:,} bytes")
    
    if main_py_size > 50000:  # 50KB threshold
        print("- Architecture: Likely monolithic (large main.py)")
    else:
        print("- Architecture: Likely modular (small main.py)")
    
    if backup_files:
        print(f"- Latest backup: {max(backup_files)}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python migrate_to_modular.py migrate   - Migrate to modular architecture")
        print("  python migrate_to_modular.py rollback  - Rollback to monolithic architecture")
        print("  python migrate_to_modular.py status    - Check migration status")
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == "migrate":
        migrate_to_modular()
    elif command == "rollback":
        rollback_migration()
    elif command == "status":
        check_migration_status()
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)