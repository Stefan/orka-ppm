"""
Natural Language Action Parser / Service.
Parses user queries for actionable intents (fetch_data, navigate, open_modal) and executes or returns commands.
Task 11: Costbook data integration (budget, actual_cost, variance) filtered by organization_id.
"""

import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# Variance threshold (Requirement 8.3): flag when variance exceeds 10%
VARIANCE_THRESHOLD_PERCENT = 10.0


def _format_currency(value: float, currency: str = "USD") -> str:
    """Format currency consistently for help responses (Requirement 8.2)."""
    try:
        return f"{currency} {value:,.2f}"
    except Exception:
        return str(value)


class NaturalLanguageActionsService:
    """Parse natural language help queries for actions (fetch EAC, navigate, open modal) and execute or return structured result."""

    def __init__(self, supabase_client=None):
        self.supabase = supabase_client

    async def parse_and_execute(
        self,
        query: str,
        context: Dict[str, Any],
        user_id: str,
        organization_id: str,
    ) -> Dict[str, Any]:
        """
        Determine if the query is actionable; if so, execute and return result.
        Returns: { action_type, action_data, confidence, explanation }
        """
        q = (query or "").strip().lower()
        if not q:
            return self._no_action("Empty query")

        # Simple intent detection (no OpenAI required for baseline)
        if any(w in q for w in ("eac", "estimate at completion", "estimate at completion")):
            data = await self._fetch_project_data(organization_id, user_id)
            return {
                "action_type": "fetch_data",
                "action_data": {"type": "eac", "data": data},
                "confidence": 0.85,
                "explanation": "Retrieved project EAC data for your organization.",
            }
        # Task 11: Costbook intent (budget, actual cost, variance)
        if any(w in q for w in ("costbook", "budget", "actual cost", "variance", "spend", "spending")):
            costbook_data = await self._fetch_costbook_data(organization_id)
            return {
                "action_type": "fetch_data",
                "action_data": {"type": "costbook", "data": costbook_data},
                "confidence": 0.85,
                "explanation": "Retrieved costbook data (budget, actual cost, variance) for your organization.",
            }
        if any(w in q for w in ("navigate", "go to", "open ", "show me ")):
            path = self._infer_navigate_path(q)
            return {
                "action_type": "navigate",
                "action_data": {"path": path},
                "confidence": 0.7,
                "explanation": f"Navigate to {path}.",
            }
        if any(w in q for w in ("modal", "dialog", "open costbook")):
            return {
                "action_type": "open_modal",
                "action_data": {"modal": "costbook" if "costbook" in q else "generic"},
                "confidence": 0.65,
                "explanation": "Open the requested modal.",
            }

        return self._no_action("No actionable intent detected")

    def _no_action(self, explanation: str) -> Dict[str, Any]:
        return {
            "action_type": "none",
            "action_data": {},
            "confidence": 0.0,
            "explanation": explanation,
        }

    def _infer_navigate_path(self, query: str) -> str:
        if "project" in query and "detail" in query:
            return "/projects"
        if "costbook" in query:
            return "/costbook"
        if "dashboard" in query:
            return "/dashboards"
        if "financial" in query:
            return "/financials"
        if "risk" in query:
            return "/risks"
        return "/dashboards"

    async def _fetch_project_data(self, organization_id: str, user_id: str) -> List[Dict[str, Any]]:
        """Fetch project/EAC data scoped to organization. Placeholder: return empty or minimal data."""
        if not self.supabase:
            return []
        try:
            r = self.supabase.table("projects").select("id, name, budget, eac").eq("organization_id", organization_id).limit(20).execute()
            return r.data or []
        except Exception as e:
            logger.debug("fetch_project_data failed: %s", e)
            return []

    async def _fetch_costbook_data(self, organization_id: str) -> List[Dict[str, Any]]:
        """
        Task 11.1: Fetch costbook data (budget, actual_cost, variance) per project, filtered by organization_id.
        Returns list of dicts with project_id, project_name, budget, actual_cost, variance, variance_percent,
        variance_over_threshold (True when |variance_percent| > VARIANCE_THRESHOLD_PERCENT).
        """
        if not self.supabase:
            return []
        try:
            proj_q = self.supabase.table("projects").select("id, name, budget, currency").eq("organization_id", organization_id).limit(50)
            proj_r = proj_q.execute()
            projects = proj_r.data or []
            if not projects:
                return []
            project_ids = [str(p["id"]) for p in projects]
            # Actuals: sum amount per project
            act_r = self.supabase.table("actuals").select("project_id, amount").in_("project_id", project_ids).execute()
            actuals_raw = act_r.data or []
            actual_by_project: Dict[str, float] = {}
            for a in actuals_raw:
                pid = str(a.get("project_id", ""))
                amt = float(a.get("amount") or 0)
                actual_by_project[pid] = actual_by_project.get(pid, 0) + amt
            rows: List[Dict[str, Any]] = []
            for p in projects:
                pid = str(p["id"])
                budget = float(p.get("budget") or 0)
                actual_cost = actual_by_project.get(pid, 0.0)
                variance = budget - actual_cost if budget else 0.0
                variance_percent = (variance / budget * 100) if budget else 0.0
                over_threshold = abs(variance_percent) > VARIANCE_THRESHOLD_PERCENT
                currency = (p.get("currency") or "USD")
                rows.append({
                    "project_id": pid,
                    "project_name": p.get("name") or "",
                    "budget": budget,
                    "budget_formatted": _format_currency(budget, currency),
                    "actual_cost": actual_cost,
                    "actual_cost_formatted": _format_currency(actual_cost, currency),
                    "variance": variance,
                    "variance_formatted": _format_currency(variance, currency),
                    "variance_percent": round(variance_percent, 2),
                    "variance_over_threshold": over_threshold,
                })
            return rows
        except Exception as e:
            logger.debug("fetch_costbook_data failed: %s", e)
            return []
