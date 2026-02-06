#!/usr/bin/env python3
"""
List all API routes from the FastAPI app's OpenAPI spec.

Run from backend/ so that main is importable:
  cd backend && python scripts/list_routes.py

Use this to periodically update docs/backend-api-route-coverage.md.
"""

import sys
from pathlib import Path

# Ensure backend is on path when run as scripts/list_routes.py
_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from main import app


def main() -> None:
    openapi = app.openapi()
    paths = openapi.get("paths", {})
    for path, spec in sorted(paths.items()):
        for method, op in spec.items():
            if method in ("get", "post", "put", "patch", "delete"):
                print(f"{method.upper():6} {path}")


if __name__ == "__main__":
    main()
