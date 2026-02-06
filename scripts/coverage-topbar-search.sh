#!/usr/bin/env bash
# Topbar Unified Search – Coverage für Backend + Frontend (~80% Ziel).
# Ausführung: ./scripts/coverage-topbar-search.sh (aus Repo-Root)
# Hinweis: Backend-Tests nutzen Python aus PATH; bei Problemen aus backend/ mit
#   python3 -m coverage run --rcfile=.coveragerc.topbar-search -m pytest tests/test_unified_search_service.py tests/test_search_router.py -v -o addopts="-v --tb=short"
#   python3 -m coverage report --rcfile=.coveragerc.topbar-search -m --include='*unified_search*','routers/search.py'

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Backend (unified_search_service + search router) ==="
cd backend
# Venv oder explizites python3 verwenden
PYTHON=python3
if [ -d "venv" ]; then
  . venv/bin/activate
  PYTHON=python
fi
$PYTHON -m pip install -q coverage 2>/dev/null || true
$PYTHON -m coverage run --rcfile=.coveragerc.topbar-search -m pytest \
  tests/test_unified_search_service.py tests/test_search_router.py \
  -v -o addopts="-v --tb=short"
$PYTHON -m coverage report --rcfile=.coveragerc.topbar-search -m --include='*unified_search*','routers/search.py'
cd ..

echo ""
echo "=== Frontend (TopbarSearch + /api/search) ==="
npx jest \
  __tests__/api-routes/search.route.test.ts \
  __tests__/components/navigation/TopbarSearch.test.tsx \
  --coverage \
  --collectCoverageFrom='app/api/search/route.ts' \
  --collectCoverageFrom='components/navigation/TopbarSearch.tsx' \
  --coverageReporters=text \
  --coverageThreshold='{}' \
  --silent --no-cache 2>&1 | tail -25

echo ""
echo "Fertig. Ziel: ~80% für die genannten Module."
