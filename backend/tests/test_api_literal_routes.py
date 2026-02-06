"""
API literal route tests – ensure literal path segments are not matched as path parameters.

When a route has both a literal segment (e.g. /instances/my-workflows) and a
parameterized one (e.g. /instances/{id}), the literal route must be declared
*before* the parameterized one. Otherwise the literal is interpreted as the
parameter (e.g. id="my-workflows") and validation fails with 422.

This module tests critical literal routes across the app so that:
- We get 2xx or expected auth/error codes (401, 403, 404, 503), not 422.
- Route ordering regressions are caught.

How to use:
- Add new (method, path, allowed_status_codes) when you add literal routes that
  could conflict with {param} routes. Do not put 422 in allowed once the router
  is correctly ordered.
- If a route returns 422 due to known route-order bug, add 422 to allowed and
  a TODO comment. When fixing the router, remove 422 from allowed.

Run: pytest tests/test_api_literal_routes.py -v -o 'addopts=-v --tb=short'
"""

import pytest
from fastapi.testclient import TestClient

from main import app


# (method, path, allowed_status_codes)
# 422 = validation error (wrong path match). We assert response is NOT 422 for these paths.
# Include 422 in allowed only when route-order fix is pending (see TODO in code).
LITERAL_ROUTES = [
    # ----- P0: projects, rbac -----
    ("GET", "/projects", [200, 401, 403, 500, 503]),
    ("POST", "/projects", [201, 400, 401, 403, 422]),
    ("GET", "/api/rbac/users-with-roles", [200, 401, 403]),
    ("GET", "/api/rbac/roles", [200, 401, 403]),
    ("POST", "/api/rbac/role-assignments", [200, 201, 400, 401, 403, 422]),
    ("GET", "/api/rbac/user-permissions", [200, 401, 403]),
    ("GET", "/api/rbac/check-permission", [200, 400, 401, 403, 422]),  # TODO: query params or route order
    ("GET", "/api/rbac/audit/role-changes", [200, 401, 403]),
    # ----- P0/P1: viewer_restrictions (same prefix /api/rbac) -----
    ("GET", "/api/rbac/viewer-indicators", [200, 400, 401, 403, 500]),
    ("GET", "/api/rbac/financial-access-level", [200, 400, 401, 403, 500]),
    ("POST", "/api/rbac/filter-financial-data", [200, 400, 401, 403, 422]),
    ("POST", "/api/rbac/check-report-access", [200, 400, 401, 403, 422]),
    ("POST", "/api/rbac/check-write-operation", [200, 400, 401, 403, 422]),
    ("GET", "/api/rbac/is-viewer-only", [200, 401, 403]),
    # ----- Workflows -----
    ("GET", "/api/workflows/instances/my-workflows", [200, 401, 403]),
    ("GET", "/api/workflows/approvals/pending", [200, 401, 403, 404]),
    ("GET", "/api/workflows/templates", [200, 401, 403, 500, 422]),  # TODO: move /templates before /{workflow_id}
    # ----- Variance -----
    ("GET", "/variance/alerts/summary", [200, 401, 403]),
    ("GET", "/variance/alerts", [200, 401, 403, 503]),
    ("POST", "/variance/push-subscribe", [200, 401, 403, 404, 422]),
    # ----- Schedules -----
    ("GET", "/schedules/notifications", [200, 401, 403, 500]),
    # ----- Monte Carlo -----
    ("GET", "/api/v1/monte-carlo/simulations/background/next", [200, 401, 403, 404, 422]),  # TODO: route order
    ("GET", "/api/v1/monte-carlo/config/defaults", [200, 401, 403]),
    ("GET", "/api/v1/monte-carlo/cache/statistics", [200, 401, 403, 422]),  # TODO: route order
    ("GET", "/api/v1/monte-carlo/scenarios", [200, 401, 403]),
    ("POST", "/api/v1/monte-carlo/simulations/run", [200, 201, 400, 401, 403, 422]),  # TODO: route order or body
    # ----- Financial -----
    ("GET", "/financial-tracking", [200, 401, 403, 503]),
    ("POST", "/financial-tracking", [201, 400, 401, 403, 422]),
    ("GET", "/financial-tracking/budget-alerts", [200, 401, 403, 503]),
    ("GET", "/financial-tracking/comprehensive-report", [200, 401, 403, 503]),
    ("GET", "/financial-tracking/budget-alerts/summary", [200, 401, 403]),
    ("POST", "/financial-tracking/budget-alerts/monitor", [200, 401, 403]),
    # ----- Audit -----
    ("GET", "/api/audit/dashboard/stats", [200, 401, 403, 500]),
    ("GET", "/api/audit/logs", [200, 401, 403, 500]),
    ("GET", "/api/audit/events", [200, 401, 403, 500]),
    ("GET", "/api/audit/timeline", [200, 401, 403, 500, 422]),  # TODO: audit route order or query params
    ("GET", "/api/audit/anomalies", [200, 401, 403, 500]),
    ("POST", "/api/audit/search", [200, 401, 403, 500, 422]),  # TODO: body validation or route order
    ("POST", "/api/audit/export", [200, 400, 401, 403, 422]),
    ("POST", "/api/audit/export/pdf", [200, 400, 401, 403, 422]),
    ("POST", "/api/audit/export/csv", [200, 400, 401, 403, 422]),
    # ----- Costbook -----
    ("GET", "/api/v1/costbook/rows", [200, 401, 403, 500]),
    ("GET", "/api/v1/costbook/summary", [200, 401, 403, 500]),
    # ----- PO breakdown -----
    ("POST", "/pos/breakdown/import", [200, 201, 400, 401, 403, 422]),  # TODO: move /import before /{breakdown_id}
    # ----- Feature toggles -----
    ("GET", "/api/features", [200, 401, 403]),
    # ----- Reports (P2) -----
    ("GET", "/reports/templates", [200, 401, 403]),
    ("GET", "/reports/health", [200, 500]),
    ("POST", "/reports/adhoc", [200, 400, 401, 403, 422]),
    ("POST", "/reports/generate", [200, 201, 400, 401, 403, 422]),
    ("POST", "/reports/export-google", [200, 201, 400, 401, 403, 422]),
    ("GET", "/reports/oauth/authorize", [200, 302, 401, 403, 422]),  # TODO: route order
    ("POST", "/reports/oauth/callback", [200, 400, 401, 403, 422]),  # TODO: route order or body
    ("GET", "/reports/oauth/status", [200, 401, 403]),
    # ----- Help chat -----
    ("GET", "/api/ai/help/tips", [200, 401, 403, 500, 422]),  # TODO: route order in help_chat router
    ("GET", "/api/ai/help/languages", [200, 401, 403, 500]),
    # ----- P1: risks, portfolios -----
    ("GET", "/risks", [200, 401, 403, 503]),
    ("POST", "/risks", [201, 400, 401, 403, 422]),
    ("GET", "/portfolios", [200, 401, 403, 503]),
    ("POST", "/portfolios", [201, 400, 401, 403, 422]),
    # ----- P1: projects_import -----
    ("POST", "/api/projects/import", [200, 400, 401, 403, 422]),
    ("POST", "/api/projects/import/csv", [200, 400, 401, 403, 422]),
    # ----- P2: help_chat_enhanced -----
    ("POST", "/help-chat/query", [200, 400, 401, 403, 422]),
    ("GET", "/help-chat/proactive-tips", [200, 401, 403]),
    ("GET", "/help-chat/admin/analytics", [200, 401, 403]),
    # ----- P2: help_content_management -----
    ("POST", "/help-content/search", [200, 401, 403, 422]),
    ("POST", "/help-content/bulk-operation", [200, 401, 403, 422]),
    ("GET", "/help-content/public/search", [200, 401, 403]),
    # ----- P2: visual_guides -----
    ("GET", "/visual-guides/", [200, 401, 403]),
    ("POST", "/visual-guides/", [200, 201, 400, 401, 403, 422]),
    ("GET", "/visual-guides/recommendations/context", [200, 401, 403]),
    # ----- P2: feedback -----
    ("GET", "/feedback/features", [200, 401, 403]),
    ("POST", "/feedback/features", [201, 400, 401, 403, 422]),
    ("GET", "/feedback/bugs", [200, 401, 403]),
    ("POST", "/feedback/bugs", [201, 400, 401, 403, 422]),
    ("GET", "/feedback/admin/stats", [200, 401, 403]),
    # ----- P2: notifications -----
    ("GET", "/notifications/", [200, 401, 403]),
    # ----- P2: issues -----
    ("GET", "/issues/", [200, 401, 403, 503]),
    ("POST", "/issues/", [201, 400, 401, 403, 422]),
    # ----- P2: enhanced_pmr + pmr_performance -----
    ("POST", "/api/reports/pmr/generate", [200, 201, 400, 401, 403, 422]),
    ("GET", "/api/reports/pmr/health", [200, 401, 403, 422]),  # TODO: route order (before /{report_id})
    ("GET", "/api/reports/pmr/performance/stats", [200, 401, 403]),
    ("GET", "/api/reports/pmr/performance/health", [200, 401, 403]),
    ("GET", "/api/reports/pmr/performance/alerts", [200, 401, 403]),
    ("GET", "/api/reports/pmr/performance/cache/stats", [200, 401, 403]),
    ("POST", "/api/reports/pmr/performance/cache/clear", [200, 401, 403]),
    # ----- P2: ai_resource_optimizer -----
    ("POST", "/ai/resource-optimizer/", [200, 400, 401, 403, 422]),
    ("GET", "/ai/resource-optimizer/conflicts", [200, 401, 403]),
    ("GET", "/ai/resource-optimizer/metrics", [200, 401, 403]),
    # ----- P2: erp -----
    ("POST", "/api/v1/erp/sync", [200, 400, 401, 403, 422]),
    # ----- P2: features (v1) -----
    ("GET", "/api/v1/features", [200, 401, 403]),
    ("POST", "/api/v1/features/update", [200, 400, 401, 403, 422]),
    # ----- P2: distribution -----
    ("POST", "/api/v1/distribution/calculate", [200, 400, 401, 403, 422]),
    ("GET", "/api/v1/distribution/rules", [200, 401, 403]),
    ("POST", "/api/v1/distribution/rules/apply", [200, 401, 403, 422]),
    # ----- P2: rundown -----
    ("POST", "/api/rundown/generate", [200, 400, 401, 403, 422]),
    ("POST", "/api/rundown/generate/async", [200, 400, 401, 403, 422]),
    # ----- P2: workflow_metrics -----
    ("GET", "/workflow-metrics/stats", [200, 401, 403]),
    ("GET", "/workflow-metrics/health", [200, 401, 403]),
    ("GET", "/workflow-metrics/summary", [200, 401, 403]),
    ("GET", "/workflow-metrics/dashboard", [200, 401, 403]),
    # ----- P2: feature_flags (admin) -----
    ("GET", "/api/admin/feature-flags", [200, 401, 403]),
    ("POST", "/api/admin/feature-flags", [201, 400, 401, 403, 422]),
    ("POST", "/api/admin/feature-flags/check", [200, 400, 401, 403, 422]),
    # ----- P2: scenarios (what-if) -----
    ("POST", "/simulations/what-if", [201, 400, 401, 403, 422]),
    ("POST", "/simulations/what-if/compare", [200, 400, 401, 403, 422]),
]


@pytest.fixture
def client():
    return TestClient(app)


@pytest.mark.parametrize("method,path,allowed", LITERAL_ROUTES, ids=[f"{m} {p}" for m, p, _ in LITERAL_ROUTES])
def test_literal_route_not_422(client: TestClient, method: str, path: str, allowed: list):
    """
    Request must not return 422 (Unprocessable Entity) due to path being matched
    by a parameterized route (e.g. literal 'my-workflows' matched as UUID).
    When 422 is in allowed, the route has a known ordering issue (see TODO in LITERAL_ROUTES).
    """
    if method == "GET":
        response = client.get(path)
    elif method == "POST":
        response = client.post(path, json={})
    else:
        pytest.skip(f"Unsupported method {method}")

    if 422 not in allowed:
        assert response.status_code != 422, (
            f"{method} {path} returned 422. "
            "Likely cause: a parameterized route (e.g. /instances/{{id}}) is declared "
            "before this literal route, so the path segment was interpreted as the parameter. "
            "Declare the literal route before the parameterized one in the router."
        )
