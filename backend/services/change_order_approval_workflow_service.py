"""
Change Order Approval Workflow Engine Service

Manages multi-level approval workflows for change orders.
Configurable approval levels by cost threshold; delegation supported.
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

# Configurable approval levels: (cost_threshold_max, role_name). None = no upper bound.
APPROVAL_LEVELS_CONFIG = [
    {"level": 1, "role": "project_manager", "cost_threshold_max": 50000},
    {"level": 2, "role": "portfolio_manager", "cost_threshold_max": 200000},
    {"level": 3, "role": "executive", "cost_threshold_max": None},
]


def _levels_for_cost(cost: float) -> List[Dict[str, Any]]:
    """Determine which approval levels apply: level 1 always; level 2 if cost > 50k; level 3 if cost > 200k."""
    out = []
    for c in APPROVAL_LEVELS_CONFIG:
        out.append({"level": c["level"], "role": c["role"], "limit": c["cost_threshold_max"]})
        if c["cost_threshold_max"] is not None and cost <= c["cost_threshold_max"]:
            break
    return out if out else [{"level": 1, "role": "project_manager", "limit": None}]


def _resolve_approver_for_role(project_id: str, role: str) -> Optional[str]:
    """Resolve approver user id for project/role. Returns None if not found (assignment via delegation)."""
    try:
        # Try project_members or similar if table exists
        r = (
            supabase.table("project_members")
            .select("user_id")
            .eq("project_id", project_id)
            .eq("role", role)
            .limit(1)
            .execute()
        )
        if r.data and len(r.data) > 0:
            return str(r.data[0].get("user_id"))
    except Exception:
        pass
    return None


class ChangeOrderApprovalWorkflowService:
    """Service for change order approval workflows."""

    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")

    def initiate_workflow(
        self, change_order_id: UUID, config: ApprovalWorkflowConfig
    ) -> ApprovalWorkflowResponse:
        """Initiate approval workflow for a change order. Levels driven by cost; approver resolved or fallback to created_by."""
        co_result = (
            self.db.table("change_orders")
            .select("id, project_id, proposed_cost_impact, created_by, required_approval_date")
            .eq("id", str(change_order_id))
            .execute()
        )
        if not co_result.data:
            raise ValueError("Change order not found")

        co = co_result.data[0]
        cost = float(co.get("proposed_cost_impact", 0))
        project_id = str(co.get("project_id", ""))
        created_by = str(co.get("created_by", ""))
        levels = _levels_for_cost(cost)
        if not levels:
            levels = [{"level": 1, "role": "project_manager", "limit": None}]

        approvals = []
        for idx, lvl in enumerate(levels):
            approver_user_id = _resolve_approver_for_role(project_id, lvl["role"]) or created_by
            approval_data = {
                "change_order_id": str(change_order_id),
                "approval_level": lvl["level"],
                "approver_role": lvl["role"],
                "approver_user_id": approver_user_id,
                "approval_limit": lvl.get("limit"),
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
        """Get pending approvals for a user (assigned or delegated to them)."""
        user_str = str(user_id)
        result = (
            self.db.table("change_order_approvals")
            .select("id, change_order_id, approval_level, approval_date")
            .eq("status", "pending")
            .or_(f"approver_user_id.eq.{user_str},delegated_to.eq.{user_str}")
            .execute()
        )
        items = []
        for row in result.data or []:
            co_id = row["change_order_id"]
            co_result = (
                self.db.table("change_orders")
                .select("change_order_number, title, proposed_cost_impact, required_approval_date")
                .eq("id", co_id)
                .execute()
            )
            co = co_result.data[0] if co_result.data else {}
            due = co.get("required_approval_date") or row.get("approval_date")
            items.append(
                PendingApprovalResponse(
                    id=str(row["id"]),
                    change_order_id=str(co_id),
                    change_order_number=co.get("change_order_number", ""),
                    change_order_title=co.get("title", ""),
                    approval_level=row["approval_level"],
                    proposed_cost_impact=float(co.get("proposed_cost_impact", 0)),
                    due_date=due,
                )
            )
        return items

    def delegate(self, approval_id: UUID, delegate_to_user_id: UUID, current_user_id: UUID) -> ApprovalResponse:
        """Delegate a pending approval to another user. Only approver or current delegate may delegate."""
        result = (
            self.db.table("change_order_approvals")
            .select("id, approver_user_id, delegated_to, status")
            .eq("id", str(approval_id))
            .execute()
        )
        if not result.data:
            raise ValueError("Approval not found")
        row = result.data[0]
        if row.get("status") != "pending":
            raise ValueError("Only pending approvals can be delegated")
        approver = str(row.get("approver_user_id") or "")
        delegated = str(row.get("delegated_to") or "")
        current = str(current_user_id)
        if current != approver and current != delegated:
            raise ValueError("Only the assigned approver or delegate can delegate this approval")
        self.db.table("change_order_approvals").update({
            "delegated_to": str(delegate_to_user_id),
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", str(approval_id)).execute()
        return ApprovalResponse(
            approval_id=str(approval_id),
            status="delegated",
            message="Approval delegated",
        )

    def _can_act_on_approval(self, row: Dict[str, Any], current_user_id: UUID) -> bool:
        """True if current user is the approver or the delegate for this approval."""
        current = str(current_user_id)
        return current == str(row.get("approver_user_id") or "") or current == str(row.get("delegated_to") or "")

    def approve(
        self, approval_id: UUID, decision: ApprovalDecision, current_user_id: Optional[UUID] = None
    ) -> ApprovalResponse:
        """Process approval decision. If current_user_id provided, verifies user is approver or delegate."""
        result = (
            self.db.table("change_order_approvals")
            .select("*")
            .eq("id", str(approval_id))
            .execute()
        )
        if not result.data:
            raise ValueError("Approval not found")
        row = result.data[0]
        if current_user_id and not self._can_act_on_approval(row, current_user_id):
            raise ValueError("Only the assigned approver or delegate can approve")
        update_payload = {
            "status": "approved",
            "approval_date": datetime.utcnow().isoformat(),
            "comments": decision.comments,
            "conditions": decision.conditions,
        }
        self.db.table("change_order_approvals").update(update_payload).eq("id", str(approval_id)).execute()
        change_order_id = row["change_order_id"]
        self._check_workflow_completion(UUID(change_order_id))
        return ApprovalResponse(
            approval_id=str(approval_id),
            status="approved",
            message="Change order approved",
        )

    def reject(
        self, approval_id: UUID, reason: RejectionReason, current_user_id: Optional[UUID] = None
    ) -> ApprovalResponse:
        """Process rejection. If current_user_id provided, verifies user is approver or delegate."""
        result = (
            self.db.table("change_order_approvals")
            .select("change_order_id, approver_user_id, delegated_to")
            .eq("id", str(approval_id))
            .execute()
        )
        if not result.data:
            raise ValueError("Approval not found")
        row = result.data[0]
        if current_user_id and not self._can_act_on_approval(row, current_user_id):
            raise ValueError("Only the assigned approver or delegate can reject")
        reject_payload = {
            "status": "rejected",
            "approval_date": datetime.utcnow().isoformat(),
            "comments": reason.comments,
        }
        if reason.conditions is not None:
            reject_payload["conditions"] = reason.conditions
        self.db.table("change_order_approvals").update(reject_payload).eq("id", str(approval_id)).execute()

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
        """Get workflow status for a change order. Levels include approval_date and comments/conditions for audit."""
        result = (
            self.db.table("change_order_approvals")
            .select("*")
            .eq("change_order_id", str(change_order_id))
            .order("sequence_order")
            .execute()
        )
        approvals = result.data or []
        levels = []
        for a in approvals:
            level_info = {
                "level": a["approval_level"],
                "role": a["approver_role"],
                "status": a["status"],
            }
            if a.get("approval_date"):
                level_info["approval_date"] = a["approval_date"]
            if a.get("approver_user_id"):
                level_info["approver_user_id"] = str(a["approver_user_id"])
            if a.get("delegated_to"):
                level_info["delegated_to"] = str(a["delegated_to"])
            if a.get("comments") is not None:
                level_info["comments"] = a["comments"]
            if a.get("conditions") is not None:
                level_info["conditions"] = a["conditions"]
            levels.append(level_info)
        pending = [a for a in approvals if a.get("status") == "pending"]
        return WorkflowStatusResponse(
            change_order_id=str(change_order_id),
            status="active" if pending else "complete",
            approval_levels=levels,
            is_complete=len(pending) == 0,
            can_proceed=len(pending) > 0,
        )
