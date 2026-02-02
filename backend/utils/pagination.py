"""
Phase 1 – Security & Scalability: Cursor and offset pagination
Enterprise Readiness: consistent pagination for large datasets
"""

from typing import Any, Generic, List, Optional, TypeVar

T = TypeVar("T")


def cursor_page(
    items: List[T],
    *,
    limit: int,
    cursor_field: str = "id",
    next_cursor: Optional[str] = None,
    prev_cursor: Optional[str] = None,
) -> dict:
    """
    Build paginated response with next_cursor and prev_cursor.
    Caller should pass items already limited to limit+1 to detect has_more.
    """
    has_more = len(items) > limit
    data = items[:limit]
    return {
        "data": data,
        "next_cursor": str(items[limit - 1][cursor_field]) if has_more and data else None,
        "prev_cursor": prev_cursor,
        "has_more": has_more,
    }


def offset_page(
    items: List[T],
    *,
    offset: int,
    limit: int,
    total: Optional[int] = None,
) -> dict:
    """Build offset-based paginated response."""
    return {
        "data": items,
        "offset": offset,
        "limit": limit,
        "total": total,
        "has_more": (offset + len(items)) < (total or offset + len(items) + 1),
    }
