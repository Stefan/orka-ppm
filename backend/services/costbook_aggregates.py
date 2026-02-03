"""
Costbook Aggregates Service
Computes Cost Book columns from projects, commitments, and actuals.
VOWD = Value of Work Done (Actual Cost + Downpayments); Accruals; ETC; EAC; Variance.
"""
from typing import List, Dict, Any, Optional
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

# Open commitment statuses (not yet fully invoiced/closed)
OPEN_PO_STATUSES = {"draft", "approved", "issued", "partially_received"}


def _decimal(value: Any) -> Decimal:
    if value is None:
        return Decimal("0")
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal("0")


def compute_costbook_rows(
    projects: List[Dict[str, Any]],
    commitments_by_project: Dict[str, List[Dict[str, Any]]],
    actuals_by_project: Dict[str, List[Dict[str, Any]]],
) -> List[Dict[str, Any]]:
    """
    Compute costbook aggregate rows per project.
    Uses: projects (id, budget, start_date, end_date), commitments (total_amount, po_status, ...), actuals (amount, ...).
    """
    rows: List[Dict[str, Any]] = []
    for p in projects:
        pid = str(p.get("id", ""))
        budget = _decimal(p.get("budget") or 0)
        start_date = p.get("start_date") or ""
        end_date = p.get("end_date") or ""

        commitments = commitments_by_project.get(pid) or []
        actuals = actuals_by_project.get(pid) or []

        # Approved budget = project budget
        approved_budget = float(budget)
        pending_budget = 0.0  # Placeholder: no separate pending in schema
        control_estimate = float(budget)  # Use budget as control estimate

        # Open committed: sum of commitments with open status
        open_committed = sum(
            _decimal(c.get("total_amount") or c.get("amount") or 0)
            for c in commitments
            if (c.get("po_status") or "").lower() in OPEN_PO_STATUSES
        )
        open_committed = float(open_committed)

        # Invoice value = sum of actuals
        invoice_value = sum(_decimal(a.get("amount") or 0) for a in actuals)
        invoice_value = float(invoice_value)

        # Remaining commitment = open committed minus amount already invoiced (simplified: open_committed - invoice_value if we assume invoice eats commitment)
        remaining_commitment = max(0.0, open_committed - invoice_value)

        # VOWD = Value of Work Done = Actual Cost + Downpayments (Cost Book definition).
        # When schema has no explicit downpayment field: VOWD = invoice_value (sum of actuals).
        # To add downpayments later: sum commitment amounts that are pre-payments/downpayments and add to invoice_value.
        vowd = invoice_value
        # Accruals: received-not-invoiced or committed-not-yet-spent; schema has no explicit accrual field.
        accruals = 0.0

        # ETC / EAC: EAC = ACWP + ETC; use budget - invoice_value as simple ETC proxy
        acwp = invoice_value
        etc = max(0.0, float(budget) - acwp)  # Simple: remaining budget
        eac = acwp + etc
        delta_eac = eac - approved_budget
        variance = approved_budget - eac  # Positive = under budget

        rows.append({
            "project_id": pid,
            "project_name": p.get("name") or "",
            "start_date": start_date,
            "end_date": end_date,
            "pending_budget": pending_budget,
            "approved_budget": approved_budget,
            "control_estimate": control_estimate,
            "open_committed": round(open_committed, 2),
            "invoice_value": round(invoice_value, 2),
            "remaining_commitment": round(remaining_commitment, 2),
            "vowd": round(vowd, 2),
            "accruals": round(accruals, 2),
            "etc": round(etc, 2),
            "eac": round(eac, 2),
            "delta_eac": round(delta_eac, 2),
            "variance": round(variance, 2),
            "currency": p.get("currency") or "USD",
        })
    return rows
