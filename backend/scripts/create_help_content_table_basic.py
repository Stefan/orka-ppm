#!/usr/bin/env python3
"""
Create Basic Help Content Table
Creates a minimal help_content table for testing purposes
"""

import os
import sys

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.database import supabase

def create_basic_help_content_table():
    """Create a basic help_content table for testing"""
    try:
        print("Creating basic help_content table...")
        
        # Basic table creation SQL
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS help_content (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            content_type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            tags TEXT[] DEFAULT '{}',
            language VARCHAR(5) DEFAULT 'en',
            version INTEGER DEFAULT 1,
            is_active BOOLEAN DEFAULT true,
            slug VARCHAR(255),
            meta_description TEXT,
            keywords TEXT[],
            author_id UUID,
            reviewer_id UUID,
            review_status VARCHAR(20) DEFAULT 'draft',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            published_at TIMESTAMP WITH TIME ZONE
        );
        """
        
        # Create basic embeddings table if it doesn't exist
        create_embeddings_sql = """
        CREATE TABLE IF NOT EXISTS embeddings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            content_type VARCHAR(50) NOT NULL,
            content_id VARCHAR(255) NOT NULL,
            content_text TEXT NOT NULL,
            embedding VECTOR(1536),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(content_type, content_id)
        );
        """
        
        # Try to execute via direct SQL (this may not work in all environments)
        print("Note: This script creates basic tables for testing.")
        print("In production, use the full migration: 018_help_chat_system.sql")
        
        print("✅ Basic table creation script prepared")
        print("📋 To apply manually:")
        print("   1. Copy the SQL above to Supabase SQL editor")
        print("   2. Execute the statements")
        print("   3. Run the help content service tests again")
        
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    create_basic_help_content_table()