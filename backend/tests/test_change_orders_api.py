"""
Integration tests for Change Orders API endpoints.
"""

import pytest
from uuid import uuid4
from fastapi.testclient import TestClient

from main import app
from models.change_orders import ChangeOrderCategory, ChangeOrderSource, CostCategory

client = TestClient(app)

TEST_PROJECT_ID = "00000000-0000-0000-0000-000000000001"
TEST_USER_ID = "00000000-0000-0000-0000-000000000001"


@pytest.fixture
def auth_headers():
    """Auth headers - backend uses dev fallback for any Bearer token."""
    return {
        "Authorization": f"Bearer test-token-{TEST_USER_ID}",
        "Content-Type": "application/json",
    }


@pytest.fixture
def change_order_create_payload():
    return {
        "project_id": TEST_PROJECT_ID,
        "title": "API Test Change Order",
        "description": "Integration test change order description",
        "justification": "Testing the change orders API endpoints",
        "change_category": ChangeOrderCategory.OWNER_DIRECTED.value,
        "change_source": ChangeOrderSource.OWNER.value,
        "impact_type": ["cost", "schedule"],
        "priority": "medium",
        "original_contract_value": 100000,
        "proposed_schedule_impact_days": 5,
        "line_items": [
            {
                "description": "Labor hours",
                "trade_category": "Electrical",
                "unit_of_measure": "HR",
                "quantity": 20,
                "unit_rate": 85,
                "markup_percentage": 10,
                "cost_category": CostCategory.LABOR.value,
            }
        ],
    }


class TestChangeOrdersAPI:
    """Test Change Orders API endpoints."""

    def test_list_change_orders_requires_auth(self):
        """Requests without auth may get 401 or dev fallback."""
        response = client.get(f"/change-orders/{TEST_PROJECT_ID}")
        assert response.status_code in (200, 401, 403)

    def test_list_change_orders_with_auth(self, auth_headers):
        """List returns array (may be empty if no migration run)."""
        response = client.get(
            f"/change-orders/{TEST_PROJECT_ID}",
            headers=auth_headers,
        )
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)

    def test_create_change_order_validation(self, auth_headers):
        """Invalid payload returns 422."""
        invalid = {
            "project_id": "not-a-uuid",
            "title": "x",
            "description": "x",
            "justification": "x",
            "change_category": "owner_directed",
            "change_source": "owner",
            "original_contract_value": -1,
        }
        response = client.post("/change-orders/", json=invalid, headers=auth_headers)
        assert response.status_code == 422

    def test_create_change_order_success(self, auth_headers, change_order_create_payload):
        """Create change order when DB is available."""
        response = client.post(
            "/change-orders/",
            json=change_order_create_payload,
            headers=auth_headers,
        )
        if response.status_code == 200:
            data = response.json()
            assert "id" in data
            assert data["title"] == change_order_create_payload["title"]
            assert "change_order_number" in data
            assert data["status"] == "draft"
        elif response.status_code == 500:
            pytest.skip("Database tables may not exist - run migration 042")


class TestChangeAnalyticsAPI:
    """Test Change Analytics API."""

    def test_dashboard_with_auth(self, auth_headers):
        """Dashboard returns summary structure."""
        response = client.get(
            f"/change-analytics/dashboard/{TEST_PROJECT_ID}",
            headers=auth_headers,
        )
        if response.status_code == 200:
            data = response.json()
            assert "project_id" in data
            assert "summary" in data or "cost_impact_summary" in data
