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


class MicrosoftDynamicsAdapter(ErpAdapter):
    """Microsoft Dynamics / PPM – project sync stub."""

    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None):
        self.base_url = base_url
        self.api_key = api_key

    @property
    def adapter_type(self) -> str:
        return "microsoft"

    def sync_commitments(
        self,
        organization_id: Optional[str] = None,
        since: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        logger.info("Microsoft Dynamics: sync_commitments (stub)")
        return {
            "total": 0,
            "inserted": 0,
            "updated": 0,
            "errors": ["Microsoft Dynamics connector not configured"] if not self.api_key else [],
            "rows": [],
            "synced_at": datetime.utcnow().isoformat() + "Z",
        }

    def sync_actuals(
        self,
        organization_id: Optional[str] = None,
        since: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        logger.info("Microsoft Dynamics: sync_actuals (stub)")
        return {
            "total": 0,
            "inserted": 0,
            "updated": 0,
            "errors": ["Microsoft Dynamics connector not configured"] if not self.api_key else [],
            "rows": [],
            "synced_at": datetime.utcnow().isoformat() + "Z",
        }


class OracleNetSuiteAdapter(ErpAdapter):
    """Oracle NetSuite – accounting stub."""

    def __init__(self, account_id: Optional[str] = None, token: Optional[str] = None):
        self.account_id = account_id
        self.token = token

    @property
    def adapter_type(self) -> str:
        return "oracle"

    def sync_commitments(
        self,
        organization_id: Optional[str] = None,
        since: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        logger.info("Oracle NetSuite: sync_commitments (stub)")
        return {
            "total": 0,
            "inserted": 0,
            "updated": 0,
            "errors": ["Oracle NetSuite connector not configured"] if not self.token else [],
            "rows": [],
            "synced_at": datetime.utcnow().isoformat() + "Z",
        }

    def sync_actuals(
        self,
        organization_id: Optional[str] = None,
        since: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        logger.info("Oracle NetSuite: sync_actuals (stub)")
        return {
            "total": 0,
            "inserted": 0,
            "updated": 0,
            "errors": ["Oracle NetSuite connector not configured"] if not self.token else [],
            "rows": [],
            "synced_at": datetime.utcnow().isoformat() + "Z",
        }


class JiraAdapter(ErpAdapter):
    """Jira – agile tasks stub (maps to projects/tasks, not commitments/actuals)."""

    def __init__(self, base_url: Optional[str] = None, token: Optional[str] = None):
        self.base_url = base_url
        self.token = token

    @property
    def adapter_type(self) -> str:
        return "jira"

    def sync_commitments(
        self,
        organization_id: Optional[str] = None,
        since: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        logger.info("Jira: sync_commitments (stub – use project sync)")
        return {
            "total": 0,
            "inserted": 0,
            "updated": 0,
            "errors": [],
            "rows": [],
            "synced_at": datetime.utcnow().isoformat() + "Z",
        }

    def sync_actuals(
        self,
        organization_id: Optional[str] = None,
        since: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        logger.info("Jira: sync_actuals (stub)")
        return {
            "total": 0,
            "inserted": 0,
            "updated": 0,
            "errors": [],
            "rows": [],
            "synced_at": datetime.utcnow().isoformat() + "Z",
        }


class SlackAdapter(ErpAdapter):
    """Slack – notifications stub; no commitments/actuals sync."""

    def __init__(self, webhook_url: Optional[str] = None):
        self.webhook_url = webhook_url

    @property
    def adapter_type(self) -> str:
        return "slack"

    def sync_commitments(
        self,
        organization_id: Optional[str] = None,
        since: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        return {
            "total": 0,
            "inserted": 0,
            "updated": 0,
            "errors": [],
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
            "errors": [],
            "rows": [],
            "synced_at": datetime.utcnow().isoformat() + "Z",
        }


def get_erp_adapter(adapter_type: str = "csv", **kwargs) -> ErpAdapter:
    """Factory: returns adapter for given system."""
    t = adapter_type.lower()
    if t == "sap":
        return SapErpAdapter(host=kwargs.get("host"), client=kwargs.get("client"))
    if t == "microsoft":
        return MicrosoftDynamicsAdapter(base_url=kwargs.get("base_url"), api_key=kwargs.get("api_key"))
    if t == "oracle":
        return OracleNetSuiteAdapter(account_id=kwargs.get("account_id"), token=kwargs.get("token"))
    if t == "jira":
        return JiraAdapter(base_url=kwargs.get("base_url"), token=kwargs.get("token"))
    if t == "slack":
        return SlackAdapter(webhook_url=kwargs.get("webhook_url"))
    return CsvErpAdapter(csv_path=kwargs.get("csv_path"))
