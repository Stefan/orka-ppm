"""
AI-generated recommendations for change order approval workflow.

Rule-based hints (category, amount, history); optional variance/audit context.
"""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from config.database import supabase
from models.change_orders import AIRecommendationItem, AIRecommendationsResponse

logger = logging.getLogger(__name__)

# Thresholds for recommendation rules
_HIGH_AMOUNT_THRESHOLD = 50_000.0
_EXECUTIVE_REVIEW_THRESHOLD = 100_000.0


class ChangeOrderAIRecommendationsService:
    """Generate approval recommendations from change order context and optional variance/audit."""

    def get_recommendations(
        self,
        change_order_id: UUID,
        include_variance_audit_context: bool = True,
    ) -> AIRecommendationsResponse:
        """
        Return list of recommendation hints for the approval workflow.
        Does not override human decisions; for display only.
        """
        recommendations: List[AIRecommendationItem] = []

        co = self._get_change_order(change_order_id)
        if not co:
            return AIRecommendationsResponse(recommendations=[])

        category = (co.get("change_category") or "").strip()
        proposed = float(co.get("proposed_cost_impact") or 0)
        project_id = co.get("project_id")

        # Amount-based
        if proposed >= _EXECUTIVE_REVIEW_THRESHOLD:
            recommendations.append(
                AIRecommendationItem(
                    text=f"Proposed impact (${proposed:,.0f}) exceeds ${_EXECUTIVE_REVIEW_THRESHOLD:,.0f}. Consider executive-level review.",
                    type="risk",
                )
            )
        elif proposed >= _HIGH_AMOUNT_THRESHOLD:
            recommendations.append(
                AIRecommendationItem(
                    text=f"Amount exceeds ${_HIGH_AMOUNT_THRESHOLD:,.0f}. Verify cost breakdown and contingency.",
                    type="checkpoint",
                )
            )

        # Category-based
        if category == "owner_directed":
            recommendations.append(
                AIRecommendationItem(
                    text="Owner-directed change: typical checkpoints – confirm scope and schedule impact.",
                    type="checkpoint",
                )
            )
        elif category == "design_change":
            recommendations.append(
                AIRecommendationItem(
                    text="Design change: ensure design authority sign-off and impact on other disciplines.",
                    type="hint",
                )
            )
        elif category == "field_condition":
            recommendations.append(
                AIRecommendationItem(
                    text="Field condition: verify documentation (photos, logs) and unforeseeability.",
                    type="hint",
                )
            )
        elif category == "regulatory":
            recommendations.append(
                AIRecommendationItem(
                    text="Regulatory change: confirm regulatory reference and compliance documentation.",
                    type="checkpoint",
                )
            )

        # Optional variance and audit context
        variance_audit_context: Optional[Dict[str, Any]] = None
        if include_variance_audit_context and project_id and supabase:
            variance_audit_context = self._get_variance_audit_context(project_id)
            if variance_audit_context:
                rec = variance_audit_context.get("recommendation_text")
                if rec:
                    recommendations.append(
                        AIRecommendationItem(text=rec, type="hint")
                    )

        return AIRecommendationsResponse(
            recommendations=recommendations,
            variance_audit_context=variance_audit_context,
        )

    def _get_change_order(self, change_order_id: UUID) -> Optional[Dict[str, Any]]:
        """Load change order row by id."""
        if not supabase:
            return None
        try:
            result = (
                supabase.table("change_orders")
                .select("id, project_id, change_category, proposed_cost_impact")
                .eq("id", str(change_order_id))
                .eq("is_active", True)
                .limit(1)
                .execute()
            )
            if result.data and len(result.data) > 0:
                return result.data[0]
        except Exception as e:
            logger.warning("Failed to load change order for AI recommendations: %s", e)
        return None

    def _get_variance_audit_context(self, project_id: str) -> Optional[Dict[str, Any]]:
        """
        Optional context from project variance (budget vs actual) and recent audit.
        Uses DB only; no HTTP to variance/audit routers.
        """
        if not supabase:
            return None
        out: Dict[str, Any] = {}

        try:
            proj = (
                supabase.table("projects")
                .select("budget, actual_cost")
                .eq("id", project_id)
                .limit(1)
                .execute()
            )
            if proj.data and len(proj.data) > 0:
                row = proj.data[0]
                budget = float(row.get("budget") or 0)
                actual = float(row.get("actual_cost") or 0)
                if budget > 0:
                    pct = (actual - budget) / budget * 100
                    out["project_budget"] = budget
                    out["project_actual_cost"] = actual
                    out["variance_percentage"] = round(pct, 1)
                    if abs(pct) >= 5:
                        out["recommendation_text"] = (
                            f"Project has {'over' if pct > 0 else 'under'} budget variance of {abs(pct):.1f}%. "
                            "Consider impact of this change order on overall budget."
                        )
        except Exception as e:
            logger.debug("Variance context for project %s: %s", project_id, e)

        # Optional: recent audit events count for this project (if audit_logs has entity refs)
        try:
            audit = (
                supabase.table("audit_logs")
                .select("id", count="exact")
                .eq("entity_type", "project")
                .eq("entity_id", project_id)
                .limit(1)
                .execute()
            )
            if getattr(audit, "count", None) is not None and audit.count > 0:
                out["recent_audit_events_count"] = audit.count
        except Exception:
            pass

        return out if out else None
