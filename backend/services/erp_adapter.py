"""
Phase 2 – Integration & Customizability: ERP Adapter System
Enterprise Readiness: Abstract ErpAdapter interface with SAP + CSV fallback
"""

import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Callable
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


# Adapter registry: adapter_type -> factory callable (adapter_type, **kwargs) -> ErpAdapter
# New adapters can be registered via register_erp_adapter() without changing this module.
_ERP_ADAPTER_REGISTRY: Dict[str, Callable[..., ErpAdapter]] = {}


def register_erp_adapter(adapter_type: str, factory: Callable[..., ErpAdapter]) -> None:
    """Register a factory for the given adapter_type. Use to add new adapters without editing get_erp_adapter."""
    _ERP_ADAPTER_REGISTRY[adapter_type.lower()] = factory


def _default_erp_adapter_factories() -> Dict[str, Callable[..., ErpAdapter]]:
    """Built-in adapter factories (SAP, CSV, Microsoft, etc.)."""
    return {
        "sap": lambda **kw: SapErpAdapter(host=kw.get("host"), client=kw.get("client")),
        "microsoft": lambda **kw: MicrosoftDynamicsAdapter(base_url=kw.get("base_url"), api_key=kw.get("api_key")),
        "oracle": lambda **kw: OracleNetSuiteAdapter(account_id=kw.get("account_id"), token=kw.get("token")),
        "jira": lambda **kw: JiraAdapter(base_url=kw.get("base_url"), token=kw.get("token")),
        "slack": lambda **kw: SlackAdapter(webhook_url=kw.get("webhook_url")),
        "csv": lambda **kw: CsvErpAdapter(csv_path=kw.get("csv_path")),
    }


def get_erp_adapter(adapter_type: str = "csv", **kwargs) -> ErpAdapter:
    """Factory: returns adapter for given system. Uses registry first, then built-in mapping."""
    t = adapter_type.lower()
    factory = _ERP_ADAPTER_REGISTRY.get(t)
    if factory is not None:
        return factory(**kwargs)
    defaults = _default_erp_adapter_factories()
    if t in defaults:
        return defaults[t](**kwargs)
    return CsvErpAdapter(csv_path=kwargs.get("csv_path"))
