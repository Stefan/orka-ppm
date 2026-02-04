"""
Change Order Document Manager Service

Manages document upload, versioning, and retrieval for change orders.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
import logging

from config.database import supabase
from models.change_orders import ChangeOrderDocument, DocumentType

logger = logging.getLogger(__name__)


class ChangeOrderDocumentManagerService:
    """Service for change order document management."""

    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")

    def upload_document(
        self,
        change_order_id: UUID,
        document_type: str,
        file_name: str,
        file_path: str,
        file_size: int,
        mime_type: str,
        uploaded_by: UUID,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Record document upload (actual file storage would be handled by storage service)."""
        doc_data = {
            "change_order_id": str(change_order_id),
            "document_type": document_type,
            "file_name": file_name,
            "file_path": file_path,
            "file_size": file_size,
            "mime_type": mime_type,
            "uploaded_by": str(uploaded_by),
            "description": description,
            "is_current_version": True,
        }
        result = self.db.table("change_order_documents").insert(doc_data).execute()
        if not result.data:
            raise RuntimeError("Failed to save document record")
        return result.data[0]

    def get_documents(self, change_order_id: UUID) -> List[Dict[str, Any]]:
        """Get all documents for a change order."""
        result = (
            self.db.table("change_order_documents")
            .select("*")
            .eq("change_order_id", str(change_order_id))
            .order("upload_date", desc=True)
            .execute()
        )
        return result.data or []

    def get_document(self, document_id: UUID) -> Optional[Dict[str, Any]]:
        """Get single document by ID."""
        result = (
            self.db.table("change_order_documents")
            .select("*")
            .eq("id", str(document_id))
            .execute()
        )
        return result.data[0] if result.data else None
