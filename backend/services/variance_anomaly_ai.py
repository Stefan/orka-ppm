"""
Rule-based AI helpers for variance alerts: root cause suggestions and auto-fix recommendations.
Can be extended with LLM later (see FEATURE_AI_GAPS_SPEC.md).
"""

from typing import List, Dict, Any, Optional


def get_root_cause_suggestions(
    alert_id: str,
    project_id: str,
    variance_percentage: float,
    variance_amount: float,
    severity: str,
    details: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Return suggested root causes for a variance alert with confidence (0-100).
    Rule-based implementation; can be replaced or augmented with LLM.
    """
    causes: List[Dict[str, Any]] = []
    details = details or {}

    # Over-budget: common causes with heuristic confidence
    if variance_percentage > 0:
        if variance_percentage >= 15:
            causes.append({
                "cause": "Vendor delay or scope creep – review commitments and timelines",
                "confidence": min(85, 70 + variance_percentage / 2),
            })
        if variance_percentage >= 10:
            causes.append({
                "cause": "Accruals or ETC not updated – align forecast with actuals",
                "confidence": 75,
            })
        causes.append({
            "cause": "Resource or rate variance – check labor and contractor costs",
            "confidence": 65,
        })
    else:
        causes.append({
            "cause": "Under-spend or delayed accruals – confirm timing of remaining work",
            "confidence": 72,
        })

    # Cap at 3 and sort by confidence
    causes = sorted(causes, key=lambda c: c["confidence"], reverse=True)[:3]
    return [{"cause": c["cause"], "confidence_pct": round(c["confidence"], 0)} for c in causes]


def get_auto_fix_suggestions(
    alert_id: str,
    project_id: str,
    variance_percentage: float,
    variance_amount: float,
    currency_code: str = "USD",
    details: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Return concrete adjustment suggestions (e.g. reduce ETC by X) for an alert.
    Rule-based; optional impact simulation can be hooked later.
    """
    suggestions: List[Dict[str, Any]] = []
    details = details or {}
    abs_amount = abs(variance_amount)

    if variance_percentage > 0:
        # Over budget: suggest reducing ETC / accruals
        reduce_etc = round(abs_amount * 0.5, -2)  # suggest reducing ETC by half of overrun
        if reduce_etc > 0:
            suggestions.append({
                "id": f"{alert_id}-etc-1",
                "description": f"Reduce ETC by {currency_code} {reduce_etc:,.0f} to align with trend",
                "metric": "ETC",
                "change": -reduce_etc,
                "unit": currency_code,
                "impact": "Lowers EAC and brings variance toward zero; run impact simulation to confirm.",
            })
        suggestions.append({
            "id": f"{alert_id}-accruals-1",
            "description": "Review and adjust next-period accruals to match actual spend rate",
            "metric": "Accruals",
            "change": 0,
            "unit": "—",
            "impact": "Smooths forecast and improves variance visibility.",
        })
    else:
        suggestions.append({
            "id": f"{alert_id}-replan-1",
            "description": "Confirm remaining scope and timing; consider bringing forward planned work",
            "metric": "Planned value",
            "change": 0,
            "unit": "—",
            "impact": "Reduces under-spend variance or accelerates delivery.",
        })

    return suggestions
