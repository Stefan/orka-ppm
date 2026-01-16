#!/usr/bin/env python3
"""
Verify AI-Empowered Audit Trail Migration

This script verifies that the AI-empowered audit trail schema migration
was applied successfully by checking:
1. All required tables exist
2. All required columns exist in roche_audit_logs
3. All required indexes exist
4. Constraints are properly configured
"""

import os
import sys
from pathlib import Path
from typing import List, Dict, Any

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

def check_table_exists(client: Client, table_name: str) -> bool:
    """Check if a table exists in the database."""
    try:
        # Try to query the table (will fail if it doesn't exist)
        result = client.table(table_name).select("*").limit(0).execute()
        return True
    except Exception:
        return False

def verify_tables(client: Client) -> Dict[str, bool]:
    """Verify that all required tables exist."""
    print("Checking tables...")
    print("-" * 80)
    
    required_tables = [
        "roche_audit_logs",
        "audit_embeddings",
        "audit_anomalies",
        "audit_ml_models",
        "audit_integrations",
        "audit_scheduled_reports",
        "audit_access_log",
        "audit_bias_metrics",
        "audit_ai_predictions"
    ]
    
    results = {}
    for table in required_tables:
        exists = check_table_exists(client, table)
        results[table] = exists
        status = "✓" if exists else "✗"
        print(f"  {status} {table}")
    
    return results

def verify_roche_audit_logs_columns(client: Client) -> Dict[str, bool]:
    """Verify that roche_audit_logs has all required AI columns."""
    print("\nChecking roche_audit_logs AI columns...")
    print("-" * 80)
    
    required_columns = [
        "anomaly_score",
        "is_anomaly",
        "category",
        "risk_level",
        "tags",
        "ai_insights",
        "tenant_id",
        "hash",
        "previous_hash"
    ]
    
    results = {}
    
    # Note: Supabase Python client doesn't provide direct schema introspection
    # This is a placeholder for manual verification
    print("  ⚠️  Manual verification required via SQL:")
    print("  SELECT column_name, data_type")
    print("  FROM information_schema.columns")
    print("  WHERE table_name = 'roche_audit_logs'")
    print("  AND column_name IN (")
    for col in required_columns:
        print(f"    '{col}',")
        results[col] = None  # Unknown status
    print("  );")
    
    return results

def verify_indexes() -> None:
    """Verify that all required indexes exist."""
    print("\nChecking indexes...")
    print("-" * 80)
    
    required_indexes = [
        "idx_roche_audit_logs_anomaly_score",
        "idx_roche_audit_logs_category",
        "idx_roche_audit_logs_risk_level",
        "idx_roche_audit_logs_tenant_id",
        "idx_roche_audit_logs_tags",
        "idx_audit_embeddings_vector",
        "idx_audit_embeddings_tenant",
        "idx_anomalies_score",
        "idx_anomalies_timestamp",
        "idx_anomalies_tenant",
        "idx_ml_models_type",
        "idx_ml_models_active",
        "idx_integrations_tenant",
        "idx_integrations_active",
        "idx_scheduled_reports_next_run"
    ]
    
    print("  ⚠️  Manual verification required via SQL:")
    print("  SELECT indexname, tablename")
    print("  FROM pg_indexes")
    print("  WHERE schemaname = 'public'")
    print("  AND indexname LIKE 'idx_audit%'")
    print("  OR indexname LIKE 'idx_anomalies%'")
    print("  OR indexname LIKE 'idx_ml_models%'")
    print("  OR indexname LIKE 'idx_integrations%'")
    print("  OR indexname LIKE 'idx_scheduled_reports%';")
    print()
    print("  Expected indexes:")
    for idx in required_indexes:
        print(f"    - {idx}")

def verify_constraints() -> None:
    """Verify that all required constraints exist."""
    print("\nChecking constraints...")
    print("-" * 80)
    
    required_constraints = [
        ("roche_audit_logs", "valid_anomaly_score"),
        ("roche_audit_logs", "valid_risk_level"),
        ("roche_audit_logs", "valid_category"),
        ("audit_anomalies", "valid_anomaly_score"),
        ("audit_anomalies", "valid_severity"),
        ("audit_ml_models", "valid_model_type"),
        ("audit_integrations", "valid_integration_type"),
        ("audit_scheduled_reports", "valid_format")
    ]
    
    print("  ⚠️  Manual verification required via SQL:")
    print("  SELECT conname, conrelid::regclass AS table_name")
    print("  FROM pg_constraint")
    print("  WHERE conname LIKE 'valid_%';")
    print()
    print("  Expected constraints:")
    for table, constraint in required_constraints:
        print(f"    - {table}.{constraint}")

def test_sample_operations(client: Client) -> None:
    """Test basic operations on the new tables."""
    print("\nTesting sample operations...")
    print("-" * 80)
    
    print("  ⚠️  Manual testing recommended:")
    print("  1. Insert a test audit event with AI fields")
    print("  2. Insert a test embedding")
    print("  3. Insert a test anomaly")
    print("  4. Query with filters")
    print("  5. Verify tenant isolation")

def generate_summary(table_results: Dict[str, bool]) -> None:
    """Generate a summary of the verification results."""
    print("\n" + "=" * 80)
    print("VERIFICATION SUMMARY")
    print("=" * 80)
    
    total_tables = len(table_results)
    existing_tables = sum(1 for exists in table_results.values() if exists)
    missing_tables = sum(1 for exists in table_results.values() if not exists)
    
    print(f"\nTables: {existing_tables}/{total_tables} exist")
    
    if missing_tables > 0:
        print("\n✗ Missing tables:")
        for table, exists in table_results.items():
            if not exists:
                print(f"  - {table}")
        print("\n⚠️  Migration may not have been applied successfully.")
        print("⚠️  Please run the migration SQL file via Supabase SQL editor.")
    else:
        print("\n✓ All required tables exist!")
        print("\n⚠️  Additional manual verification required for:")
        print("  - Column definitions")
        print("  - Index creation")
        print("  - Constraint configuration")
        print("  - Row-level security policies")

def main():
    """Main execution function."""
    print("AI-Empowered Audit Trail Migration Verification")
    print("=" * 80)
    print()
    
    try:
        # Get Supabase client
        client = get_supabase_client()
        print("✓ Connected to Supabase")
        print()
        
        # Verify tables
        table_results = verify_tables(client)
        
        # Verify columns
        verify_roche_audit_logs_columns(client)
        
        # Verify indexes
        verify_indexes()
        
        # Verify constraints
        verify_constraints()
        
        # Test sample operations
        test_sample_operations(client)
        
        # Generate summary
        generate_summary(table_results)
        
        print()
        print("=" * 80)
        print("Verification complete!")
        print()
        print("For complete verification, execute the SQL queries shown above")
        print("in the Supabase SQL editor or via psql.")
        
    except Exception as e:
        print(f"\n✗ Verification failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
