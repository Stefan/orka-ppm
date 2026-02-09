"""
Unit tests for project_sync service (entity-hierarchy).
Spec: .kiro/specs/entity-hierarchy/ Target: 80%+ coverage.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from services.project_sync import (
    fetch_external_projects,
    map_external_to_project,
    match_commitment_to_projects,
    run_sync,
)


# ---- fetch_external_projects ----
@pytest.mark.asyncio
async def test_fetch_external_projects_roche_returns_mock_list():
    result = await fetch_external_projects("roche")
    assert len(result) == 2
    assert result[0]["external_id"] == "RO-001"
    assert result[0]["name"] == "Roche Project Alpha"
    assert result[1]["external_id"] == "RO-002"


@pytest.mark.asyncio
async def test_fetch_external_projects_mock_returns_same():
    result = await fetch_external_projects("mock")
    assert len(result) == 2
    assert result[0]["name"] == "Roche Project Alpha"


@pytest.mark.asyncio
async def test_fetch_external_projects_unknown_source_returns_empty():
    result = await fetch_external_projects("unknown")
    assert result == []


@pytest.mark.asyncio
async def test_fetch_external_projects_accepts_options():
    result = await fetch_external_projects("roche", {"dry_run": True})
    assert len(result) == 2


# ---- map_external_to_project ----
def test_map_external_to_project_uses_name():
    raw = {"name": "My Project", "description": "Desc", "external_id": "X-1"}
    out = map_external_to_project(raw, "pf-1")
    assert out["name"] == "My Project"
    assert out["description"] == "Desc"
    assert out["portfolio_id"] == "pf-1"
    assert out["program_id"] is None
    assert out["status"] == "planning"


def test_map_external_to_project_fallback_to_external_id():
    raw = {"external_id": "X-1"}
    out = map_external_to_project(raw, "pf-1")
    assert out["name"] == "X-1"


def test_map_external_to_project_fallback_to_unnamed():
    out = map_external_to_project({}, "pf-1")
    assert out["name"] == "Unnamed"


def test_map_external_to_project_with_program_id():
    raw = {"name": "P"}
    out = map_external_to_project(raw, "pf-1", program_id="pr-1")
    assert out["program_id"] == "pr-1"


# ---- match_commitment_to_projects ----
@pytest.mark.asyncio
async def test_match_commitment_to_projects_no_db_returns_empty():
    result = await match_commitment_to_projects(None, "PO-1", "Vendor A")
    assert result == []


@pytest.mark.asyncio
async def test_match_commitment_to_projects_empty_projects_returns_empty():
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[]
    )
    result = await match_commitment_to_projects(mock_db, "PO-1", "Vendor", portfolio_id="pf-1")
    assert result == []


@pytest.mark.asyncio
async def test_match_commitment_to_projects_heuristic_vendor_in_name():
    mock_db = MagicMock()
    chain = (
        mock_db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute
    )
    chain.return_value = MagicMock(
        data=[
            {"id": "pj-1", "name": "Project with Vendor Alpha", "description": ""},
            {"id": "pj-2", "name": "Other", "description": ""},
        ]
    )
    result = await match_commitment_to_projects(
        mock_db, "PO-1", "Vendor Alpha", portfolio_id="pf-1", use_ai=False
    )
    assert len(result) == 1
    assert result[0]["project_id"] == "pj-1"
    assert result[0]["score"] == 40
    assert result[0]["reason"] == "keyword match"


@pytest.mark.asyncio
async def test_match_commitment_to_projects_heuristic_po_in_name():
    mock_db = MagicMock()
    chain = (
        mock_db.table.return_value.select.return_value.limit.return_value.execute
    )
    chain.return_value = MagicMock(
        data=[{"id": "pj-1", "name": "Project PO-99", "description": ""}]
    )
    result = await match_commitment_to_projects(
        mock_db, "PO-99", "Vendor", portfolio_id=None, use_ai=False
    )
    assert len(result) == 1
    assert result[0]["score"] == 30


@pytest.mark.asyncio
async def test_match_commitment_to_projects_heuristic_item_text_in_name():
    mock_db = MagicMock()
    chain = (
        mock_db.table.return_value.select.return_value.limit.return_value.execute
    )
    chain.return_value = MagicMock(
        data=[{"id": "pj-1", "name": "Project with Phase 1", "description": ""}]
    )
    result = await match_commitment_to_projects(
        mock_db, "", "", item_text="Phase 1", use_ai=False
    )
    assert len(result) == 1
    assert result[0]["score"] == 20


@pytest.mark.asyncio
async def test_match_commitment_to_projects_heuristic_score_capped_at_100():
    mock_db = MagicMock()
    chain = (
        mock_db.table.return_value.select.return_value.limit.return_value.execute
    )
    chain.return_value = MagicMock(
        data=[
            {
                "id": "pj-1",
                "name": "Vendor X PO-123 Phase 1",
                "description": "Vendor X",
            }
        ]
    )
    result = await match_commitment_to_projects(
        mock_db, "PO-123", "Vendor X", item_text="Phase 1", use_ai=False
    )
    assert len(result) == 1
    assert result[0]["score"] == 100


@pytest.mark.asyncio
async def test_match_commitment_to_projects_heuristic_returns_max_5():
    mock_db = MagicMock()
    chain = (
        mock_db.table.return_value.select.return_value.limit.return_value.execute
    )
    chain.return_value = MagicMock(
        data=[
            {"id": f"pj-{i}", "name": f"Same Vendor {i}", "description": ""}
            for i in range(10)
        ]
    )
    result = await match_commitment_to_projects(
        mock_db, "", "Vendor", use_ai=False
    )
    assert len(result) <= 5


@pytest.mark.asyncio
async def test_match_commitment_to_projects_heuristic_sorted_by_score_desc():
    mock_db = MagicMock()
    chain = (
        mock_db.table.return_value.select.return_value.limit.return_value.execute
    )
    chain.return_value = MagicMock(
        data=[
            {"id": "pj-low", "name": "A", "description": "Vendor"},   # 30
            {"id": "pj-high", "name": "Vendor Project", "description": ""},  # 40
        ]
    )
    result = await match_commitment_to_projects(
        mock_db, "", "Vendor", use_ai=False
    )
    assert len(result) == 2
    assert result[0]["score"] >= result[1]["score"]


@pytest.mark.asyncio
async def test_match_commitment_to_projects_no_match_returns_empty():
    mock_db = MagicMock()
    chain = (
        mock_db.table.return_value.select.return_value.limit.return_value.execute
    )
    chain.return_value = MagicMock(
        data=[{"id": "pj-1", "name": "Unrelated", "description": "Nothing"}]
    )
    result = await match_commitment_to_projects(
        mock_db, "PO-X", "VendorY", use_ai=False
    )
    assert result == []


@pytest.mark.asyncio
async def test_match_commitment_to_projects_db_exception_returns_empty():
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.limit.return_value.execute.side_effect = Exception(
        "DB error"
    )
    result = await match_commitment_to_projects(mock_db, "PO-1", "V", use_ai=False)
    assert result == []


# ---- run_sync ----
@pytest.mark.asyncio
async def test_run_sync_dry_run_does_not_create():
    result = await run_sync(
        MagicMock(), source="mock", portfolio_id="pf-1", dry_run=True
    )
    assert "created" in result
    assert result["created"] == []
    assert "matched" in result


@pytest.mark.asyncio
async def test_run_sync_dry_run_still_returns_matched_when_db_given():
    mock_db = MagicMock()
    chain = (
        mock_db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute
    )
    chain.return_value = MagicMock(
        data=[{"id": "pj-1", "name": "Roche Project Alpha", "description": "Phase 1"}]
    )
    result = await run_sync(mock_db, source="mock", portfolio_id="pf-1", dry_run=True)
    assert result["created"] == []
    assert isinstance(result["matched"], list)


@pytest.mark.asyncio
async def test_run_sync_not_dry_run_creates_projects():
    mock_db = MagicMock()
    mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"id": "new-id", "name": "Roche Project Alpha"}]
    )
    select_chain = (
        mock_db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute
    )
    select_chain.return_value = MagicMock(
        data=[{"id": "pj-1", "name": "Roche Project Alpha", "description": "Phase 1"}]
    )
    result = await run_sync(mock_db, source="mock", portfolio_id="pf-1", dry_run=False)
    assert len(result["created"]) == 2
    assert result["created"][0]["id"] == "new-id"
    assert result["created"][0]["name"] == "Roche Project Alpha"


@pytest.mark.asyncio
async def test_run_sync_no_db_dry_run_returns_empty_created_and_matched():
    result = await run_sync(None, source="mock", portfolio_id="pf-1", dry_run=True)
    assert result["created"] == []
    assert result["matched"] == []


@pytest.mark.asyncio
async def test_run_sync_unknown_source_returns_empty_created():
    result = await run_sync(
        MagicMock(), source="unknown", portfolio_id="pf-1", dry_run=False
    )
    assert result["created"] == []
    assert result["matched"] == []
