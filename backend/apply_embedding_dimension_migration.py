"""
Apply embedding dimension migration to update from 1536 to 384 dimensions
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent))

from config.database import supabase


def apply_migration():
    """Apply the embedding dimension migration"""

    print("🔄 Applying embedding dimension migration...")

    # Read migration file
    migration_file = (
        Path(__file__).parent / "migrations" / "027_update_embedding_dimension.sql"
    )

    with open(migration_file, "r") as f:
        sql = f.read()

    # Split into individual statements
    statements = [
        s.strip()
        for s in sql.split(";")
        if s.strip() and not s.strip().startswith("--")
    ]

    print(f"📝 Found {len(statements)} SQL statements to execute")

    # Execute each statement
    for i, statement in enumerate(statements, 1):
        try:
            print(f"⏳ Executing statement {i}/{len(statements)}...")
            # Note: Supabase client doesn't support direct SQL execution
            # This would need to be run manually in the Supabase SQL editor
            print(f"   {statement[:100]}...")
        except Exception as e:
            print(f"❌ Error executing statement {i}: {e}")
            return False

    print("\n⚠️  IMPORTANT: This migration must be run manually in Supabase SQL Editor")
    print("   1. Go to your Supabase project dashboard")
    print("   2. Navigate to SQL Editor")
    print("   3. Copy and paste the contents of migrations/027_update_embedding_dimension.sql")
    print("   4. Execute the SQL")
    print("\n   Or run this command if you have psql access:")
    print(f"   psql $DATABASE_URL < {migration_file}")

    return True


if __name__ == "__main__":
    apply_migration()
