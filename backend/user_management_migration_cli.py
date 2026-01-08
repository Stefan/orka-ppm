#!/usr/bin/env python3
"""
User Management Migration CLI Tool

A unified command-line interface for all user management migration operations:
- Verification
- End-to-end testing  
- Rollback procedures

Usage:
    python user_management_migration_cli.py verify
    python user_management_migration_cli.py test
    python user_management_migration_cli.py rollback
"""

import sys
import argparse
from user_management_migration_verifier import UserManagementMigrationVerifier
from test_user_management_migration_e2e import UserManagementE2ETester
from user_management_rollback_tool import UserManagementRollbackTool

def main():
    parser = argparse.ArgumentParser(
        description="User Management Migration CLI Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s verify    - Verify migration status
  %(prog)s test      - Run end-to-end tests
  %(prog)s rollback  - Rollback migration
        """
    )
    
    parser.add_argument(
        'command',
        choices=['verify', 'test', 'rollback'],
        help='Command to execute'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )
    
    args = parser.parse_args()
    
    try:
        if args.command == 'verify':
            print("🔍 Running Migration Verification...")
            verifier = UserManagementMigrationVerifier()
            status = verifier.verify_migration_status()
            return 0 if status.verification_passed else 1
            
        elif args.command == 'test':
            print("🧪 Running End-to-End Tests...")
            tester = UserManagementE2ETester()
            success = tester.run_all_tests()
            return 0 if success else 1
            
        elif args.command == 'rollback':
            print("🔄 Starting Rollback Procedure...")
            rollback_tool = UserManagementRollbackTool()
            success = rollback_tool.run_rollback_procedure()
            return 0 if success else 1
            
    except KeyboardInterrupt:
        print("\n❌ Operation cancelled by user")
        return 1
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())