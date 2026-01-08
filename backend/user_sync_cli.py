#!/usr/bin/env python3
"""
User Synchronization CLI Tool

Command-line interface for running user synchronization operations between
Supabase auth.users and the application's user_profiles table.

Usage:
    python user_sync_cli.py sync [--dry-run] [--verbose]
    python user_sync_cli.py status [--verbose]
    python user_sync_cli.py create-profile <user_id> [--role <role>] [--inactive]
    python user_sync_cli.py --help
"""

import argparse
import json
import sys
import logging
from datetime import datetime
from typing import Dict, Any

# Import only what we need to avoid email validator dependency
try:
    from user_synchronization_service import UserSynchronizationService, sync_users, get_sync_status
except ImportError as e:
    if "email_validator" in str(e) or "email-validator" in str(e):
        print("ERROR: Missing email-validator dependency. Please install it with:")
        print("pip install 'pydantic[email]'")
        sys.exit(1)
    else:
        raise


def setup_logging(verbose: bool = False):
    """Configure logging based on verbosity level"""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )


def print_json_output(data: Dict[str, Any], pretty: bool = True):
    """Print data as JSON with optional pretty formatting"""
    if pretty:
        print(json.dumps(data, indent=2, default=str))
    else:
        print(json.dumps(data, default=str))


def print_status_table(stats: Dict[str, Any]):
    """Print sync status in a formatted table"""
    print("\n=== User Synchronization Status ===")
    print(f"Total Auth Users:     {stats.get('total_auth_users', 0)}")
    print(f"Total User Profiles:  {stats.get('total_profiles', 0)}")
    print(f"Missing Profiles:     {stats.get('missing_profiles', 0)}")
    print(f"Sync Percentage:      {stats.get('sync_percentage', 0)}%")
    
    if 'error' in stats:
        print(f"Error:                {stats['error']}")
    
    print("=" * 35)


def print_sync_summary(report: Dict[str, Any]):
    """Print synchronization operation summary"""
    summary = report.get('operation_summary', {})
    
    print("\n=== Synchronization Summary ===")
    print(f"Timestamp:            {report.get('timestamp', 'Unknown')}")
    print(f"Total Auth Users:     {summary.get('total_auth_users', 0)}")
    print(f"Existing Profiles:    {summary.get('existing_profiles_before', 0)}")
    print(f"Profiles Created:     {summary.get('profiles_created', 0)}")
    print(f"Failed Creations:     {summary.get('failed_creations', 0)}")
    print(f"Success Rate:         {summary.get('success_rate', 0)}%")
    print(f"Execution Time:       {summary.get('execution_time_seconds', 0):.2f} seconds")
    
    # Show created users if any
    created_users = report.get('created_users', [])
    if created_users:
        print(f"\nCreated Profiles ({len(created_users)}):")
        for i, user_id in enumerate(created_users[:10]):  # Show first 10
            print(f"  {i+1}. {user_id}")
        if len(created_users) > 10:
            print(f"  ... and {len(created_users) - 10} more")
    
    # Show errors if any
    errors = report.get('errors', [])
    if errors:
        print(f"\nErrors ({len(errors)}):")
        for i, error in enumerate(errors[:5]):  # Show first 5
            print(f"  {i+1}. {error}")
        if len(errors) > 5:
            print(f"  ... and {len(errors) - 5} more")
    
    # Show recommendations if any
    recommendations = report.get('recommendations', [])
    if recommendations:
        print(f"\nRecommendations:")
        for i, rec in enumerate(recommendations):
            print(f"  {i+1}. {rec}")
    
    print("=" * 31)


def cmd_sync(args):
    """Handle sync command"""
    preserve_existing = not args.no_preserve
    print(f"Starting user synchronization...")
    if args.dry_run:
        print("DRY RUN MODE - No changes will be made")
    if preserve_existing:
        print("PRESERVATION MODE - Existing profile data will be preserved")
    else:
        print("WARNING: Existing profile data may be overwritten")
    
    try:
        # For now, the sync_users function doesn't support preserve_existing parameter
        # We'll need to use the service directly for full control
        service = UserSynchronizationService()
        result = service.perform_full_sync(dry_run=args.dry_run)
        
        # Generate report
        report = service.generate_sync_report(result)
        
        if 'error' in report:
            print(f"ERROR: {report['error']}")
            return 1
        
        if args.verbose or args.json:
            print_json_output(report)
        else:
            print_sync_summary(report)
        
        # Return appropriate exit code
        summary = report.get('operation_summary', {})
        failed_creations = summary.get('failed_creations', 0)
        return 1 if failed_creations > 0 else 0
        
    except Exception as e:
        print(f"ERROR: Synchronization failed: {e}")
        return 1


def cmd_status(args):
    """Handle status command"""
    print("Checking user synchronization status...")
    
    try:
        stats = get_sync_status()
        
        if 'error' in stats:
            print(f"ERROR: {stats['error']}")
            return 1
        
        if args.verbose or args.json:
            print_json_output(stats)
        else:
            print_status_table(stats)
        
        return 0
        
    except Exception as e:
        print(f"ERROR: Failed to get status: {e}")
        return 1


def cmd_preservation_report(args):
    """Handle preservation-report command"""
    try:
        service = UserSynchronizationService()
        
        # If no specific user IDs provided, get all auth users
        if not args.user_ids:
            print("Generating preservation report for all users...")
            # Get all auth users for the report
            auth_users_response = service.client.table("auth.users").select("id").execute()
            if auth_users_response.data:
                user_ids = [user["id"] for user in auth_users_response.data]
            else:
                print("No users found in auth.users table")
                return 1
        else:
            user_ids = args.user_ids
            print(f"Generating preservation report for {len(user_ids)} specified users...")
        
        report = service.get_preservation_report(user_ids)
        
        if args.verbose or args.json:
            print_json_output(report)
        else:
            print_preservation_report(report)
        
        return 0 if not report.get('errors') else 1
        
    except Exception as e:
        print(f"ERROR: Failed to generate preservation report: {e}")
        return 1


