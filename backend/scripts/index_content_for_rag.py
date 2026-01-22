#!/usr/bin/env python3
"""
Initial Content Indexing Script for RAG System
Indexes all existing projects, portfolios, resources, risks, and issues
"""

import os
import sys
import asyncio
import argparse
from pathlib import Path
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from supabase import create_client, Client
from ai_agents import RAGReporterAgent
from services.content_indexing_service import ContentIndexingService

# Load environment variables
load_dotenv()

def print_banner():
    """Print script banner"""
    print("=" * 70)
    print("RAG Content Indexing Script")
    print("Indexes all content for vector similarity search")
    print("=" * 70)
    print()

async def main(organization_id: str = None, content_types: list = None, batch_mode: bool = False):
    """Main indexing function"""
    
    print_banner()
    
    # Check for required environment variables
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    openai_api_key = os.getenv("OPENAI_API_KEY")
    openai_base_url = os.getenv("OPENAI_BASE_URL")
    
    if not supabase_url or not supabase_key:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        return False
    
    if not openai_api_key:
        print("❌ Error: OPENAI_API_KEY must be set")
        print("   Set it in your .env file or environment variables")
        return False
    
    print("✅ Environment variables configured")
    print(f"   Supabase URL: {supabase_url}")
    print(f"   OpenAI API Key: {'*' * 20}{openai_api_key[-4:]}")
    if openai_base_url:
        print(f"   OpenAI Base URL: {openai_base_url}")
    print()
    
    # Initialize clients
    print("🔄 Initializing clients...")
    supabase: Client = create_client(supabase_url, supabase_key)
    
    rag_agent = RAGReporterAgent(
        supabase_client=supabase,
        openai_api_key=openai_api_key,
        base_url=openai_base_url
    )
    
    indexing_service = ContentIndexingService(supabase, rag_agent)
    print("✅ Clients initialized")
    print()
    
    # Determine what to index
    if content_types:
        print(f"📋 Indexing specific content types: {', '.join(content_types)}")
    else:
        print("📋 Indexing all content types")
        content_types = ["projects", "portfolios", "resources", "risks", "issues"]
    
    if organization_id:
        print(f"🏢 Filtering by organization: {organization_id}")
    else:
        print("🌐 Indexing all organizations")
    print()
    
    # Confirm before proceeding (unless in batch mode)
    if not batch_mode:
        response = input("Continue with indexing? (y/n): ")
        if response.lower() != 'y':
            print("❌ Indexing cancelled")
            return False
        print()
    
    # Start indexing
    start_time = datetime.now()
    print(f"🚀 Starting indexing at {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    results = {}
    
    # Index each content type
    for content_type in content_types:
        print(f"📝 Indexing {content_type}...")
        
        try:
            if content_type == "projects":
                result = await indexing_service.index_projects(organization_id)
            elif content_type == "portfolios":
                result = await indexing_service.index_portfolios(organization_id)
            elif content_type == "resources":
                result = await indexing_service.index_resources(organization_id)
            elif content_type == "risks":
                result = await indexing_service.index_risks(organization_id)
            elif content_type == "issues":
                result = await indexing_service.index_issues(organization_id)
            else:
                print(f"⚠️  Unknown content type: {content_type}")
                continue
            
            results[content_type] = result
            
            # Print result
            if result["success"]:
                print(f"✅ {content_type.capitalize()}: {result['indexed_count']} items indexed")
            else:
                print(f"⚠️  {content_type.capitalize()}: {result['indexed_count']} items indexed with {len(result['errors'])} errors")
                if result['errors']:
                    print(f"   First error: {result['errors'][0]}")
            
        except Exception as e:
            print(f"❌ Error indexing {content_type}: {str(e)}")
            results[content_type] = {
                "content_type": content_type,
                "indexed_count": 0,
                "errors": [str(e)],
                "success": False
            }
        
        print()
    
    # Calculate totals
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    total_indexed = sum(r.get("indexed_count", 0) for r in results.values())
    total_errors = sum(len(r.get("errors", [])) for r in results.values())
    
    # Print summary
    print("=" * 70)
    print("INDEXING SUMMARY")
    print("=" * 70)
    print(f"Total items indexed: {total_indexed}")
    print(f"Total errors: {total_errors}")
    print(f"Duration: {duration:.2f} seconds")
    print(f"Average speed: {total_indexed / duration:.2f} items/second" if duration > 0 else "N/A")
    print()
    
    # Print detailed results
    print("Detailed Results:")
    for content_type, result in results.items():
        status = "✅" if result.get("success") else "⚠️"
        print(f"  {status} {content_type}: {result.get('indexed_count', 0)} items")
        if result.get("errors"):
            print(f"     Errors: {len(result['errors'])}")
    
    print()
    print("=" * 70)
    
    # Check embedding stats
    try:
        print("📊 Checking embedding statistics...")
        stats_result = supabase.rpc('get_embedding_stats', {
            'org_id': organization_id
        }).execute()
        
        if stats_result.data:
            print("\nEmbedding Statistics:")
            for stat in stats_result.data:
                print(f"  - {stat['content_type']}: {stat['count']} embeddings")
                print(f"    Avg text length: {stat['avg_text_length']:.0f} characters")
                print(f"    Latest update: {stat['latest_update']}")
        else:
            print("  No statistics available")
    except Exception as e:
        print(f"⚠️  Could not retrieve statistics: {str(e)}")
    
    print()
    print("=" * 70)
    print("✅ Indexing complete!")
    print("=" * 70)
    
    return total_errors == 0

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Index content for RAG vector search",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Index all content
  python index_content_for_rag.py
  
  # Index specific content types
  python index_content_for_rag.py --types projects portfolios
  
  # Index for specific organization
  python index_content_for_rag.py --org-id <uuid>
  
  # Batch mode (no confirmation prompt)
  python index_content_for_rag.py --batch
        """
    )
    
    parser.add_argument(
        '--org-id',
        type=str,
        help='Organization ID to filter content (optional)'
    )
    
    parser.add_argument(
        '--types',
        nargs='+',
        choices=['projects', 'portfolios', 'resources', 'risks', 'issues'],
        help='Specific content types to index (default: all)'
    )
    
    parser.add_argument(
        '--batch',
        action='store_true',
        help='Run in batch mode without confirmation prompt'
    )
    
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()
    
    try:
        success = asyncio.run(main(
            organization_id=args.org_id,
            content_types=args.types,
            batch_mode=args.batch
        ))
        
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        print("\n\n❌ Indexing interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
