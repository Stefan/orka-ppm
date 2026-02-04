"""
Change Order Manager Service

Handles change order lifecycle: creation, validation, numbering,
status management, and project impact calculations.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID, uuid4
from decimal import Decimal
import logging

from config.database import supabase
from models.change_orders import (
    ChangeOrderCreate,
    ChangeOrderUpdate,
    ChangeOrderResponse,
    ChangeOrderDetailResponse,
    ChangeOrderLineItem,
    ChangeOrderLineItemCreate,
    ChangeOrderStatus,
)
from .change_order_base import (
    _to_response,
    calculate_line_item_costs,
    validate_status_transition,
)

logger = logging.getLogger(__name__)


class ChangeOrderManagerService:
    """Service for change order lifecycle management."""

    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")

    def _generate_change_order_number(self, project_id: UUID) -> str:
        """Generate unique change order number: CO-{project_short}-{seq}."""
        try:
            result = (
                self.db.table("change_orders")
                .select("change_order_number", count="exact")
                .eq("project_id", str(project_id))
                .execute()
            )
            count = result.count or 0
            seq = count + 1
            return f"CO-{str(project_id)[:8]}-{seq:04d}"
        except Exception as e:
            logger.warning(f"Fallback CO number generation: {e}")
            return f"CO-{str(project_id)[:8]}-{uuid4().hex[:4].upper()}"

    def create_change_order(
        self, data: ChangeOrderCreate, created_by: UUID
    ) -> ChangeOrderResponse:
        """Create a new change order with automatic numbering and validation."""
        self.validate_change_order_data(data)

        change_order_number = self._generate_change_order_number(data.project_id)

        # Calculate proposed cost from line items
        proposed_cost = 0.0
        for item in data.line_items:
            costs = calculate_line_item_costs(item)
            proposed_cost += costs["total_cost"]

        change_data = {
            "project_id": str(data.project_id),
            "change_order_number": change_order_number,
            "title": data.title,
            "description": data.description,
            "justification": data.justification,
            "change_category": data.change_category.value,
            "change_source": data.change_source.value,
            "impact_type": data.impact_type,
            "priority": data.priority,
            "status": ChangeOrderStatus.DRAFT.value,
            "original_contract_value": float(data.original_contract_value),
            "proposed_cost_impact": proposed_cost,
            "proposed_schedule_impact_days": data.proposed_schedule_impact_days,
            "contract_reference": data.contract_reference,
            "created_by": str(created_by),
        }

        result = self.db.table("change_orders").insert(change_data).execute()
        if not result.data:
            raise RuntimeError("Failed to create change order")

        co = result.data[0]
        co_id = UUID(co["id"])

        # Insert line items
        for idx, item in enumerate(data.line_items):
            costs = calculate_line_item_costs(item)
            line_data = {
                "change_order_id": str(co_id),
                "line_number": idx + 1,
                "description": item.description,
                "work_package_id": str(item.work_package_id) if item.work_package_id else None,
                "trade_category": item.trade_category,
                "unit_of_measure": item.unit_of_measure,
                "quantity": float(item.quantity),
                "unit_rate": float(item.unit_rate),
                "extended_cost": costs["extended_cost"],
                "markup_percentage": item.markup_percentage,
                "overhead_percentage": item.overhead_percentage,
                "contingency_percentage": item.contingency_percentage,
                "total_cost": costs["total_cost"],
                "cost_category": item.cost_category.value,
                "is_add": item.is_add,
            }
            self.db.table("change_order_line_items").insert(line_data).execute()

        return _to_response(co)

    def get_change_order(self, change_order_id: UUID) -> Optional[ChangeOrderResponse]:
        """Get change order by ID."""
        result = (
            self.db.table("change_orders")
            .select("*")
            .eq("id", str(change_order_id))
            .eq("is_active", True)
            .execute()
        )
        if not result.data:
            return None
        return _to_response(result.data[0])

    def get_change_order_details(
        self, change_order_id: UUID
    ) -> Optional[ChangeOrderDetailResponse]:
        """Get change order with line items."""
        co = self.get_change_order(change_order_id)
        if not co:
            return None

        line_result = (
            self.db.table("change_order_line_items")
            .select("*")
            .eq("change_order_id", str(change_order_id))
            .order("line_number")
            .execute()
        )

        line_items = []
        for row in line_result.data or []:
            line_items.append(
                ChangeOrderLineItem(
                    id=UUID(row["id"]),
                    change_order_id=UUID(row["change_order_id"]),
                    line_number=row["line_number"],
                    description=row["description"],
                    work_package_id=UUID(row["work_package_id"]) if row.get("work_package_id") else None,
                    trade_category=row["trade_category"],
                    unit_of_measure=row["unit_of_measure"],
                    quantity=float(row["quantity"]),
                    unit_rate=float(row["unit_rate"]),
                    extended_cost=float(row["extended_cost"]),
                    markup_percentage=float(row.get("markup_percentage") or 0),
                    overhead_percentage=float(row.get("overhead_percentage") or 0),
                    contingency_percentage=float(row.get("contingency_percentage") or 0),
                    total_cost=float(row["total_cost"]),
                    cost_category=row["cost_category"],
                    is_add=row.get("is_add", True),
                )
            )

        return ChangeOrderDetailResponse(
            **co.model_dump(),
            line_items=line_items,
        )

    def list_change_orders(
        self,
        project_id: UUID,
        status: Optional[str] = None,
        category: Optional[str] = None,
        date_range: Optional[str] = None,
    ) -> List[ChangeOrderResponse]:
        """List change orders with optional filters."""
        query = (
            self.db.table("change_orders")
            .select("*")
            .eq("project_id", str(project_id))
            .eq("is_active", True)
        )
        if status:
            query = query.eq("status", status)
        if category:
            query = query.eq("change_category", category)
        # date_range could be parsed for created_at range - simplified for now
        result = query.order("created_at", desc=True).execute()
        return [_to_response(r) for r in result.data or []]

    def update_change_order(
        self, change_order_id: UUID, data: ChangeOrderUpdate
    ) -> Optional[ChangeOrderResponse]:
        """Update change order. Only draft can be fully updated."""
        co = self.get_change_order(change_order_id)
        if not co:
            return None
        if co.status != "draft":
            raise ValueError("Only draft change orders can be updated")

        update_data = data.model_dump(exclude_unset=True)
        for k, v in update_data.items():
            if hasattr(v, "value"):  # Enum
                update_data[k] = v.value
        update_data["updated_at"] = datetime.utcnow().isoformat()

        result = (
            self.db.table("change_orders")
            .update(update_data)
            .eq("id", str(change_order_id))
            .execute()
        )
        if not result.data:
            return None
        return _to_response(result.data[0])

    def submit_change_order(self, change_order_id: UUID) -> Optional[ChangeOrderResponse]:
        """Submit change order for approval (draft -> submitted)."""
        co = self.get_change_order(change_order_id)
        if not co:
            return None
        if not validate_status_transition(co.status, "submitted"):
            raise ValueError(f"Cannot submit from status {co.status}")

        update_data = {
            "status": "submitted",
            "submitted_date": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        result = (
            self.db.table("change_orders")
            .update(update_data)
            .eq("id", str(change_order_id))
            .execute()
        )
        if not result.data:
            return None
        return _to_response(result.data[0])

    def update_change_order_status(
        self, change_order_id: UUID, new_status: str
    ) -> Optional[ChangeOrderResponse]:
        """Update change order status with validation."""
        co = self.get_change_order(change_order_id)
        if not co:
            return None
        if not validate_status_transition(co.status, new_status):
            raise ValueError(f"Invalid status transition: {co.status} -> {new_status}")

        update_data = {
            "status": new_status,
            "updated_at": datetime.utcnow().isoformat(),
        }
        if new_status == "approved":
            update_data["approved_date"] = datetime.utcnow().isoformat()
        elif new_status == "implemented":
            update_data["implementation_date"] = datetime.utcnow().isoformat()

        result = (
            self.db.table("change_orders")
            .update(update_data)
            .eq("id", str(change_order_id))
            .execute()
        )
        if not result.data:
            return None
        return _to_response(result.data[0])

    def calculate_project_impact(
        self, change_order_id: UUID
    ) -> Dict[str, Any]:
        """Calculate overall project impact for a change order."""
        co = self.get_change_order_details(change_order_id)
        if not co:
            return {}
        return {
            "cost_impact": co.proposed_cost_impact,
            "approved_cost_impact": co.approved_cost_impact,
            "schedule_impact_days": co.proposed_schedule_impact_days,
            "approved_schedule_days": co.approved_schedule_impact_days,
            "line_item_count": len(co.line_items),
            "total_line_items_cost": sum(li.total_cost for li in co.line_items),
        }

    def validate_change_order_data(self, data: ChangeOrderCreate) -> None:
        """Validate change order data against business rules."""
        if not data.title or len(data.title) < 5:
            raise ValueError("Title must be at least 5 characters")
        if not data.description or len(data.description) < 10:
            raise ValueError("Description must be at least 10 characters")
        if data.original_contract_value <= 0:
            raise ValueError("Original contract value must be positive")
        if data.priority not in ("low", "medium", "high", "critical"):
            raise ValueError("Invalid priority")
        for item in data.line_items:
            if item.quantity <= 0:
                raise ValueError("Line item quantity must be positive")
            if item.unit_rate < 0:
                raise ValueError("Line item unit rate cannot be negative")
