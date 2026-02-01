#!/usr/bin/env python3
"""
Import Documentation Script for RAG Knowledge Base
Imports documentation files from the docs/ directory into the knowledge base
"""

import os
import sys
import asyncio
import glob
import uuid
from pathlib import Path
from typing import List, Dict, Any
import logging

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ingestion_orchestrator import IngestionOrchestrator
from services.document_parser import DocumentParser, DocumentFormat
from services.text_chunker import TextChunker
from services.embedding_service import EmbeddingService
from services.vector_store import VectorStore
from config.database import get_db
from config.settings import settings
from config.settings import settings

logger = logging.getLogger(__name__)


class DocumentationImporter:
    """Imports documentation files into the knowledge base"""

    def __init__(self):
        self.db_connection = get_db()
        self.document_parser = DocumentParser()
        self.text_chunker = TextChunker()
        self.embedding_service = EmbeddingService(api_key=settings.OPENAI_API_KEY)
        self.vector_store = VectorStore(self.db_connection)
        self.ingestion_orchestrator = IngestionOrchestrator(
            parser=self.document_parser,
            chunker=self.text_chunker,
            embedding_service=self.embedding_service,
            vector_store=self.vector_store,
            db_connection=self.db_connection
        )

    async def import_documentation_directory(self, docs_dir: str = "docs") -> Dict[str, Any]:
        """
        Import all documentation files from a directory.

        Args:
            docs_dir: Directory containing documentation files

        Returns:
            Import statistics
        """
        docs_path = Path(docs_dir)
        if not docs_path.exists():
            raise FileNotFoundError(f"Documentation directory not found: {docs_dir}")

        # Find all markdown files
        markdown_files = list(docs_path.rglob("*.md"))
        logger.info(f"Found {len(markdown_files)} markdown files to import")

        stats = {
            "total_files": len(markdown_files),
            "successful_imports": 0,
            "failed_imports": 0,
            "errors": []
        }

        for md_file in markdown_files:
            try:
                logger.info(f"Importing: {md_file}")
                await self._import_single_document(md_file)
                stats["successful_imports"] += 1
                print(f"✓ Imported: {md_file.name}")

            except Exception as e:
                error_msg = f"Failed to import {md_file}: {str(e)}"
                logger.error(error_msg)
                stats["failed_imports"] += 1
                stats["errors"].append(error_msg)
                print(f"✗ Failed: {md_file.name} - {str(e)}")

        logger.info(f"Import completed: {stats['successful_imports']} successful, {stats['failed_imports']} failed")
        return stats

    async def _import_single_document(self, file_path: Path):
        """Import a single documentation file"""
        # Read file content
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract title from filename or first heading
        title = self._extract_title(file_path, content)

        # Determine category from file path
        category = self._determine_category(file_path)

        # Create metadata
        metadata = {
            "title": title,
            "category": category,
            "source": str(file_path),
            "file_path": str(file_path),
            "keywords": self._extract_keywords(content, category),
            "access_control": {
                "roles": ["user", "manager", "admin"]  # All roles can access documentation
            }
        }

        # Create document structure
        document_data = {
            "title": title,
            "content": content,
            "category": category,
            "keywords": metadata["keywords"],
            "metadata": metadata,
            "access_control": metadata["access_control"]
        }

        # Ingest document
        await self.ingestion_orchestrator.ingest_document(
            document_id=str(uuid.uuid4()),
            content=document_data["content"],
            format=DocumentFormat.MARKDOWN,
            metadata=document_data
        )

    def _extract_title(self, file_path: Path, content: str) -> str:
        """Extract document title from filename or content"""
        # Try to get title from first heading
        lines = content.split('\n')
        for line in lines[:10]:  # Check first 10 lines
            line = line.strip()
            if line.startswith('# '):
                return line[2:].strip()

        # Fallback to filename
        return file_path.stem.replace('-', ' ').replace('_', ' ').title()

    def _determine_category(self, file_path: Path) -> str:
        """Determine document category from file path"""
        path_parts = file_path.parts

        # Map path segments to categories
        category_mapping = {
            "audit": "audit",
            "baseline": "baseline-management",
            "dashboard": "dashboard",
            "pmr": "pmr",
            "project": "projects",
            "resource": "resources",
            "risk": "risks",
            "schedule": "schedule-management",
            "scenario": "scenarios",
            "variance": "variance-tracking",
            "workflow": "workflows",
            "user-acceptance-testing": "testing",
            "frontend": "frontend",
            "help-chat": "help-chat",
            "i18n": "i18n",
            "security": "security",
            "deployment": "deployment",
            "ci": "ci-cd",
            "design": "design-system",
            "service": "service-worker",
            "real-time": "real-time-updates",
            "sap": "sap-integration"
        }

        for part in path_parts:
            part_lower = part.lower()
            for key, category in category_mapping.items():
                if key in part_lower:
                    return category

        return "general"

    def _extract_keywords(self, content: str, category: str) -> List[str]:
        """Extract keywords from document content"""
        keywords = []

        # Add category-specific keywords
        category_keywords = {
            "dashboard": ["dashboard", "overview", "summary", "metrics"],
            "projects": ["project", "projects", "task", "tasks", "milestone"],
            "resources": ["resource", "resources", "allocation", "capacity"],
            "financial": ["budget", "cost", "financial", "forecast"],
            "risks": ["risk", "risks", "mitigation", "probability"],
            "pmr": ["pmr", "performance", "measurement", "report"],
            "audit": ["audit", "trail", "history", "compliance"],
            "workflows": ["workflow", "approval", "process", "automation"]
        }

        keywords.extend(category_keywords.get(category, []))

        # Extract technical terms (simplified)
        technical_terms = [
            "api", "database", "frontend", "backend", "deployment",
            "integration", "testing", "monitoring", "security"
        ]

        content_lower = content.lower()
        for term in technical_terms:
            if term in content_lower:
                keywords.append(term)

        # Remove duplicates and return
        return list(set(keywords))


async def main():
    """Main import function"""
    logging.basicConfig(level=logging.INFO)

    importer = DocumentationImporter()

    try:
        # Import documentation
        stats = await importer.import_documentation_directory()

        print("\n" + "="*50)
        print("DOCUMENTATION IMPORT SUMMARY")
        print("="*50)
        print(f"Total files: {stats['total_files']}")
        print(f"Successful imports: {stats['successful_imports']}")
        print(f"Failed imports: {stats['failed_imports']}")

        if stats['errors']:
            print("\nErrors:")
            for error in stats['errors']:
                print(f"  - {error}")

        print("\nImport completed successfully!")

    except Exception as e:
        logger.error(f"Import failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())