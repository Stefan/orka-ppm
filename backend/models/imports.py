"""
Import Actuals and Commitments Pydantic models

This module defines the data models for importing financial actuals and commitments
data into the PPM system. It includes validation, parsing, and response models.

Requirements: 2.3, 3.3
"""

from pydantic import BaseModel, Field, field_validator
from datetime import date, datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from decimal import Decimal, InvalidOperation
from enum import Enum

from .base import BaseResponse


class ImportType(str, Enum):
    """Import type enumeration"""
    actuals = "actuals"
    commitments = "commitments"


class ImportStatus(str, Enum):
    """Import status enumeration"""
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    partial = "partial"


class ActualCreate(BaseModel):
    """
    Model for creating an actual record from import data.
    
    Validates and parses financial document data including amounts
    with various decimal separators and date formats.
    
    Requirements: 2.3
    """
    # Required fields
    fi_doc_no: str = Field(..., description="Financial Document Number", min_length=1, max_length=50)
    posting_date: date = Field(..., description="Date when the transaction was posted")
    document_date: Optional[date] = Field(None, description="Date of the original document")
    vendor: Optional[str] = Field(None, description="Vendor name", max_length=255)
    vendor_description: Optional[str] = Field(None, description="Vendor description", max_length=500)
    project_nr: str = Field(..., description="Project number", min_length=1, max_length=50)
    wbs_element: Optional[str] = Field(None, description="Work Breakdown Structure element", max_length=100)
    amount: Decimal = Field(..., description="Transaction amount")
    currency: str = Field(default="EUR", description="Currency code", max_length=3)
    item_text: Optional[str] = Field(None, description="Item description text")
    document_type: Optional[str] = Field(None, description="Document type", max_length=50)
    
    # Additional fields from CSV
    document_type_desc: Optional[str] = Field(None, description="Document type description", max_length=500)
    po_no: Optional[str] = Field(None, description="Purchase order number", max_length=50)
    po_line_no: Optional[int] = Field(None, description="Purchase order line number")
    vendor_invoice_no: Optional[str] = Field(None, description="Vendor invoice number", max_length=100)
    project_description: Optional[str] = Field(None, description="Project description", max_length=500)
    wbs_description: Optional[str] = Field(None, description="WBS description", max_length=500)
    gl_account: Optional[str] = Field(None, description="General ledger account", max_length=50)
    gl_account_desc: Optional[str] = Field(None, description="GL account description", max_length=500)
    cost_center: Optional[str] = Field(None, description="Cost center", max_length=50)
    cost_center_desc: Optional[str] = Field(None, description="Cost center description", max_length=500)
    product_desc: Optional[str] = Field(None, description="Product description", max_length=500)
    document_header_text: Optional[str] = Field(None, description="Document header text")
    payment_terms: Optional[str] = Field(None, description="Payment terms", max_length=100)
    net_due_date: Optional[date] = Field(None, description="Net due date")
    creation_date: Optional[date] = Field(None, description="Creation date")
    sap_invoice_no: Optional[str] = Field(None, description="SAP invoice number", max_length=100)
    investment_profile: Optional[str] = Field(None, description="Investment profile", max_length=50)
    account_group_level1: Optional[str] = Field(None, description="Account group (Orka Level 1)", max_length=100)
    account_subgroup_level2: Optional[str] = Field(None, description="Account subgroup (Orka Level 2)", max_length=100)
    account_level3: Optional[str] = Field(None, description="Account (Orka Level 3)", max_length=100)
    value_in_document_currency: Optional[Decimal] = Field(None, description="Value in document currency")
    document_currency_code: Optional[str] = Field(None, description="Document currency code", max_length=3)
    quantity: Optional[Decimal] = Field(None, description="Quantity")
    personnel_number: Optional[str] = Field(None, description="Personnel number", max_length=50)
    po_final_invoice_indicator: Optional[str] = Field(None, description="PO final invoice indicator", max_length=10)
    value_type: Optional[str] = Field(None, description="Value type", max_length=50)
    miro_invoice_no: Optional[str] = Field(None, description="MIRO invoice number", max_length=100)
    goods_received_value: Optional[Decimal] = Field(None, description="Goods received value")

    @field_validator('amount', 'value_in_document_currency', 'quantity', 'goods_received_value', mode='before')
    @classmethod
    def parse_amount(cls, v: Any) -> Optional[Decimal]:
        """
        Parse amount from various formats.
        Handles comma as decimal separator (European format).
        """
        if v is None or v == '':
            return None
        if isinstance(v, Decimal):
            return v
        if isinstance(v, (int, float)):
            return Decimal(str(v))
        if isinstance(v, str):
            # Handle European format with comma as decimal separator
            cleaned = v.strip().replace(' ', '')
            if not cleaned:
                return None
            # If there's both comma and dot, determine which is decimal separator
            if ',' in cleaned and '.' in cleaned:
                # European format: 1.234,56 -> 1234.56
                if cleaned.rfind(',') > cleaned.rfind('.'):
                    cleaned = cleaned.replace('.', '').replace(',', '.')
                # US format: 1,234.56 -> 1234.56
                else:
                    cleaned = cleaned.replace(',', '')
            elif ',' in cleaned:
                # Only comma present - treat as decimal separator
                cleaned = cleaned.replace(',', '.')
            try:
                return Decimal(cleaned)
            except InvalidOperation:
                raise ValueError(f"Invalid amount format: {v}")
        raise ValueError(f"Cannot parse amount from type {type(v)}")

    @field_validator('posting_date', 'document_date', 'net_due_date', 'creation_date', mode='before')
    @classmethod
    def parse_date(cls, v: Any) -> Optional[date]:
        """Parse date from various formats."""
        if v is None or v == '':
            return None
        if isinstance(v, date):
            return v
        if isinstance(v, datetime):
            return v.date()
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return None
            # Try common date formats
            formats = [
                '%Y-%m-%d',      # ISO format: 2024-01-15
                '%d.%m.%Y',      # European: 15.01.2024
                '%d/%m/%Y',      # European slash: 15/01/2024
                '%m/%d/%Y',      # US format: 01/15/2024
                '%Y/%m/%d',      # Alternative ISO: 2024/01/15
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(v, fmt).date()
                except ValueError:
                    continue
            raise ValueError(f"Invalid date format: {v}. Expected YYYY-MM-DD")
        raise ValueError(f"Cannot parse date from type {type(v)}")

    model_config = {
        "json_schema_extra": {
            "example": {
                "fi_doc_no": "FI-2024-001234",
                "posting_date": "2024-01-15",
                "document_date": "2024-01-14",
                "vendor": "Vendor A",
                "vendor_description": "Vendor Description",
                "project_nr": "P0001",
                "wbs_element": "WBS-001",
                "amount": "12345.67",
                "currency": "EUR",
                "item_text": "Item Description",
                "document_type": "Invoice"
            }
        }
    }


class CommitmentCreate(BaseModel):
    """
    Model for creating a commitment record from import data.
    
    Validates and parses purchase order data including amounts
    with various decimal separators and date formats.
    
    Requirements: 3.3
    """
    # Required fields (vendor optional: CSV often has empty vendor; po_number/project_nr normalized if empty)
    po_number: str = Field(..., description="Purchase Order Number", min_length=1, max_length=50)
    po_date: date = Field(..., description="Purchase Order date")
    vendor: Optional[str] = Field(None, description="Vendor name", max_length=255)
    vendor_description: Optional[str] = Field(None, description="Vendor description", max_length=500)
    project_nr: str = Field(..., description="Project number", min_length=1, max_length=50)
    wbs_element: Optional[str] = Field(None, description="Work Breakdown Structure element", max_length=100)
    po_net_amount: Decimal = Field(..., description="Purchase Order net amount")
    total_amount: Decimal = Field(..., description="Total amount including taxes")
    currency: str = Field(default="EUR", description="Currency code", max_length=3)
    po_status: Optional[str] = Field(None, description="Purchase Order status", max_length=50)
    po_line_nr: int = Field(default=1, description="Purchase Order line number", ge=1)
    delivery_date: Optional[date] = Field(None, description="Expected delivery date")
    
    # Additional fields from CSV
    requester: Optional[str] = Field(None, description="Person who requested the purchase order", max_length=255)
    po_created_by: Optional[str] = Field(None, description="User who created the purchase order", max_length=255)
    shopping_cart_number: Optional[str] = Field(None, description="Shopping cart reference number", max_length=100)
    project_description: Optional[str] = Field(None, description="Project description", max_length=500)
    wbs_description: Optional[str] = Field(None, description="WBS element description", max_length=500)
    cost_center: Optional[str] = Field(None, description="Cost center code", max_length=100)
    cost_center_description: Optional[str] = Field(None, description="Cost center description", max_length=500)
    tax_amount: Optional[Decimal] = Field(None, description="Tax amount")
    po_line_text: Optional[str] = Field(None, description="Purchase order line item description")
    document_currency_code: Optional[str] = Field(None, description="Currency code in original document", max_length=3)
    value_in_document_currency: Optional[Decimal] = Field(None, description="Value in original document currency")
    investment_profile: Optional[str] = Field(None, description="Investment profile (capex/opex)", max_length=50)
    account_group_level1: Optional[str] = Field(None, description="Account group at Orka Level 1", max_length=100)
    account_subgroup_level2: Optional[str] = Field(None, description="Account subgroup at Orka Level 2", max_length=100)
    account_level3: Optional[str] = Field(None, description="Account at Orka Level 3", max_length=100)
    change_date: Optional[date] = Field(None, description="Date when commitment was last changed")
    purchase_requisition: Optional[str] = Field(None, description="Purchase requisition number", max_length=100)
    procurement_plant: Optional[str] = Field(None, description="Procurement plant identifier", max_length=100)
    contract_number: Optional[str] = Field(None, description="Contract reference number", max_length=100)
    joint_commodity_code: Optional[str] = Field(None, description="Joint commodity code", max_length=100)
    po_title: Optional[str] = Field(None, description="Purchase order title/description")
    version: Optional[str] = Field(None, description="Version number", max_length=50)
    fi_doc_no: Optional[str] = Field(None, description="Financial document number", max_length=50)

    @field_validator('po_number', 'project_nr', mode='before')
    @classmethod
    def empty_string_to_placeholder(cls, v: Any) -> str:
        """Allow empty CSV cells for required string fields; use placeholder so row imports."""
        if v is None:
            return "-"
        s = str(v).strip() if v else ""
        return s if s else "-"

    @field_validator('po_net_amount', 'total_amount', 'tax_amount', 'value_in_document_currency', mode='before')
    @classmethod
    def parse_amount(cls, v: Any) -> Optional[Decimal]:
        """
        Parse amount from various formats.
        Handles comma as decimal separator (European format).
        """
        if v is None or v == '':
            return None
        if isinstance(v, Decimal):
            return v
        if isinstance(v, (int, float)):
            return Decimal(str(v))
        if isinstance(v, str):
            # Handle European format with comma as decimal separator
            cleaned = v.strip().replace(' ', '')
            if not cleaned:
                return None
            # If there's both comma and dot, determine which is decimal separator
            if ',' in cleaned and '.' in cleaned:
                # European format: 1.234,56 -> 1234.56
                if cleaned.rfind(',') > cleaned.rfind('.'):
                    cleaned = cleaned.replace('.', '').replace(',', '.')
                # US format: 1,234.56 -> 1234.56
                else:
                    cleaned = cleaned.replace(',', '')
            elif ',' in cleaned:
                # Only comma present - treat as decimal separator
                cleaned = cleaned.replace(',', '.')
            try:
                return Decimal(cleaned)
            except InvalidOperation:
                raise ValueError(f"Invalid amount format: {v}")
        raise ValueError(f"Cannot parse amount from type {type(v)}")

    @field_validator('po_date', 'delivery_date', 'change_date', mode='before')
    @classmethod
    def parse_date(cls, v: Any) -> Optional[date]:
        """Parse date from various formats."""
        if v is None or v == '':
            return None
        if isinstance(v, date):
            return v
        if isinstance(v, datetime):
            return v.date()
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return None
            # Try common date formats
            formats = [
                '%Y-%m-%d',      # ISO format: 2024-01-15
                '%d.%m.%Y',      # European: 15.01.2024
                '%d/%m/%Y',      # European slash: 15/01/2024
                '%m/%d/%Y',      # US format: 01/15/2024
                '%Y/%m/%d',      # Alternative ISO: 2024/01/15
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(v, fmt).date()
                except ValueError:
                    continue
            raise ValueError(f"Invalid date format: {v}. Expected YYYY-MM-DD")
        raise ValueError(f"Cannot parse date from type {type(v)}")

    model_config = {
        "json_schema_extra": {
            "example": {
                "po_number": "PO-2024-001234",
                "po_date": "2024-01-15",
                "vendor": "Vendor A",
                "vendor_description": "Vendor Description",
                "project_nr": "P0001",
                "wbs_element": "WBS-001",
                "po_net_amount": "10000.00",
                "total_amount": "11900.00",
                "currency": "EUR",
                "po_status": "Open",
                "po_line_nr": 1,
                "delivery_date": "2024-02-15"
            }
        }
    }


class ImportError(BaseModel):
    """Model for individual import errors."""
    row: int = Field(..., description="Row number where the error occurred")
    field: str = Field(..., description="Field name that caused the error")
    value: Any = Field(None, description="The invalid value")
    error: str = Field(..., description="Error message describing the issue")


class ImportResult(BaseModel):
    """
    Model for import operation results.
    
    Contains summary statistics and error details for an import operation.
    """
    success: bool = Field(..., description="Whether the import was successful overall")
    import_id: str = Field(..., description="Unique identifier for this import operation")
    total_records: int = Field(..., description="Total number of records in the import file")
    success_count: int = Field(..., description="Number of successfully imported records")
    duplicate_count: int = Field(..., description="Number of duplicate records skipped")
    error_count: int = Field(..., description="Number of records that failed validation")
    errors: List[ImportError] = Field(default_factory=list, description="List of validation errors")
    message: str = Field(..., description="Human-readable summary message")

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "import_id": "import-actuals-1706367600",
                "total_records": 100,
                "success_count": 95,
                "duplicate_count": 3,
                "error_count": 2,
                "errors": [
                    {
                        "row": 15,
                        "field": "amount",
                        "value": "invalid",
                        "error": "Amount must be a numeric value"
                    }
                ],
                "message": "Import completed: 95 records imported, 3 duplicates skipped, 2 errors"
            }
        }
    }


