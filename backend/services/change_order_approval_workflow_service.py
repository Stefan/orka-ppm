"""
Change Order Approval Workflow Engine Service

Manages multi-level approval workflows for change orders.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
import logging

from config.database import supabase
from models.change_orders import (
    ApprovalWorkflowConfig,
    ApprovalDecision,
    RejectionReason,
    ApprovalWorkflowResponse,
    PendingApprovalResponse,
    ApprovalResponse,
    WorkflowStatusResponse,
)

logger = logging.getLogger(__name__)


class ChangeOrderApprovalWorkflowService:
    """Service for change order approval workflows."""

    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")

    def initiate_workflow(
        self, change_order_id: UUID, config: ApprovalWorkflowConfig
    ) -> ApprovalWorkflowResponse:
        """Initiate approval workflow for a change order."""
        co_result = (
            self.db.table("change_orders")
            .select("id, proposed_cost_impact, created_by")
            .eq("id", str(change_order_id))
            .execute()
        )
        if not co_result.data:
            raise ValueError("Change order not found")

        co = co_result.data[0]
        cost = float(co.get("proposed_cost_impact", 0))

        # Simple 2-level workflow based on cost
        levels = [
            {"level": 1, "role": "project_manager", "limit": 50000},
            {"level": 2, "role": "portfolio_manager", "limit": None},
        ]
        if cost > 50000:
            levels = [
                {"level": 1, "role": "project_manager", "limit": 50000},
                {"level": 2, "role": "portfolio_manager", "limit": 200000},
                {"level": 3, "role": "executive", "limit": None},
            ]

        approvals = []
        for idx, lvl in enumerate(levels):
            approval_data = {
                "change_order_id": str(change_order_id),
                "approval_level": lvl["level"],
                "approver_role": lvl["role"],
                "approver_user_id": str(co["created_by"]),  # Placeholder - should resolve from RBAC
                "approval_limit": lvl["limit"],
                "status": "pending",
                "is_required": True,
                "sequence_order": idx + 1,
            }
            result = self.db.table("change_order_approvals").insert(approval_data).execute()
            if result.data:
                approvals.append(result.data[0])

        return ApprovalWorkflowResponse(
            change_order_id=str(change_order_id),
            workflow_status="active",
            current_level=1,
            total_levels=len(levels),
            pending_approvals=[{"level": a["approval_level"], "role": a["approver_role"]} for a in approvals],
        )

    def get_pending_approvals(self, user_id: UUID) -> List[PendingApprovalResponse]:
        """Get pending approvals for a user."""
        result = (
            self.db.table("change_order_approvals")
            .select("id, change_order_id, approval_level, approval_date")
            .eq("approver_user_id", str(user_id))
            .eq("status", "pending")
            .execute()
        )
        items = []
        for row in result.data or []:
            co_id = row["change_order_id"]
            co_result = (
                self.db.table("change_orders")
                .select("change_order_number, title, proposed_cost_impact")
                .eq("id", co_id)
                .execute()
            )
            co = co_result.data[0] if co_result.data else {}
            items.append(
                PendingApprovalResponse(
                    id=str(row["id"]),
                    change_order_id=str(co_id),
                    change_order_number=co.get("change_order_number", ""),
                    change_order_title=co.get("title", ""),
                    approval_level=row["approval_level"],
                    proposed_cost_impact=float(co.get("proposed_cost_impact", 0)),
                    due_date=row.get("approval_date"),
                )
            )
        return items

    def approve(
        self, approval_id: UUID, decision: ApprovalDecision
    ) -> ApprovalResponse:
        """Process approval decision."""
        result = (
            self.db.table("change_order_approvals")
            .update({
                "status": "approved",
                "approval_date": datetime.utcnow().isoformat(),
                "comments": decision.comments,
                "conditions": decision.conditions,
            })
            .eq("id", str(approval_id))
            .execute()
        )
        if not result.data:
            raise ValueError("Approval not found")

        approval = result.data[0]
        change_order_id = approval["change_order_id"]

        # Check if all required approvals are done
        self._check_workflow_completion(UUID(change_order_id))

        return ApprovalResponse(
            approval_id=str(approval_id),
            status="approved",
            message="Change order approved",
        )

    def reject(self, approval_id: UUID, reason: RejectionReason) -> ApprovalResponse:
        """Process rejection."""
        result = (
            self.db.table("change_order_approvals")
            .select("change_order_id")
            .eq("id", str(approval_id))
            .execute()
        )
        if not result.data:
            raise ValueError("Approval not found")

        self.db.table("change_order_approvals").update({
            "status": "rejected",
            "approval_date": datetime.utcnow().isoformat(),
            "comments": reason.comments,
        }).eq("id", str(approval_id)).execute()

        # Update change order status to rejected
        self.db.table("change_orders").update({
            "status": "rejected",
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", result.data[0]["change_order_id"]).execute()

        return ApprovalResponse(
            approval_id=str(approval_id),
            status="rejected",
            message="Change order rejected",
        )

    def _check_workflow_completion(self, change_order_id: UUID) -> None:
        """Check if all required approvals are complete and update change order."""
        result = (
            self.db.table("change_order_approvals")
            .select("status, is_required")
            .eq("change_order_id", str(change_order_id))
            .execute()
        )
        approvals = result.data or []
        required = [a for a in approvals if a.get("is_required")]
        all_approved = all(a.get("status") == "approved" for a in required)
        any_rejected = any(a.get("status") == "rejected" for a in approvals)

        if any_rejected:
            return  # Already handled in reject
        if all_approved:
            self.db.table("change_orders").update({
                "status": "approved",
                "approved_date": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("id", str(change_order_id)).execute()

    def get_workflow_status(self, change_order_id: UUID) -> WorkflowStatusResponse:
        """Get workflow status for a change order."""
        result = (
            self.db.table("change_order_approvals")
            .select("*")
            .eq("change_order_id", str(change_order_id))
            .order("sequence_order")
            .execute()
        )
        approvals = result.data or []
        levels = [
            {"level": a["approval_level"], "role": a["approver_role"], "status": a["status"]}
            for a in approvals
        ]
        pending = [a for a in approvals if a.get("status") == "pending"]
        return WorkflowStatusResponse(
            change_order_id=str(change_order_id),
            status="active" if pending else "complete",
            approval_levels=levels,
            is_complete=len(pending) == 0,
            can_proceed=len(pending) > 0,
        )
