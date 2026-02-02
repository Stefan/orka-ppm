"""
Schedule cache (Task 17.1).
In-memory TTL cache for schedule GET and critical path; invalidate on schedule/task changes.
"""

import logging
import time
from typing import Any, Dict, Optional
from uuid import UUID

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 60
_schedule_cache: Dict[str, tuple[float, Any]] = {}
_critical_path_cache: Dict[str, tuple[float, Any]] = {}


def _get_cached(key: str, cache: Dict[str, tuple[float, Any]], ttl: int = CACHE_TTL_SECONDS) -> Optional[Any]:
    if key not in cache:
        return None
    ts, value = cache[key]
    if time.time() - ts > ttl:
        del cache[key]
        return None
    return value


def _set_cached(key: str, value: Any, cache: Dict[str, tuple[float, Any]]) -> None:
    cache[key] = (time.time(), value)


def get_schedule_cached(schedule_id: UUID) -> Optional[Any]:
    """Get schedule with tasks from cache if valid."""
    return _get_cached(str(schedule_id), _schedule_cache)


def set_schedule_cached(schedule_id: UUID, data: Any) -> None:
    """Cache schedule with tasks."""
    _set_cached(str(schedule_id), data, _schedule_cache)


def invalidate_schedule(schedule_id: UUID) -> None:
    """Invalidate cache when schedule or tasks change."""
    sid = str(schedule_id)
    _schedule_cache.pop(sid, None)
    _critical_path_cache.pop(sid, None)


def get_critical_path_cached(schedule_id: UUID) -> Optional[Any]:
    """Get critical path from cache if valid."""
    return _get_cached(f"cp_{schedule_id}", _critical_path_cache)


def set_critical_path_cached(schedule_id: UUID, data: Any) -> None:
    """Cache critical path result."""
    _set_cached(f"cp_{schedule_id}", data, _critical_path_cache)
