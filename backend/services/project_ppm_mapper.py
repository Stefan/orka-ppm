"""
Map PPM (e.g. Roche DIA / Cora) project JSON to project record for DB insert.
Derives name from order_ids[0], description, or external id for linking with commitments/actuals.
"""

from uuid import uuid4
from typing import Any, Dict, Optional

from models.projects import ProjectPpmInput
from models.base import ProjectStatus


def _parse_date(s: Optional[str]):
    """Return date part only for start_date/end_date, or None."""
    if not s:
        return None
    s = s.strip()
    if "T" in s:
        s = s.split("T")[0]
    return s or None


def _parse_ts(s: Optional[str]):
    """Return full ISO string for timestamptz columns, or None."""
    if not s:
        return None
    return s.strip() or None


def _ppm_status_to_internal(ppm_status: Optional[str]) -> str:
    """Map PPM status description to internal project_status."""
    if not ppm_status:
        return ProjectStatus.planning.value
    lower = ppm_status.strip().lower()
    if lower in ("active", "in progress", "running"):
        return ProjectStatus.active.value
    if lower in ("on hold", "on-hold", "on_hold"):
        return "on_hold"
    if lower in ("completed", "closed", "done"):
        return ProjectStatus.completed.value
    if lower in ("cancelled", "canceled"):
        return ProjectStatus.cancelled.value
    if lower in ("planning", "planned", "draft"):
        return ProjectStatus.planning.value
    return ProjectStatus.planning.value


def ppm_input_to_project_record(ppm: ProjectPpmInput, portfolio_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Build project record for DB insert from PPM payload.
    name: first order_ids entry, or first line of description, or "Project {id}".
    portfolio_id: optional; when None, project is not linked to a portfolio.
    """
    # Derive name for display and for linking commitments/actuals (project_nr)
    if ppm.order_ids:
        name = ppm.order_ids[0]
    elif ppm.description:
        first_line = (ppm.description or "").strip().split("\n")[0][:255]
        name = first_line or f"Project {ppm.id or '?'}"
    else:
        name = f"Project {ppm.id or '?'}"

    start_date = _parse_date(ppm.start_date)
    end_date = _parse_date(ppm.finish_date)
    status = _ppm_status_to_internal(ppm.project_status_description)

    record: Dict[str, Any] = {
        "id": str(uuid4()),
        "portfolio_id": portfolio_id,  # None allowed: project not linked to portfolio
        "name": name,
        "description": ppm.description,
        "status": status,
        "health": "green",
        "actual_cost": 0.0,
        "start_date": start_date,
        "end_date": end_date,
        "external_id": ppm.id,
        "parent_project_external_ids": ppm.parent_project_ids,
        "archived": ppm.archived,
        "live_date": _parse_ts(ppm.live_date),
        "date_last_updated": _parse_ts(ppm.date_last_updated),
        "percentage_complete": ppm.percentage_complete,
        "project_type_id": ppm.project_type_id,
        "project_type_description": ppm.project_type_description,
        "project_status_id": ppm.project_status_id,
        "project_status_description": ppm.project_status_description,
        "project_phase_id": ppm.project_phase_id,
        "project_phase_description": ppm.project_phase_description,
        "ppm_project_home_url": ppm.ppm_project_home_url,
        "legal_entity_id": ppm.legal_entity_id,
        "legal_entity_description": ppm.legal_entity_description,
        "order_ids": ppm.order_ids,
        "pm_technique": ppm.pm_technique,
        "pm_technique_description": ppm.pm_technique_description,
        "freeze_period": ppm.freeze_period,
        "freeze_period_description": ppm.freeze_period_description,
        "forecast_display_setting": ppm.forecast_display_setting,
        "cost_centre": ppm.cost_centre,
        "country_id": ppm.country_id,
        "currency": ppm.currency,
    }
    return record
