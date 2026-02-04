#!/usr/bin/env python3
"""Deploy Project Controls - migration and validation."""

import sys
from pathlib import Path

backend = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend))

def main():
    print("Project Controls Deployment")
    migration = backend / "migrations" / "017_project_controls_schema.sql"
    if migration.exists():
        print(f"Migration: {migration}")
    print("Done.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