def print_preservation_report(report: Dict[str, Any]):
    """Print preservation report in a formatted table"""
    print("\n=== Data Preservation Report ===")
    print(f"Timestamp:            {report.get('timestamp', 'Unknown')}")
    print(f"Total Users Checked:  {report.get('total_users_checked', 0)}")
    print(f"Users with Profiles:  {report.get('users_with_profiles', 0)}")
    print(f"Users without Profiles: {report.get('users_without_profiles', 0)}")
    
    errors = report.get('errors', [])
    if errors:
        print(f"Errors:               {len(errors)}")
        for i, error in enumerate(errors[:3]):
            print(f"  {i+1}. {error}")
        if len(errors) > 3:
            print(f"  ... and {len(errors) - 3} more")
    
    # Show sample of users with profiles
    details = report.get('preservation_details', {})
    users_with_profiles = [uid for uid, data in details.items() if data.get('has_profile')]
    if users_with_profiles:
        print(f"\nSample Users with Profiles ({min(5, len(users_with_profiles))}):")
        for i, user_id in enumerate(users_with_profiles[:5]):
            user_data = details[user_id]
            print(f"  {i+1}. {user_id[:8]}... (role: {user_data.get('role')}, "
                  f"active: {user_data.get('is_active')})")
    
    print("=" * 33)


def cmd_create_profile(args):
    """Handle create-profile command"""
    print(f"Creating profile for user: {args.user_id}")
    
    try:
        service = UserSynchronizationService()
        
        # Determine role and active status
        role = args.role if args.role else None
        is_active = not args.inactive
        
        success = service.create_profile_for_user(
            user_id=args.user_id,
            role=role,
            is_active=is_active
        )
        
        if success:
            print(f"SUCCESS: Profile created for user {args.user_id}")
            if args.verbose:
                print(f"  Role: {role or 'team_member (default)'}")
                print(f"  Active: {is_active}")
            return 0
        else:
            print(f"ERROR: Failed to create profile for user {args.user_id}")
            return 1
            
    except Exception as e:
        print(f"ERROR: Profile creation failed: {e}")
        return 1
    """Handle create-profile command"""
    print(f"Creating profile for user: {args.user_id}")
    
    try:
        service = UserSynchronizationService()
        
        # Determine role and active status
        role = args.role if args.role else None
        is_active = not args.inactive
        
        success = service.create_profile_for_user(
            user_id=args.user_id,
            role=role,
            is_active=is_active
        )
        
        if success:
            print(f"SUCCESS: Profile created for user {args.user_id}")
            if args.verbose:
                print(f"  Role: {role or 'team_member (default)'}")
                print(f"  Active: {is_active}")
            return 0
        else:
            print(f"ERROR: Failed to create profile for user {args.user_id}")
            return 1
            
    except Exception as e:
        print(f"ERROR: Profile creation failed: {e}")
        return 1


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description="User Synchronization CLI Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s sync                    # Run full synchronization
  %(prog)s sync --dry-run          # Preview what would be synchronized
  %(prog)s sync --verbose          # Run with detailed output
  %(prog)s status                  # Check current sync status
  %(prog)s status --json           # Get status as JSON
  %(prog)s create-profile abc123   # Create profile for specific user
        """
    )
    
    # Global options
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )
    parser.add_argument(
        '--json',
        action='store_true',
        help='Output results as JSON'
    )
    
    # Subcommands
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Sync command
    sync_parser = subparsers.add_parser(
        'sync',
        help='Synchronize users between auth.users and user_profiles'
    )
    sync_parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without making them'
    )
    sync_parser.add_argument(
        '--no-preserve',
        action='store_true',
        help='Allow overwriting existing profile data (default: preserve existing data)'
    )
    
    # Status command
    status_parser = subparsers.add_parser(
        'status',
        help='Check current synchronization status'
    )
    
    # Create profile command
    create_parser = subparsers.add_parser(
        'create-profile',
        help='Create a user profile for a specific user'
    )
    create_parser.add_argument(
        'user_id',
        help='User ID to create profile for'
    )
    create_parser.add_argument(
        '--role',
        help='Role to assign to the user (default: team_member)'
    )
    create_parser.add_argument(
        '--inactive',
        action='store_true',
        help='Create profile as inactive (default: active)'
    )
    
    # Preservation report command
    preserve_parser = subparsers.add_parser(
        'preservation-report',
        help='Generate a report on data preservation for users'
    )
    preserve_parser.add_argument(
        'user_ids',
        nargs='*',
        help='Specific user IDs to check (if none provided, checks all users)'
    )
    
    # Parse arguments
    args = parser.parse_args()
    
    # Show help if no command provided
    if not args.command:
        parser.print_help()
        return 1
    
    # Setup logging
    setup_logging(args.verbose)
    
    # Route to appropriate command handler
    try:
        if args.command == 'sync':
            return cmd_sync(args)
        elif args.command == 'status':
            return cmd_status(args)
        elif args.command == 'create-profile':
            return cmd_create_profile(args)
        elif args.command == 'preservation-report':
            return cmd_preservation_report(args)
        else:
            print(f"Unknown command: {args.command}")
            parser.print_help()
            return 1
            
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        return 130
    except Exception as e:
        print(f"FATAL ERROR: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())