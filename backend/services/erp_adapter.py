"""
Phase 2 – Integration & Customizability: ERP Adapter System
Enterprise Readiness: Abstract ErpAdapter interface with SAP + CSV fallback
"""

import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class ErpAdapter(ABC):
    """Abstract ERP adapter for syncing commitments/actuals."""

    @property
    @abstractmethod
    def adapter_type(self) -> str:
        """e.g. 'sap', 'csv', 'mock'."""
        pass

    @abstractmethod
    def sync_commitments(
        self,
        organization_id: Optional[str] = None,
        since: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Sync commitments. Returns { total, inserted, updated, errors, rows }."""
        pass

    @abstractmethod
    def sync_actuals(
        self,
        organization_id: Optional[str] = None,
        since: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Sync actuals. Returns { total, inserted, updated, errors, rows }."""
        pass


class CsvErpAdapter(ErpAdapter):
    """CSV-based fallback: reads from uploaded CSV or configured path."""

    def __init__(self, csv_path: Optional[str] = None):
        self.csv_path = csv_path
        self._rows_cache: List[Dict[str, Any]] = []

    @property
    def adapter_type(self) -> str:
        return "csv"

    def sync_commitments(
        self,
        organization_id: Optional[str] = None,
        since: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """CSV does not auto-sync; returns last imported or empty."""
        return {
            "total": 0,
            "inserted": 0,
            "updated": 0,
            "errors": ["CSV adapter: use import endpoint to load data"],
            "rows": [],
            "synced_at": datetime.utcnow().isoformat() + "Z",
        }

    def sync_actuals(
        self,
        organization_id: Optional[str] = None,
        since: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        return {
            "total": 0,
            "inserted": 0,
            "updated": 0,
            "errors": ["CSV adapter: use import endpoint to load data"],
            "rows": [],
            "synced_at": datetime.utcnow().isoformat() + "Z",
        }


class SapErpAdapter(ErpAdapter):
    """SAP connector stub: replace with real RFC/OData when available."""

    def __init__(self, host: Optional[str] = None, client: Optional[str] = None):
        self.host = host
        self.client = client

    @property
    def adapter_type(self) -> str:
        return "sap"

    def sync_commitments(
        self,
        organization_id: Optional[str] = None,
        since: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        logger.info("SAP adapter: sync_commitments not implemented (stub)")
        return {
            "total": 0,
            "inserted": 0,
            "updated": 0,
            "errors": ["SAP connector not configured; use CSV import"],
            "rows": [],
            "synced_at": datetime.utcnow().isoformat() + "Z",
        }

    def sync_actuals(
        self,
        organization_id: Optional[str] = None,
        since: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        logger.info("SAP adapter: sync_actuals not implemented (stub)")
        return {
            "total": 0,
            "inserted": 0,
            "updated": 0,
            "errors": ["SAP connector not configured; use CSV import"],
            "rows": [],
            "synced_at": datetime.utcnow().isoformat() + "Z",
        }


def get_erp_adapter(adapter_type: str = "csv", **kwargs) -> ErpAdapter:
    """Factory: returns SAP or CSV adapter."""
    if adapter_type.lower() == "sap":
        return SapErpAdapter(host=kwargs.get("host"), client=kwargs.get("client"))
    return CsvErpAdapter(csv_path=kwargs.get("csv_path"))
