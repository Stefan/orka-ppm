"""
Project sync service: fetch from external source (e.g. Roche), map to projects, AI-matching for commitments/actuals.
Spec: .kiro/specs/entity-hierarchy/
"""

import logging
from typing import List, Optional, Any
from uuid import UUID

logger = logging.getLogger(__name__)


async def fetch_external_projects(source: str, options: Optional[dict] = None) -> List[dict]:
    """Fetch projects from external API (e.g. Roche). Returns list of raw records."""
    if source == "roche" or source == "mock":
        # Mock for development; replace with real Roche API call
        return [
            {"external_id": "RO-001", "name": "Roche Project Alpha", "description": "Phase 1"},
            {"external_id": "RO-002", "name": "Roche Project Beta", "description": "Phase 2"},
        ]
    return []


def map_external_to_project(raw: dict, portfolio_id: str, program_id: Optional[str] = None) -> dict:
    """Map external record to project insert payload."""
    return {
        "portfolio_id": portfolio_id,
        "program_id": program_id,
        "name": raw.get("name") or raw.get("external_id") or "Unnamed",
        "description": raw.get("description"),
        "status": "planning",
    }


async def match_commitment_to_projects(
    db,
    po_number: str,
    vendor: str,
    amount: Optional[float] = None,
    item_text: Optional[str] = None,
    portfolio_id: Optional[str] = None,
    use_ai: bool = True,
) -> List[dict]:
    """
    AI/heuristic matching: suggest which project a commitment/actual belongs to.
    Returns list of { project_id, project_name, score, reason }.
    Target ≥95% accuracy with Grok/OpenAI; fallback heuristic.
    """
    if not db:
        return []
    try:
        select = "id, name, description"
        query = db.table("projects").select(select)
        if portfolio_id:
            query = query.eq("portfolio_id", portfolio_id)
        r = query.limit(100).execute()
        projects = list(r.data or [])
        if not projects:
            return []

        if use_ai:
            try:
                from config.settings import settings
                if getattr(settings, "OPENAI_API_KEY", None):
                    from openai import AsyncOpenAI
                    client = AsyncOpenAI(
                        api_key=settings.OPENAI_API_KEY,
                        base_url=getattr(settings, "OPENAI_BASE_URL", None),
                    )
                    text = "\n".join(
                        f"- {p['id']}: {p.get('name', '')} - {p.get('description', '') or ''}"
                        for p in projects[:30]
                    )
                    prompt = (
                        f"Given PO number '{po_number}', vendor '{vendor}'"
                        + (f", amount {amount}" if amount else "")
                        + (f", item '{item_text}'" if item_text else "")
                        + f", which project best matches? Reply with JSON array of objects: "
                        + '{"project_id": "uuid", "score": 0-100, "reason": "short reason"}. '
                        f"Projects:\n{text}"
                    )
                    resp = await client.chat.completions.create(
                        model=getattr(settings, "OPENAI_MODEL", "gpt-4"),
                        messages=[{"role": "user", "content": prompt}],
                        max_tokens=512,
                    )
                    content = (resp.choices[0].message.content or "").strip()
                    if "```" in content:
                        content = content.split("```")[1].replace("json", "").strip()
                    import json
                    arr = json.loads(content)
                    id_to_name = {str(p["id"]): p.get("name", "") for p in projects}
                    return [
                        {
                            "project_id": str(x.get("project_id", "")),
                            "project_name": id_to_name.get(str(x.get("project_id", "")), ""),
                            "score": min(100, max(0, int(x.get("score", 0)))),
                            "reason": x.get("reason"),
                        }
                        for x in arr
                        if x.get("project_id") in id_to_name
                    ][:5]
            except Exception as e:
                logger.warning("AI matching failed, using heuristic: %s", e)

        # Heuristic: keyword match on name/description
        vendor_lower = (vendor or "").lower()
        po_lower = (po_number or "").lower()
        results = []
        for p in projects:
            name = (p.get("name") or "").lower()
            desc = (p.get("description") or "").lower()
            score = 0
            if vendor_lower and vendor_lower in name:
                score += 40
            if vendor_lower and vendor_lower in desc:
                score += 30
            if po_lower and po_lower in name:
                score += 30
            if item_text and item_text.lower() in name:
                score += 20
            if score > 0:
                results.append({
                    "project_id": str(p["id"]),
                    "project_name": p.get("name", ""),
                    "score": min(100, score),
                    "reason": "keyword match",
                })
        results.sort(key=lambda x: -x["score"])
        return results[:5]
    except Exception as e:
        logger.exception("match_commitment_to_projects failed: %s", e)
        return []


async def run_sync(
    db,
    source: str,
    portfolio_id: str,
    program_id: Optional[str] = None,
    dry_run: bool = True,
) -> dict:
    """
    Run sync: fetch external projects, optionally create them, return created + matched.
    """
    raw_list = await fetch_external_projects(source, {"dry_run": dry_run})
    created = []
    if not dry_run and db:
        for raw in raw_list:
            try:
                payload = map_external_to_project(raw, portfolio_id, program_id)
                payload["health"] = "green"
                r = db.table("projects").insert(payload).execute()
                if r.data:
                    created.append({"id": r.data[0]["id"], "name": r.data[0].get("name", "")})
            except Exception as e:
                logger.warning("Create project failed: %s", e)
    matched = []
    if raw_list and db:
        first = raw_list[0]
        matched = await match_commitment_to_projects(
            db,
            po_number=first.get("external_id", ""),
            vendor=first.get("name", ""),
            item_text=first.get("description"),
            portfolio_id=portfolio_id,
        )
    return {"created": created, "matched": matched}
