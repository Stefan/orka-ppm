#!/usr/bin/env python3
"""
Index Documentation Script
Automatically indexes documentation for the Help Chat RAG system:
- docs/ folder (user and developer guides)
- .kiro/specs/ (requirements, design, tasks - single source of truth for features)
"""

import os
import sys
import asyncio
from pathlib import Path
from datetime import datetime

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from config.database import supabase
from ai_agents import RAGReporterAgent

# Load environment variables
load_dotenv()

async def index_documentation():
    """Index all documentation files"""
    print("🔍 Starting documentation indexing...")
    print()
    
    # Get API key
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")
    
    if not api_key:
        print("❌ Error: OPENAI_API_KEY not found in environment")
        return False
    
    print(f"✓ API Key found")
    print(f"✓ Base URL: {base_url or 'Default OpenAI'}")
    print()
    
    # Initialize RAG agent
    print("📚 Initializing RAG agent...")
    agent = RAGReporterAgent(supabase, api_key, base_url=base_url)
    print("✓ RAG agent initialized")
    print()
    
    # Find all documentation files: docs/ and .kiro/specs/
    repo_root = Path(__file__).parent.parent.parent
    docs_dir = repo_root / "docs"
    specs_dir = repo_root / ".kiro" / "specs"

    doc_files = []
    if docs_dir.exists():
        doc_files.extend(docs_dir.glob("**/*.md"))
        print(f"📂 Scanning documentation directory: {docs_dir}")
        print(f"   Found {len(list(docs_dir.glob('**/*.md')))} docs/*.md files")
    if specs_dir.exists():
        spec_files = list(specs_dir.glob("**/*.md"))
        doc_files.extend(spec_files)
        print(f"📂 Scanning specs directory: {specs_dir}")
        print(f"   Found {len(spec_files)} .kiro/specs/*.md files (requirements, design, tasks)")
    if not doc_files:
        print("❌ Error: No documentation or spec files found (docs/ or .kiro/specs/)")
        return False

    print(f"✓ Total: {len(doc_files)} markdown files to index")
    print()

    # Index documentation files
    print("📝 Indexing documentation files...")
    indexed_count = 0
    errors = []

    for doc_file in doc_files:
        try:
            # Read file content
            with open(doc_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Skip empty files
            if not content.strip():
                print(f"⏭️  Skipping empty file: {doc_file.name}")
                continue
            
            # Generate content ID and relative path (docs vs specs)
            try:
                relative_path = doc_file.relative_to(repo_root)
            except ValueError:
                relative_path = doc_file
            path_str = str(relative_path).replace('\\', '/')
            content_id = f"doc_{path_str.replace('/', '_').replace('.md', '')}"
            source = "specs" if ".kiro" in path_str and "specs" in path_str else "docs"

            # Extract title from first heading or filename
            title = doc_file.stem.replace('-', ' ').replace('_', ' ').title()
            first_line = content.split('\n')[0] if content.strip() else ''
            if first_line.startswith('#'):
                title = first_line.lstrip('#').strip()

            # Store embedding (use 'document' as content_type - it's allowed by the DB constraint)
            await agent.store_content_embedding(
                content_type="document",
                content_id=content_id,
                content_text=content,
                metadata={
                    "file_path": path_str,
                    "file_name": doc_file.name,
                    "title": title,
                    "source": source,
                    "indexed_at": datetime.now().isoformat()
                }
            )
            
            print(f"✅ Indexed: {doc_file.name}")
            indexed_count += 1
            
        except Exception as e:
            error_msg = f"{doc_file.name}: {str(e)}"
            errors.append(error_msg)
            print(f"❌ Error: {error_msg}")
    
    print()
    print("=" * 60)
    print("Indexing Results")
    print("=" * 60)
    print(f"✅ Indexed: {indexed_count} documentation files")
    print(f"❌ Errors: {len(errors)} files")
    
    if errors:
        print()
        print("Errors:")
        for error in errors[:5]:  # Show first 5 errors
            print(f"  - {error}")
        if len(errors) > 5:
            print(f"  ... and {len(errors) - 5} more")
    
    print()
    success = len(errors) == 0
    if success:
        print(f"✅ Successfully indexed all {indexed_count} documentation files!")
    else:
        print(f"⚠️  Indexed {indexed_count} files with {len(errors)} errors")
    print()
    
    return success

async def index_specific_file(file_path: str):
    """Index a specific documentation file"""
    print(f"🔍 Indexing specific file: {file_path}")
    print()
    
    if not os.path.exists(file_path):
        print(f"❌ Error: File not found: {file_path}")
        return False
    
    # Get API key
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")
    
    if not api_key:
        print("❌ Error: OPENAI_API_KEY not found in environment")
        return False
    
    # Initialize RAG agent
    agent = RAGReporterAgent(supabase, api_key, base_url=base_url)
    
    # Read file content
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Generate embedding and store
    file_name = os.path.basename(file_path)
    content_id = f"doc_{file_name.replace('.md', '').replace('.', '_')}"
    
    try:
        await agent.store_content_embedding(
            content_type="documentation",
            content_id=content_id,
            content_text=content,
            metadata={
                "file_path": file_path,
                "file_name": file_name,
                "indexed_at": str(asyncio.get_event_loop().time())
            }
        )
        print(f"✅ Successfully indexed: {file_name}")
        return True
    except Exception as e:
        print(f"❌ Error indexing {file_name}: {e}")
        return False

def main():
    """Main function"""
    if len(sys.argv) > 1:
        # Index specific file
        file_path = sys.argv[1]
        success = asyncio.run(index_specific_file(file_path))
    else:
        # Index all documentation
        success = asyncio.run(index_documentation())
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