class ImportAuditLog(BaseModel):
    """
    Model for import audit log entries.
    
    Tracks all import operations for auditing and troubleshooting.
    """
    id: UUID = Field(..., description="Unique identifier for the audit log entry")
    import_id: str = Field(..., description="Import operation identifier")
    user_id: str = Field(..., description="ID of the user who performed the import")
    import_type: ImportType = Field(..., description="Type of import (actuals or commitments)")
    total_records: int = Field(default=0, description="Total number of records processed")
    success_count: int = Field(default=0, description="Number of successfully imported records")
    duplicate_count: int = Field(default=0, description="Number of duplicate records skipped")
    error_count: int = Field(default=0, description="Number of records that failed")
    status: ImportStatus = Field(default=ImportStatus.pending, description="Current status of the import")
    errors: Optional[List[Dict[str, Any]]] = Field(None, description="Detailed error information")
    created_at: datetime = Field(..., description="When the import started")
    completed_at: Optional[datetime] = Field(None, description="When the import completed")

    model_config = {
        "from_attributes": True
    }


class ImportAuditLogResponse(BaseResponse):
    """Response model for import audit log entries."""
    import_id: str
    user_id: str
    import_type: str
    total_records: int
    success_count: int
    duplicate_count: int
    error_count: int
    status: str
    errors: Optional[List[Dict[str, Any]]] = None
    completed_at: Optional[datetime] = None


class ActualResponse(BaseResponse):
    """
    Response model for actual records.
    
    Used when returning actual records from the API.
    """
    fi_doc_no: str
    posting_date: date
    document_date: Optional[date] = None
    vendor: str
    vendor_description: Optional[str] = None
    project_id: Optional[str] = None
    project_nr: str
    wbs_element: Optional[str] = None
    amount: Decimal
    currency: str
    item_text: Optional[str] = None
    document_type: Optional[str] = None


class CommitmentResponse(BaseResponse):
    """
    Response model for commitment records.
    
    Used when returning commitment records from the API.
    """
    po_number: str
    po_date: date
    vendor: str
    vendor_description: Optional[str] = None
    project_id: Optional[str] = None
    project_nr: str
    wbs_element: Optional[str] = None
    po_net_amount: Decimal
    total_amount: Decimal
    currency: str
    po_status: Optional[str] = None
    po_line_nr: int
    delivery_date: Optional[date] = None


class ActualsList(BaseModel):
    """Response model for paginated list of actuals."""
    items: List[ActualResponse]
    total: int
    page: int
    page_size: int


class CommitmentsList(BaseModel):
    """Response model for paginated list of commitments."""
    items: List[CommitmentResponse]
    total: int
    page: int
    page_size: int
