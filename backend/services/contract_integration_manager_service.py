"""
Contract Integration Manager Service

Validates change orders against contract provisions,
applies contract pricing, checks authorization limits.
"""

from typing import List, Dict, Any, Optional
from uuid import UUID
import logging

from config.database import supabase
from models.change_orders import (
    ContractComplianceResponse,
    ContractPricingRequest,
    ContractPricingResponse,
    ContractChangeProvision,
    PricingMethod,
)

logger = logging.getLogger(__name__)


class ContractIntegrationManagerService:
    """Service for contract integration and compliance."""

    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")

    def validate_contract_compliance(
        self, change_order_id: UUID
    ) -> ContractComplianceResponse:
        """Validate change order against contract terms."""
        co_result = (
            self.db.table("change_orders")
            .select("*, project_id, proposed_cost_impact, change_category")
            .eq("id", str(change_order_id))
            .execute()
        )
        if not co_result.data:
            return ContractComplianceResponse(
                is_compliant=False,
                issues=["Change order not found"],
            )

        co = co_result.data[0]
        project_id = co["project_id"]
        cost = float(co.get("proposed_cost_impact", 0))
        issues = []
        recommendations = []
        provisions_applied = []

        # Check contract provisions
        prov_result = (
            self.db.table("contract_change_provisions")
            .select("*")
            .eq("project_id", project_id)
            .eq("is_active", True)
            .execute()
        )

        for prov in prov_result.data or []:
            limit = prov.get("monetary_limit")
            if limit and cost > float(limit):
                issues.append(
                    f"Change order cost {cost} exceeds contract limit {limit} for {prov.get('contract_section')}"
                )
                recommendations.append("Obtain higher approval authority or split change order")
            else:
                provisions_applied.append(prov.get("contract_section", ""))

        return ContractComplianceResponse(
            is_compliant=len(issues) == 0,
            issues=issues,
            recommendations=recommendations,
            provisions_applied=provisions_applied,
        )

    def get_contract_provisions(self, project_id: UUID) -> List[Dict[str, Any]]:
        """Get contract change provisions for a project."""
        result = (
            self.db.table("contract_change_provisions")
            .select("*")
            .eq("project_id", str(project_id))
            .eq("is_active", True)
            .execute()
        )
        return result.data or []

    def apply_contract_pricing(
        self, change_order_id: UUID, request: ContractPricingRequest
    ) -> ContractPricingResponse:
        """Apply contract pricing mechanisms to change order."""
        co_result = (
            self.db.table("change_orders")
            .select("proposed_cost_impact, project_id")
            .eq("id", str(change_order_id))
            .execute()
        )
        if not co_result.data:
            return ContractPricingResponse(
                applied=False,
                pricing_method="none",
                total_cost=0,
                details={"error": "Change order not found"},
            )

        co = co_result.data[0]
        base_cost = float(co["proposed_cost_impact"])

        # Get project provisions for pricing
        provs = self.get_contract_provisions(UUID(co["project_id"]))
        pricing_method = request.pricing_method.value if request.pricing_method else "unit_rates"
        if provs and provs[0].get("pricing_mechanism"):
            pricing_method = provs[0]["pricing_mechanism"]

        # Simple application - in practice would use contract rates
        return ContractPricingResponse(
            applied=request.use_contract_rates,
            pricing_method=pricing_method,
            total_cost=base_cost,
            details={
                "base_cost": base_cost,
                "contract_rates_applied": request.use_contract_rates,
            },
        )
