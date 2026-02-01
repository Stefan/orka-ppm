#!/usr/bin/env python3
"""
Apply AI-Empowered Audit Trail Migration

This script applies the AI-empowered audit trail schema migration to the database.
It extends the audit_logs table and creates new tables for:
- audit_embeddings (semantic search with pgvector)
- audit_anomalies (anomaly detection tracking)
- audit_ml_models (ML model version management)
- audit_integrations (external tool configurations)
- audit_scheduled_reports (automated reporting)
- audit_access_log (meta-audit logging)
- audit_bias_metrics (AI fairness tracking)
- audit_ai_predictions (AI prediction logging)

Requirements: 1.3, 1.4, 1.8, 3.10, 4.1, 4.4, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 6.2, 9.1, 9.4, 9.5
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    """Create and return Supabase client."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment"
        )
    
    return create_client(url, key)

def read_migration_file() -> str:
    """Read the migration SQL file."""
    migration_path = Path(__file__).parent / "023_ai_empowered_audit_trail.sql"
    
    if not migration_path.exists():
        raise FileNotFoundError(f"Migration file not found: {migration_path}")
    
    with open(migration_path, 'r') as f:
        return f.read()

def apply_migration(client: Client, sql: str) -> None:
    """Apply the migration SQL to the database."""
    print("Applying AI-Empowered Audit Trail migration...")
    print("=" * 80)
    
    try:
        # Execute the migration SQL
        # Note: Supabase Python client doesn't directly support raw SQL execution
        # You may need to use psycopg2 or execute via Supabase SQL editor
        print("⚠️  Note: This script prepares the migration.")
        print("⚠️  Execute the SQL file via Supabase SQL editor or psycopg2.")
        print()
        print("Migration SQL file: backend/migrations/023_ai_empowered_audit_trail.sql")
        print()
        print("Tables to be created/modified:")
        print("  1. audit_logs (extended with AI fields)")
        print("  2. audit_embeddings (new)")
        print("  3. audit_anomalies (new)")
        print("  4. audit_ml_models (new)")
        print("  5. audit_integrations (new)")
        print("  6. audit_scheduled_reports (new)")
        print("  7. audit_access_log (new)")
        print("  8. audit_bias_metrics (new)")
        print("  9. audit_ai_predictions (new)")
        print()
        print("✓ Migration file is ready to be applied")
        
    except Exception as e:
        print(f"✗ Error applying migration: {e}")
        raise

def verify_migration(client: Client) -> None:
    """Verify that the migration was applied successfully."""
    print("\nVerifying migration...")
    print("=" * 80)
    
    tables_to_check = [
        "audit_embeddings",
        "audit_anomalies",
        "audit_ml_models",
        "audit_integrations",
        "audit_scheduled_reports",
        "audit_access_log",
        "audit_bias_metrics",
        "audit_ai_predictions"
    ]
    
    print("Tables to verify:")
    for table in tables_to_check:
        print(f"  - {table}")
    
    print("\n⚠️  Manual verification required via Supabase dashboard or SQL query:")
    print("  SELECT table_name FROM information_schema.tables")
    print("  WHERE table_schema = 'public'")
    print("  AND table_name LIKE 'audit_%';")

def main():
    """Main execution function."""
    print("AI-Empowered Audit Trail Migration Script")
    print("=" * 80)
    print()
    
    try:
        # Get Supabase client
        client = get_supabase_client()
        print("✓ Connected to Supabase")
        print()
        
        # Read migration file
        sql = read_migration_file()
        print("✓ Migration file loaded")
        print()
        
        # Apply migration
        apply_migration(client, sql)
        
        # Verify migration
        verify_migration(client)
        
        print()
        print("=" * 80)
        print("Migration preparation complete!")
        print()
        print("Next steps:")
        print("1. Review the migration SQL file")
        print("2. Execute via Supabase SQL editor or psycopg2")
        print("3. Verify tables were created successfully")
        print("4. Test with sample data")
        
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
