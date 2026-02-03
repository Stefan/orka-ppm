#!/usr/bin/env bash
# Fetches OpenAPI schema from the backend and writes to __tests__/contract/openapi.json.
# Usage: BACKEND_URL=http://localhost:8000 ./scripts/export-openapi.sh
set -e
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
OUT="$([[ -n "$1" ]] && echo "$1" || echo "__tests__/contract/openapi.json")"
echo "Fetching OpenAPI from $BACKEND_URL/openapi.json -> $OUT"
curl -sSf "$BACKEND_URL/openapi.json" -o "$OUT"
echo "Wrote $OUT"
