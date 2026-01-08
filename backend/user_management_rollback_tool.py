#!/usr/bin/env python3
"""
User Management Migration Rollback Tool

This tool provides a safe way to rollback the user management migration
with confirmation prompts and backup recommendations.

Requirements: 5.4
"""

import os
import sys
import time
from typing import Dict, List
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class UserManagementRollbackTool:
    """Tool for safely rolling back user management migration"""
    
    def __init__(self):
        self.supabase = self._get_supabase_client()
        
    def _get_supabase_client(self) -> Client:
        """Create Supabase client with service role key"""
        url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not url or not service_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment")
        
        return create_client(url, service_key)
    
    def check_data_exists(self) -> Dict[str, int]:
        """Check if there's data in the tables that would be lost"""
        data_counts = {}
        tables = ['user_profiles', 'user_activity_log', 'admin_audit_log', 'chat_error_log']
        
        for table in tables:
            try:
                result = self.supabase.table(table).select("*", count="exact").limit(1).execute()
                data_counts[table] = result.count if result.count is not None else 0
            except Exception:
                data_counts[table] = 0
        
        return data_counts
    
    def create_backup_script(self) -> str:
        """Generate a backup script for the user to run"""
        backup_script = """
-- User Management Migration Data Backup Script
-- Run this script BEFORE performing rollback to backup your data

-- Backup user_profiles
CREATE TABLE user_profiles_backup AS SELECT * FROM user_profiles;

-- Backup user_activity_log  
CREATE TABLE user_activity_log_backup AS SELECT * FROM user_activity_log;

-- Backup admin_audit_log
CREATE TABLE admin_audit_log_backup AS SELECT * FROM admin_audit_log;

-- Backup chat_error_log
CREATE TABLE chat_error_log_backup AS SELECT * FROM chat_error_log;

-- Verify backups
SELECT 'user_profiles_backup' as table_name, count(*) as record_count FROM user_profiles_backup
UNION ALL
SELECT 'user_activity_log_backup' as table_name, count(*) as record_count FROM user_activity_log_backup
UNION ALL
SELECT 'admin_audit_log_backup' as table_name, count(*) as record_count FROM admin_audit_log_backup
UNION ALL
SELECT 'chat_error_log_backup' as table_name, count(*) as record_count FROM chat_error_log_backup;
"""
        return backup_script
    
    def show_rollback_impact(self, data_counts: Dict[str, int]) -> None:
        """Display what will be affected by the rollback"""
        print("🔍 ROLLBACK IMPACT ANALYSIS")
        print("=" * 50)
        
        total_records = sum(data_counts.values())
        
        if total_records == 0:
            print("✅ No user data will be lost (all tables are empty)")
        else:
            print("⚠️  WARNING: The following data will be PERMANENTLY DELETED:")
            for table, count in data_counts.items():
                if count > 0:
                    print(f"   • {table}: {count} records")
            print(f"\n   Total records to be deleted: {total_records}")
        
        print("\n📋 Database objects that will be removed:")
        print("   • Tables: user_profiles, user_activity_log, admin_audit_log, chat_error_log")
        print("   • Functions: create_user_profile(), update_updated_at_column()")
        print("   • Triggers: on_auth_user_created, update_user_profiles_updated_at")
        print("   • Indexes: All user management related indexes")
        print("   • RLS Policies: All user management security policies")
    
    def confirm_rollback(self) -> bool:
        """Get user confirmation for rollback"""
        print("\n" + "=" * 50)
        print("⚠️  ROLLBACK CONFIRMATION REQUIRED")
        print("=" * 50)
        
        print("This action will:")
        print("1. Delete ALL user management tables and data")
        print("2. Remove all triggers and functions")
        print("3. Remove all indexes and security policies")
        print("4. Cannot be undone without a backup")
        
        print("\nBefore proceeding, you should:")
        print("1. Create a backup of your data")
        print("2. Ensure you have a way to restore if needed")
        print("3. Notify users of potential downtime")
        
        while True:
            response = input("\nDo you want to proceed with the rollback? (yes/no): ").lower().strip()
            if response in ['yes', 'y']:
                return True
            elif response in ['no', 'n']:
                return False
            else:
                print("Please enter 'yes' or 'no'")
    
    def execute_rollback(self) -> bool:
        """Execute the rollback procedure"""
        try:
            print("\n🔄 Executing rollback procedure...")
            
            # Read the rollback SQL script
            script_path = os.path.join(os.path.dirname(__file__), 'migrations', 'rollback_user_management_migration.sql')
            
            if not os.path.exists(script_path):
                print(f"❌ Rollback script not found at: {script_path}")
                return False
            
            with open(script_path, 'r') as f:
                rollback_sql = f.read()
            
            print("📄 Rollback script loaded successfully")
            print("⚠️  Note: Due to Supabase client limitations, you need to run the SQL script manually")
            print(f"📁 Script location: {script_path}")
            
            print("\n📋 Manual rollback steps:")
            print("1. Open Supabase Dashboard")
            print("2. Go to SQL Editor")
            print("3. Copy and paste the rollback script")
            print("4. Execute the script")
            print("5. Verify the rollback was successful")
            
            # We can't execute raw SQL through the Supabase client easily
            # So we'll provide instructions for manual execution
            
            return True
            
        except Exception as e:
            print(f"❌ Rollback execution failed: {str(e)}")
            return False
    
    def verify_rollback(self) -> bool:
        """Verify that the rollback was successful"""
        print("\n🔍 Verifying rollback completion...")
        
        tables_to_check = ['user_profiles', 'user_activity_log', 'admin_audit_log', 'chat_error_log']
        tables_still_exist = []
        
        for table in tables_to_check:
            try:
                self.supabase.table(table).select("*").limit(1).execute()
                tables_still_exist.append(table)
            except Exception:
                # Table doesn't exist or is not accessible - this is expected after rollback
                pass
        
        if tables_still_exist:
            print(f"❌ Rollback incomplete - these tables still exist: {', '.join(tables_still_exist)}")
            return False
        else:
            print("✅ Rollback verification successful - all tables have been removed")
            return True
    
    def run_rollback_procedure(self) -> bool:
        """Run the complete rollback procedure"""
        print("🔄 User Management Migration Rollback Tool")
        print("=" * 60)
        
        try:
            # Check current data
            print("\n1️⃣ Checking current data...")
            data_counts = self.check_data_exists()
            
            # Show impact
            print("\n2️⃣ Analyzing rollback impact...")
            self.show_rollback_impact(data_counts)
            
            # Offer backup script
            if sum(data_counts.values()) > 0:
                print("\n3️⃣ Backup recommendation...")
                backup_script = self.create_backup_script()
                backup_file = "user_management_backup.sql"
                
                with open(backup_file, 'w') as f:
                    f.write(backup_script)
                
                print(f"📄 Backup script created: {backup_file}")
                print("⚠️  STRONGLY RECOMMENDED: Run this backup script before proceeding!")
                
                backup_confirm = input("\nHave you created a backup? (yes/no): ").lower().strip()
                if backup_confirm not in ['yes', 'y']:
                    print("❌ Rollback cancelled - please create a backup first")
                    return False
            
            # Get confirmation
            print("\n4️⃣ Confirmation required...")
            if not self.confirm_rollback():
                print("❌ Rollback cancelled by user")
                return False
            
            # Execute rollback
            print("\n5️⃣ Executing rollback...")
            if not self.execute_rollback():
                print("❌ Rollback execution failed")
                return False
            
            # Wait for user to complete manual steps
            input("\nPress Enter after you have executed the rollback script in Supabase Dashboard...")
            
            # Verify rollback
            print("\n6️⃣ Verifying rollback...")
            if self.verify_rollback():
                print("\n🎉 ROLLBACK COMPLETED SUCCESSFULLY!")
                print("The user management migration has been completely removed.")
                return True
            else:
                print("\n⚠️  ROLLBACK VERIFICATION FAILED!")
                print("Some components may still exist. Please check manually.")
                return False
                
        except Exception as e:
            print(f"❌ Rollback procedure failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

def main():
    """Main function for command-line usage"""
    try:
        rollback_tool = UserManagementRollbackTool()
        success = rollback_tool.run_rollback_procedure()
        
        # Exit with appropriate code
        sys.exit(0 if success else 1)
        
    except Exception as e:
        print(f"❌ Rollback tool failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()