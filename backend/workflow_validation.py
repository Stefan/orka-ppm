"""
Central status transition validation for change order workflow.
Used by change_order_manager_service and change_order_approval_workflow_service.
"""

ALLOWED_TRANSITIONS = {
    "draft": ["submitted"],
    "submitted": ["under_review", "rejected"],
    "under_review": ["approved", "rejected"],
    "approved": ["implemented"],
    "rejected": [],
    "implemented": [],
}


def validate_status_transition(current: str, new: str) -> bool:
    """Validate that the status transition is allowed. Returns True if valid."""
    allowed = ALLOWED_TRANSITIONS.get(current, [])
    return new in allowed


def get_allowed_next_statuses(current: str) -> list:
    """Return list of allowed next statuses for the current status."""
    return list(ALLOWED_TRANSITIONS.get(current, []))
