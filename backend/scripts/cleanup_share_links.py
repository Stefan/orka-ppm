#!/usr/bin/env python3
"""
Scheduled cleanup script for share links and access logs.

This script should be run periodically (e.g., daily via cron) to:
- Clean up expired share links
- Archive old access logs
- Maintain database performance

Usage:
    python cleanup_share_links.py [--grace-period DAYS] [--retention DAYS] [--dry-run]

Examples:
    # Run with default settings (7 day grace period, 90 day log retention)
    python cleanup_share_links.py
    
    # Run with custom settings
    python cleanup_share_links.py --grace-period 14 --retention 180
    
    # Dry run to see what would be cleaned without making changes
    python cleanup_share_links.py --dry-run
"""

import asyncio
import argparse
import sys
import logging
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.share_link_cleanup import ShareLinkCleanupService


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('share_link_cleanup.log')
    ]
)

logger = logging.getLogger(__name__)


async def main():
    """Main cleanup execution function."""
    parser = argparse.ArgumentParser(
        description='Clean up expired share links and old access logs'
    )
    parser.add_argument(
        '--grace-period',
        type=int,
        default=7,
        help='Grace period in days before cleaning expired links (default: 7)'
    )
    parser.add_argument(
        '--retention',
        type=int,
        default=90,
        help='Retention period in days for access logs (default: 90)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be cleaned without making changes'
    )
    parser.add_argument(
        '--stats-only',
        action='store_true',
        help='Only show statistics without performing cleanup'
    )
    
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info("Share Link Cleanup Script")
    logger.info("=" * 60)
    logger.info(f"Grace period: {args.grace_period} days")
    logger.info(f"Log retention: {args.retention} days")
    logger.info(f"Dry run: {args.dry_run}")
    logger.info(f"Stats only: {args.stats_only}")
    logger.info("=" * 60)
    
    try:
        # Initialize cleanup service
        cleanup_service = ShareLinkCleanupService()
        
        # Get current statistics
        logger.info("\nFetching current statistics...")
        stats = await cleanup_service.get_cleanup_statistics()
        
        if 'error' in stats:
            logger.error(f"Error getting statistics: {stats['error']}")
            return 1
        
        logger.info("\nCurrent Statistics:")
        logger.info(f"  Share Links:")
        logger.info(f"    Total: {stats['share_links']['total']}")
        logger.info(f"    Active: {stats['share_links']['active']}")
        logger.info(f"    Expired (pending cleanup): {stats['share_links']['expired_pending_cleanup']}")
        logger.info(f"    Inactive: {stats['share_links']['inactive']}")
        logger.info(f"  Access Logs:")
        logger.info(f"    Total: {stats['access_logs']['total']}")
        logger.info(f"    Last 30 days: {stats['access_logs']['last_30_days']}")
        logger.info(f"    Older than 30 days: {stats['access_logs']['older_than_30_days']}")
        
        # If stats-only mode, exit here
        if args.stats_only:
            logger.info("\nStats-only mode: Exiting without cleanup")
            return 0
        
        # If dry-run mode, show what would be cleaned
        if args.dry_run:
            logger.info("\nDry-run mode: No changes will be made")
            logger.info(f"Would clean up {stats['share_links']['expired_pending_cleanup']} expired share links")
            logger.info(f"Would archive approximately {stats['access_logs']['older_than_30_days']} old access logs")
            return 0
        
        # Perform actual cleanup
        logger.info("\nStarting cleanup operations...")
        
        # Clean up expired share links
        logger.info(f"\nCleaning up expired share links (grace period: {args.grace_period} days)...")
        expired_result = await cleanup_service.cleanup_expired_share_links(args.grace_period)
        
        if 'error' in expired_result:
            logger.error(f"Error cleaning expired links: {expired_result['error']}")
        else:
            logger.info(f"✓ Cleaned up {expired_result['cleaned_count']} expired share links")
        
        # Archive old access logs
        logger.info(f"\nArchiving old access logs (retention: {args.retention} days)...")
        archive_result = await cleanup_service.archive_old_access_logs(args.retention)
        
        if 'error' in archive_result:
            logger.error(f"Error archiving logs: {archive_result['error']}")
        else:
            logger.info(f"✓ Archived {archive_result['archived_count']} old access logs")
        
        # Get updated statistics
        logger.info("\nFetching updated statistics...")
        updated_stats = await cleanup_service.get_cleanup_statistics()
        
        if 'error' not in updated_stats:
            logger.info("\nUpdated Statistics:")
            logger.info(f"  Share Links:")
            logger.info(f"    Total: {updated_stats['share_links']['total']}")
            logger.info(f"    Active: {updated_stats['share_links']['active']}")
            logger.info(f"    Expired (pending cleanup): {updated_stats['share_links']['expired_pending_cleanup']}")
            logger.info(f"  Access Logs:")
            logger.info(f"    Total: {updated_stats['access_logs']['total']}")
        
        logger.info("\n" + "=" * 60)
        logger.info("Cleanup completed successfully")
        logger.info("=" * 60)
        
        return 0
        
    except Exception as e:
        logger.error(f"Fatal error during cleanup: {str(e)}", exc_info=True)
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
