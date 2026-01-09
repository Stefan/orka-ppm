#!/usr/bin/env python3
"""
Weekly Analytics Report Generator
Generates and optionally emails weekly help chat analytics reports.
Can be run as a scheduled task (cron job).
"""

import asyncio
import argparse
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
import sys
import os

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.analytics_tracker import get_analytics_tracker
from config.database import supabase

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def generate_weekly_report(week_start: datetime = None, output_file: str = None, email_recipients: list = None):
    """Generate weekly analytics report"""
    try:
        analytics_tracker = get_analytics_tracker()
        
        # Generate the report
        logger.info("Generating weekly analytics report...")
        report = await analytics_tracker.generate_weekly_report(week_start)
        
        # Format report for output
        report_data = {
            "report_generated": datetime.now().isoformat(),
            "report_period": {
                "week_start": report.week_start.isoformat(),
                "week_end": report.week_end.isoformat()
            },
            "summary": {
                "total_queries": report.metrics.total_queries,
                "unique_users": report.metrics.unique_users,
                "avg_response_time_ms": round(report.metrics.avg_response_time, 2),
                "satisfaction_rate_percent": round(report.metrics.satisfaction_rate, 1)
            },
            "detailed_metrics": {
                "category_distribution": report.metrics.category_distribution,
                "effectiveness_distribution": report.metrics.effectiveness_distribution,
                "top_queries": report.metrics.top_queries,
                "common_issues": report.metrics.common_issues
            },
            "trends": report.trends,
            "recommendations": report.recommendations
        }
        
        # Output to file if specified
        if output_file:
            output_path = Path(output_file)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, 'w') as f:
                json.dump(report_data, f, indent=2, default=str)
            
            logger.info(f"Report saved to: {output_path}")
        
        # Print summary to console
        print("\n" + "="*60)
        print("HELP CHAT WEEKLY ANALYTICS REPORT")
        print("="*60)
        print(f"Period: {report.week_start.strftime('%Y-%m-%d')} to {report.week_end.strftime('%Y-%m-%d')}")
        print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("\n" + "-"*40)
        print("SUMMARY METRICS")
        print("-"*40)
        print(f"Total Queries: {report.metrics.total_queries}")
        print(f"Unique Users: {report.metrics.unique_users}")
        print(f"Avg Response Time: {report.metrics.avg_response_time:.0f}ms")
        print(f"Satisfaction Rate: {report.metrics.satisfaction_rate:.1f}%")
        
        if report.metrics.category_distribution:
            print("\n" + "-"*40)
            print("QUESTION CATEGORIES")
            print("-"*40)
            for category, count in sorted(report.metrics.category_distribution.items(), key=lambda x: x[1], reverse=True):
                percentage = (count / report.metrics.total_queries) * 100 if report.metrics.total_queries > 0 else 0
                print(f"{category.replace('_', ' ').title()}: {count} ({percentage:.1f}%)")
        
        if report.trends:
            print("\n" + "-"*40)
            print("TRENDS (vs Previous Week)")
            print("-"*40)
            for trend_name, value in report.trends.items():
                trend_display = trend_name.replace('_', ' ').title()
                if 'change' in trend_name:
                    sign = "+" if value > 0 else ""
                    print(f"{trend_display}: {sign}{value}%")
        
        if report.recommendations:
            print("\n" + "-"*40)
            print("RECOMMENDATIONS")
            print("-"*40)
            for i, rec in enumerate(report.recommendations, 1):
                print(f"{i}. {rec}")
        
        print("\n" + "="*60)
        
        # Email report if recipients specified
        if email_recipients:
            await send_email_report(report_data, email_recipients)
        
        return report_data
        
    except Exception as e:
        logger.error(f"Failed to generate weekly report: {e}")
        raise

async def send_email_report(report_data: dict, recipients: list):
    """Send email report (placeholder - implement with your email service)"""
    logger.info(f"Email functionality not implemented. Would send report to: {recipients}")
    # TODO: Implement email sending using your preferred email service
    # This could use SendGrid, AWS SES, or other email services
    pass

def parse_date(date_string: str) -> datetime:
    """Parse date string in various formats"""
    formats = ['%Y-%m-%d', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S']
    
    for fmt in formats:
        try:
            return datetime.strptime(date_string, fmt)
        except ValueError:
            continue
    
    raise ValueError(f"Unable to parse date: {date_string}")

async def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Generate weekly help chat analytics report")
    parser.add_argument(
        '--week-start',
        type=str,
        help='Week start date (YYYY-MM-DD). Defaults to last Monday.'
    )
    parser.add_argument(
        '--output',
        type=str,
        help='Output file path for JSON report'
    )
    parser.add_argument(
        '--email',
        type=str,
        nargs='+',
        help='Email recipients for the report'
    )
    parser.add_argument(
        '--quiet',
        action='store_true',
        help='Suppress console output'
    )
    
    args = parser.parse_args()
    
    # Parse week start date
    week_start = None
    if args.week_start:
        try:
            week_start = parse_date(args.week_start)
        except ValueError as e:
            logger.error(f"Invalid date format: {e}")
            return 1
    
    # Set logging level
    if args.quiet:
        logging.getLogger().setLevel(logging.WARNING)
    
    try:
        # Generate report
        await generate_weekly_report(
            week_start=week_start,
            output_file=args.output,
            email_recipients=args.email
        )
        
        logger.info("Weekly report generation completed successfully")
        return 0
        
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)