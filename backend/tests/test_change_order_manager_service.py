"""
Unit tests for Change Order Manager Service and base utilities.
"""

import pytest
from uuid import uuid4
from unittest.mock import Mock, patch

from models.change_orders import (
    ChangeOrderCreate,
    ChangeOrderLineItemCreate,
    ChangeOrderCategory,
    ChangeOrderSource,
    CostCategory,
)
from services.change_order_base import (
    calculate_line_item_costs,
    validate_status_transition,
)


class TestCalculateLineItemCosts:
    """Test line item cost calculations."""

    def test_basic_extended_cost(self):
        item = ChangeOrderLineItemCreate(
            description="Test",
            trade_category="Labor",
            unit_of_measure="HR",
            quantity=10,
            unit_rate=50,
            cost_category=CostCategory.LABOR,
        )
        result = calculate_line_item_costs(item)
        assert result["extended_cost"] == 500.0
        assert result["total_cost"] == 500.0

    def test_with_markup_overhead_contingency(self):
        item = ChangeOrderLineItemCreate(
            description="Test",
            trade_category="Labor",
            unit_of_measure="HR",
            quantity=100,
            unit_rate=25,
            markup_percentage=10,
            overhead_percentage=15,
            contingency_percentage=5,
            cost_category=CostCategory.LABOR,
        )
        result = calculate_line_item_costs(item)
        # extended=2500, markup=250, overhead=375, contingency=125, total=3250
        assert result["extended_cost"] == 2500.0
        assert result["total_cost"] == 3250.0

    def test_line_item_mathematical_consistency(self):
        """Property: extended_cost = quantity × unit_rate"""
        item = ChangeOrderLineItemCreate(
            description="Test",
            trade_category="Material",
            unit_of_measure="EA",
            quantity=7.5,
            unit_rate=12.34,
            cost_category=CostCategory.MATERIAL,
        )
        result = calculate_line_item_costs(item)
        expected_extended = 7.5 * 12.34
        assert abs(result["extended_cost"] - expected_extended) < 0.01


class TestValidateStatusTransition:
    """Test status transition validation (Property 7)."""

    def test_draft_to_submitted(self):
        assert validate_status_transition("draft", "submitted") is True

    def test_draft_to_approved_invalid(self):
        assert validate_status_transition("draft", "approved") is False

    def test_submitted_to_under_review(self):
        assert validate_status_transition("submitted", "under_review") is True

    def test_submitted_to_rejected(self):
        assert validate_status_transition("submitted", "rejected") is True

    def test_under_review_to_approved(self):
        assert validate_status_transition("under_review", "approved") is True

    def test_approved_to_implemented(self):
        assert validate_status_transition("approved", "implemented") is True

    def test_rejected_no_transitions(self):
        assert validate_status_transition("rejected", "submitted") is False
        assert validate_status_transition("rejected", "approved") is False

    def test_implemented_no_transitions(self):
        assert validate_status_transition("implemented", "approved") is False


class TestChangeOrderManagerServiceValidation:
    """Test ChangeOrderManagerService validation logic."""

    @pytest.fixture
    def sample_create_data(self):
        return ChangeOrderCreate(
            project_id=uuid4(),
            title="Test Change Order",
            description="Test description for change order creation",
            justification="Test justification for the change",
            change_category=ChangeOrderCategory.OWNER_DIRECTED,
            change_source=ChangeOrderSource.OWNER,
            original_contract_value=500000,
            line_items=[
                ChangeOrderLineItemCreate(
                    description="Line 1",
                    trade_category="Labor",
                    unit_of_measure="HR",
                    quantity=40,
                    unit_rate=75,
                    cost_category=CostCategory.LABOR,
                ),
            ],
        )

    def test_validate_change_order_data_rejects_short_title(self, sample_create_data):
        """Test validation rejects title < 5 chars."""
        from services.change_order_manager_service import ChangeOrderManagerService

        with patch("config.database.supabase", Mock()):
            svc = ChangeOrderManagerService()
        sample_create_data.title = "Ab"
        with pytest.raises(ValueError, match="Title"):
            svc.validate_change_order_data(sample_create_data)

    def test_validate_change_order_data_rejects_short_description(self, sample_create_data):
        """Test validation rejects description < 10 chars."""
        from services.change_order_manager_service import ChangeOrderManagerService

        with patch("config.database.supabase", Mock()):
            svc = ChangeOrderManagerService()
        sample_create_data.description = "Short"
        with pytest.raises(ValueError, match="Description"):
            svc.validate_change_order_data(sample_create_data)

    def test_validate_change_order_data_rejects_invalid_priority(self, sample_create_data):
        """Test validation rejects invalid priority."""
        from services.change_order_manager_service import ChangeOrderManagerService

        with patch("config.database.supabase", Mock()):
            svc = ChangeOrderManagerService()
        sample_create_data.priority = "invalid"
        with pytest.raises(ValueError, match="priority"):
            svc.validate_change_order_data(sample_create_data)
