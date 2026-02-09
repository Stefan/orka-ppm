"""
Base utilities and helpers for Change Order services.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
from uuid import UUID
from decimal import Decimal

from config.database import supabase
from models.change_orders import (
    ChangeOrderLineItemCreate,
    ChangeOrderLineItem,
    ChangeOrder,
    ChangeOrderResponse,
    ChangeOrderStatus,
)
from workflow_validation import validate_status_transition


def _to_response(record: Dict[str, Any]) -> ChangeOrderResponse:
    """Convert DB record to ChangeOrderResponse."""
    return ChangeOrderResponse(
        id=str(record["id"]),
        project_id=str(record["project_id"]),
        change_order_number=record["change_order_number"],
        title=record["title"],
        description=record["description"],
        justification=record["justification"],
        change_category=record["change_category"],
        change_source=record["change_source"],
        impact_type=record.get("impact_type") or ["cost"],
        priority=record.get("priority") or "medium",
        status=record.get("status") or "draft",
        original_contract_value=float(record["original_contract_value"]),
        proposed_cost_impact=float(record.get("proposed_cost_impact") or 0),
        approved_cost_impact=float(record["approved_cost_impact"]) if record.get("approved_cost_impact") else None,
        proposed_schedule_impact_days=record.get("proposed_schedule_impact_days") or 0,
        approved_schedule_impact_days=record.get("approved_schedule_impact_days"),
        created_by=str(record["created_by"]),
        submitted_date=record.get("submitted_date"),
        required_approval_date=record.get("required_approval_date"),
        approved_date=record.get("approved_date"),
        implementation_date=record.get("implementation_date"),
        contract_reference=record.get("contract_reference"),
        is_active=record.get("is_active", True),
        created_at=record["created_at"],
        updated_at=record["updated_at"],
    )


def calculate_line_item_costs(item: ChangeOrderLineItemCreate) -> Dict[str, float]:
    """Calculate extended cost and total cost for a line item."""
    extended = float(Decimal(str(item.quantity)) * Decimal(str(item.unit_rate)))
    markup = extended * (item.markup_percentage / 100)
    overhead = extended * (item.overhead_percentage / 100)
    contingency = extended * (item.contingency_percentage / 100)
    total = extended + markup + overhead + contingency
    return {
        "extended_cost": round(extended, 2),
        "total_cost": round(total, 2),
    }


# validate_status_transition from workflow_validation (single source of truth for R1.2, R1.3)
