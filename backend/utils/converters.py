"""
Data conversion utilities
"""

from uuid import UUID
from typing import Any, Dict, List, Union

def convert_uuids(data: Any) -> Any:
    """Convert UUID objects to strings for JSON serialization"""
    if isinstance(data, list):
        return [convert_uuids(item) for item in data]
    elif isinstance(data, dict):
        return {key: convert_uuids(value) for key, value in data.items()}
    elif hasattr(data, '__dict__'):
        return convert_uuids(data.__dict__)
    else:
        return str(data) if isinstance(data, UUID) else data