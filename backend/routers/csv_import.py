"""
CSV import functionality endpoints
"""

import logging
import os
from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File, Query, Request
from fastapi.responses import StreamingResponse
from uuid import UUID
from typing import Optional, Dict, Any, List
import csv
import io
import json
import re
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)
_DEBUG_LOG = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".cursor", "debug.log"))

from pydantic import BaseModel

from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission
from config.database import supabase, service_supabase
from utils.converters import convert_uuids
from services.actuals_commitments_import import ActualsCommitmentsImportService
from services.enterprise_audit_service import EnterpriseAuditService
from services.csv_mapping_suggestions import suggest_mapping
from models.csv_import_mappings import CsvImportMappingCreate, CsvImportMappingResponse

router = APIRouter(prefix="/csv-import", tags=["csv-import"])

# Max upload size for commitments/actuals CSV (avoids OOM and timeouts; see docs on large imports)
MAX_CSV_UPLOAD_BYTES = 80 * 1024 * 1024  # 80 MB


class SuggestMappingBody(BaseModel):
    headers: List[str]
    import_type: str = "commitments"


def map_csv_columns(rows: List[Dict[str, Any]], import_type: str) -> List[Dict[str, Any]]:
    """
    Map CSV column names to expected field names.
    
    Handles various column name formats (with spaces, different casing, etc.)
    and maps them to the standardized field names expected by the Pydantic models.
    """
    if import_type == "commitments":
        # Canonical commitments CSV columns (Orka). Cora in headers is mapped to Orka at lookup.
        # One canonical header per target; variants (case, spaces, underscores) matched via _normalize_header.
        column_mapping = {
            'PO Number': 'po_number', 'PO Date': 'po_date', 'Vendor': 'vendor', 'Vendor Description': 'vendor_description',
            'Requester': 'requester', 'PO Created By': 'po_created_by', 'Shopping Cart Number': 'shopping_cart_number',
            'Project': 'project_nr', 'Project Description': 'project_description', 'WBS Element': 'wbs_element',
            'WBS Element Description': 'wbs_description', 'Cost Center': 'cost_center', 'Cost Center Description': 'cost_center_description',
            'PO Net Amount': 'po_net_amount', 'Tax Amount': 'tax_amount', 'Total Amount Legal Entity Currency': 'total_amount',
            'Total Amount Legal Entity currency': 'total_amount', 'PO Line Nr.': 'po_line_nr', 'PO Line Nr': 'po_line_nr',
            'PO Status': 'po_status', 'PO Line Text': 'po_line_text', 'Delivery Date': 'delivery_date',
            'Legal Entity Currency Code': 'currency', 'Value in document currency': 'value_in_document_currency',
            'Document currency code': 'document_currency_code', 'Investment Profile': 'investment_profile',
            'Account Group (Orka Level 1)': 'account_group_level1', 'Account Sub Group (Orka Level 2)': 'account_subgroup_level2',
            'Account (Orka Level 3)': 'account_level3', 'Change Date': 'change_date', 'Purchase requisition': 'purchase_requisition',
            'Procurement Plant': 'procurement_plant', 'Contract #': 'contract_number', 'Joint Commodity Code': 'joint_commodity_code',
            'PO Title': 'po_title', 'Version': 'version', 'FI Doc No': 'fi_doc_no', 'FI Doc No.': 'fi_doc_no',
        }
    else:  # actuals
        # Canonical actuals CSV columns (Orka). Cora in headers is mapped to Orka at lookup.
        column_mapping = {
            'FI Doc No': 'fi_doc_no', 'FI Doc No.': 'fi_doc_no', 'FI Doc Date': 'document_date', 'Posting Date': 'posting_date',
            'Document Date': 'document_date', 'Document Type': 'document_type', 'Document Type Desc': 'document_type_desc',
            'PO No': 'po_no', 'PO Line No': 'po_line_no', 'Vendor': 'vendor', 'Vendor Description': 'vendor_description',
            'Vendor Invoice No': 'vendor_invoice_no', 'Project': 'project_nr', 'Project Nr': 'project_nr', 'Project Nr.': 'project_nr',
            'Project Description': 'project_description', 'WBS': 'wbs_element', 'WBS Element': 'wbs_element', 'WBS Description': 'wbs_description',
            'G/L Account': 'gl_account', 'G/L Account Desc': 'gl_account_desc', 'Cost Center': 'cost_center', 'Cost Center Desc': 'cost_center_desc',
            'Product Desc': 'product_desc', 'Item Text': 'item_text', 'Document Header Text': 'document_header_text',
            'Payment Terms': 'payment_terms', 'Net Due Date': 'net_due_date', 'Amount': 'amount',
            'Invoice Amount Legal Entity currency': 'amount', 'Invoice Amount': 'amount', 'Creation date': 'creation_date',
            'SAP Invoice No.': 'sap_invoice_no', 'Investment Profile': 'investment_profile',
            'Account Group (Orka Level 1)': 'account_group_level1', 'Account Sub Group (Orka Level 2)': 'account_subgroup_level2',
            'Account (Orka Level 3)': 'account_level3', 'Legal Entity Currency Code': 'currency',
            'Value in document currency': 'value_in_document_currency', 'Document currency Code': 'document_currency_code',
            'Quantity': 'quantity', 'Personnel Number': 'personnel_number', 'PO Final Invoice indicator': 'po_final_invoice_indicator',
            'Value Type': 'value_type', 'Miro Invoice #': 'miro_invoice_no', 'Goods Received Value': 'goods_received_value',
        }

    # Normalize header for matching: lowercase, non-word chars to underscore, collapse underscores
    def _normalize_header(h: str) -> str:
        s = (h or "").strip().lower()
        s = re.sub(r"[^\w\s]", " ", s)
        s = re.sub(r"\s+", "_", s).strip("_")
        return s or h

    normalized_lookup = {_normalize_header(k): v for k, v in column_mapping.items()}

    def _lookup_key(key: str) -> str:
        if not key:
            return key
        if key in column_mapping:
            return column_mapping[key]
        orka_key = key.replace("Cora", "Orka").replace("cora", "orka")
        if orka_key in column_mapping:
            return column_mapping[orka_key]
        norm = _normalize_header(key)
        if norm in normalized_lookup:
            return normalized_lookup[norm]
        if _normalize_header(orka_key) in normalized_lookup:
            return normalized_lookup[_normalize_header(orka_key)]
        return _normalize_header(orka_key)

    mapped_rows = []
    for row in rows:
        mapped_row = {}
        for csv_col, value in row.items():
            mapped_col = _lookup_key(csv_col)
            mapped_row[mapped_col] = value
        mapped_rows.append(mapped_row)
    
    return mapped_rows


@router.post("/suggest-mapping")
async def post_suggest_mapping(
    body: SuggestMappingBody,
    current_user=Depends(get_current_user),
):
    """
    Suggest PPM field mapping for CSV headers (Orka-Surpass Phase 2.2).
    Returns list of { source_header, target_field, confidence } for each header.
    """
    if body.import_type not in ("actuals", "commitments"):
        return suggest_mapping(body.headers, "commitments")
    return suggest_mapping(body.headers, body.import_type)


def _user_id_from_user(user: Dict[str, Any]) -> str:
    uid = user.get("user_id") or user.get("id") or user.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="User ID not found")
    return str(uid)


@router.get("/mappings", response_model=List[CsvImportMappingResponse])
async def list_csv_import_mappings(
    import_type: Optional[str] = Query(None, description="Filter by import_type: commitments | actuals"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List saved CSV column mappings for the current user (Phase 2.2)."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    user_id = _user_id_from_user(current_user)
    try:
        query = supabase.table("csv_import_mappings").select("*").eq("user_id", user_id)
        if import_type and import_type in ("commitments", "actuals"):
            query = query.eq("import_type", import_type)
        response = query.order("created_at", desc=True).execute()
        return [CsvImportMappingResponse(**convert_uuids(row)) for row in (response.data or [])]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to list mappings")


@router.post("/mappings", response_model=CsvImportMappingResponse, status_code=201)
async def create_csv_import_mapping(
    body: CsvImportMappingCreate,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.data_import)),
):
    """Save a CSV column mapping for reuse (Phase 2.2)."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    user_id = _user_id_from_user(current_user)
    org_id = current_user.get("organization_id") or current_user.get("tenant_id")
    row = {
        "user_id": user_id,
        "organization_id": str(org_id) if org_id else None,
        "name": body.name,
        "import_type": body.import_type,
        "mapping": body.mapping,
    }
    try:
        response = supabase.table("csv_import_mappings").insert(row).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Insert failed")
        return CsvImportMappingResponse(**convert_uuids(response.data[0]))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to save mapping")


@router.delete("/mappings/{mapping_id}", status_code=204)
async def delete_csv_import_mapping(
    mapping_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Delete a saved CSV mapping (Phase 2.2). Idempotent: 204 even if not found."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    user_id = _user_id_from_user(current_user)
    try:
        supabase.table("csv_import_mappings").delete().eq("id", str(mapping_id)).eq("user_id", user_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to delete mapping")


def _clear_table_before_import(db_client, table_name: str) -> int:
    """Delete all rows from the given table. Prefer RPC (server-side) to avoid timeouts and large responses."""
    # #region agent log
    try:
        with open(_DEBUG_LOG, "a") as _f:
            _f.write(json.dumps({"location": "csv_import:_clear_table_before_import:entry", "message": "clear started", "data": {"table_name": table_name}, "timestamp": datetime.utcnow().isoformat(), "hypothesisId": "H1"}) + "\n")
    except Exception:
        pass
    # #endregion
    rpc_name = f"clear_{table_name}_for_import"
    if table_name in ("commitments", "actuals"):
        try:
            total_deleted = 0
            max_iterations = 2000  # 2000 * 500 = 1M rows max
            for iteration in range(max_iterations):
                # #region agent log
                try:
                    with open(_DEBUG_LOG, "a") as _f:
                        _f.write(json.dumps({"location": "csv_import:rpc_call", "message": "calling RPC", "data": {"rpc_name": rpc_name, "iteration": iteration}, "timestamp": datetime.utcnow().isoformat(), "hypothesisId": "H2"}) + "\n")
                except Exception:
                    pass
                # #endregion
                r = db_client.rpc(rpc_name).execute()
                raw = r.data
                if raw is None:
                    n = 0
                elif isinstance(raw, (int, float)):
                    n = int(raw)
                elif isinstance(raw, list) and len(raw) > 0:
                    row = raw[0]
                    if isinstance(row, dict):
                        val = row.get(rpc_name) or next(iter(row.values()), 0)
                    else:
                        val = row
                    n = int(val) if val is not None else 0
                else:
                    n = 0
                total_deleted += n
                if n == 0:
                    break
                # #region agent log
                try:
                    with open(_DEBUG_LOG, "a") as _f:
                        _f.write(json.dumps({"location": "csv_import:rpc_ok", "message": "RPC batch returned", "data": {"rpc_name": rpc_name, "deleted": n, "total_so_far": total_deleted}, "timestamp": datetime.utcnow().isoformat(), "hypothesisId": "H3"}) + "\n")
                except Exception:
                    pass
                # #endregion
            logger.info("Clear table via RPC %s: deleted %d rows total", rpc_name, total_deleted)
            return total_deleted
        except Exception as e:
            # #region agent log
            try:
                with open(_DEBUG_LOG, "a") as _f:
                    _f.write(json.dumps({"location": "csv_import:rpc_failed", "message": "RPC exception", "data": {"rpc_name": rpc_name, "error": str(e), "type": type(e).__name__}, "timestamp": datetime.utcnow().isoformat(), "hypothesisId": "H2"}) + "\n")
            except Exception:
                pass
            # #endregion
            logger.warning("Clear table RPC %s failed (%s), using fallback delete", rpc_name, e)
    # Fallback: client-side chunked delete (can timeout or hit response size limits)
    # #region agent log
    try:
        with open(_DEBUG_LOG, "a") as _f:
            _f.write(json.dumps({"location": "csv_import:fallback_delete", "message": "using fallback chunked delete", "data": {"table_name": table_name}, "timestamp": datetime.utcnow().isoformat(), "hypothesisId": "H4"}) + "\n")
    except Exception:
        pass
    # #endregion
    total_deleted = 0
    select_chunk = 200
    delete_batch = 25
    while True:
        r = db_client.table(table_name).select("id").limit(select_chunk).execute()
        ids = [row["id"] for row in (r.data or []) if row.get("id") is not None]
        if not ids:
            break
        for i in range(0, len(ids), delete_batch):
            batch = ids[i : i + delete_batch]
            db_client.table(table_name).delete().in_("id", batch).execute()
            total_deleted += len(batch)
    # #region agent log
    try:
        with open(_DEBUG_LOG, "a") as _f:
            _f.write(json.dumps({"location": "csv_import:fallback_done", "message": "fallback delete completed", "data": {"table_name": table_name, "total_deleted": total_deleted}, "timestamp": datetime.utcnow().isoformat(), "hypothesisId": "H4"}) + "\n")
    except Exception:
        pass
    # #endregion
    return total_deleted


@router.post("/upload")
async def upload_csv_file(
    request: Request,
    file: UploadFile = File(...),
    import_type: str = Query(...),  # "actuals" or "commitments"
    anonymize: bool = Query(True, description="Anonymize sensitive data (vendor, project_nr, amounts, etc.)"),
    clear_before_import: bool = Query(False, description="Delete all existing rows in the target table before importing"),
    stream: bool = Query(False, description="Stream progress as NDJSON (progress events + final result)"),
    current_user = Depends(require_permission(Permission.data_import)),
):
    """
    Upload and process CSV file for actuals or commitments import.
    
    This endpoint handles CSV imports for financial data (actuals and commitments).
    The data is validated, optionally anonymized, and linked to projects automatically.
    If clear_before_import=True, the target table (actuals or commitments) is emptied before import.
    Max file size: 80 MB (larger files may cause timeouts; split by period or use multiple uploads).
    """
    try:
        if not file.filename or not file.filename.lower().endswith('.csv'):
            raise HTTPException(status_code=400, detail="File must be a CSV file")
        
        # Validate import type
        if import_type not in ["actuals", "commitments"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid import_type. Must be 'actuals' or 'commitments'"
            )
        
        # Read CSV content
        content = await file.read()
        if len(content) > MAX_CSV_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {MAX_CSV_UPLOAD_BYTES // (1024*1024)} MB. Split the file or use multiple uploads."
            )
        try:
            csv_content = content.decode('utf-8')
        except UnicodeDecodeError:
            # Try with latin-1 encoding if UTF-8 fails
            csv_content = content.decode('latin-1')
        
        # Auto-detect delimiter by checking first line
        first_line = csv_content.split('\n')[0] if csv_content else ''
        delimiter = ';' if ';' in first_line else ','
        
        # Parse CSV with detected delimiter
        csv_reader = csv.DictReader(io.StringIO(csv_content), delimiter=delimiter)
        rows = list(csv_reader)
        
        if not rows:
            raise HTTPException(status_code=400, detail="CSV file is empty")
        
        # Log first row for debugging
        if rows:
            print(f"CSV delimiter detected: '{delimiter}'")
            print(f"CSV headers: {list(rows[0].keys())}")
            print(f"First row sample: {rows[0]}")
        
        # Map CSV column names to expected field names
        rows = map_csv_columns(rows, import_type)
        
        # Initialize import service with service role client (bypasses RLS)
        user_id = current_user.get("user_id") or current_user.get("id")
        
        # Use service role client if available, otherwise fall back to regular client
        db_client = service_supabase if service_supabase else supabase
        if not db_client:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Optionally clear target table before import
        if clear_before_import:
            table_name = "actuals" if import_type == "actuals" else "commitments"
            # #region agent log
            try:
                with open(_DEBUG_LOG, "a") as _f:
                    _f.write(json.dumps({"location": "csv_import:upload:before_clear", "message": "clear_before_import True", "data": {"import_type": import_type, "table_name": table_name}, "timestamp": datetime.utcnow().isoformat(), "hypothesisId": "H1"}) + "\n")
            except Exception:
                pass
            # #endregion
            try:
                _clear_table_before_import(db_client, table_name)
            except Exception as clear_err:
                err_str = str(clear_err)
                if "statement timeout" in err_str.lower() or "57014" in err_str:
                    raise HTTPException(
                        status_code=504,
                        detail=f"Clearing the {table_name} table timed out. Try again without 'Clear before import', or clear the table first (e.g. via script or SQL).",
                    ) from clear_err
                raise
        
        import_service = ActualsCommitmentsImportService(db_client, user_id)

        if stream:
            async def stream_body():
                progress = {"inserted": 0, "total": 0}

                def on_progress(inserted: int, total: int) -> None:
                    progress["inserted"] = inserted
                    progress["total"] = total

                async def run_import():
                    if import_type == "actuals":
                        return await import_service.import_actuals(
                            rows, anonymize=anonymize, progress_callback=on_progress
                        )
                    return await import_service.import_commitments(
                        rows, anonymize=anonymize, progress_callback=on_progress
                    )

                task = asyncio.create_task(run_import())
                try:
                    while not task.done():
                        if progress["total"] > 0:
                            yield json.dumps({
                                "type": "progress",
                                "inserted": progress["inserted"],
                                "total": progress["total"],
                            }) + "\n"
                        await asyncio.sleep(0.15)
                    result = task.result()
                except Exception as e:
                    yield json.dumps({
                        "type": "result",
                        "success": False,
                        "records_processed": 0,
                        "records_imported": 0,
                        "errors": [{"row": 0, "field": "import", "message": str(e)}],
                        "warnings": [],
                        "import_id": "",
                    }) + "\n"
                    return
                try:
                    ip = request.client.host if request.client else None
                    EnterpriseAuditService().log(
                        user_id=str(user_id),
                        action="CREATE",
                        entity=f"csv_import_{import_type}",
                        new_value=json.dumps({
                            "import_id": result.import_id,
                            "total_records": result.total_records,
                            "success_count": result.success_count,
                            "error_count": len(result.errors),
                        }, default=str),
                        ip=ip,
                    )
                except Exception as e:
                    print(f"Enterprise audit log failed: {e}")
                yield json.dumps({
                    "type": "result",
                    "success": result.success,
                    "records_processed": result.total_records,
                    "records_imported": result.success_count,
                    "errors": [
                        {"row": err.row, "field": err.field, "message": err.error}
                        for err in result.errors
                    ],
                    "warnings": [],
                    "import_id": result.import_id,
                }) + "\n"

            return StreamingResponse(
                stream_body(),
                media_type="application/x-ndjson",
            )

        # Process import based on type (non-streaming)
        if import_type == "actuals":
            result = await import_service.import_actuals(rows, anonymize=anonymize)
        else:
            result = await import_service.import_commitments(rows, anonymize=anonymize)

        # Phase 1: SOX audit log
        try:
            ip = request.client.host if request.client else None
            EnterpriseAuditService().log(
                user_id=str(user_id),
                action="CREATE",
                entity=f"csv_import_{import_type}",
                new_value=json.dumps({
                    "import_id": result.import_id,
                    "total_records": result.total_records,
                    "success_count": result.success_count,
                    "error_count": len(result.errors),
                }, default=str),
                ip=ip,
            )
        except Exception as e:
            print(f"Enterprise audit log failed: {e}")

        return {
            "success": result.success,
            "records_processed": result.total_records,
            "records_imported": result.success_count,
            "errors": [
                {"row": err.row, "field": err.field, "message": err.error}
                for err in result.errors
            ],
            "warnings": [],
            "import_id": result.import_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        err_str = str(e)
        if "statement timeout" in err_str.lower() or "57014" in err_str:
            raise HTTPException(
                status_code=504,
                detail="Import timed out (database statement limit). Try a smaller file, or split the CSV and import in parts.",
            ) from e
        print(f"CSV upload error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process CSV upload: {str(e)}"
        )


@router.get("/template/{import_type}")
async def get_csv_template(
    import_type: str,
    current_user = Depends(get_current_user)
):
    """
    Get CSV template for actuals or commitments import.
    
    Returns the column headers and an example row for the specified import type.
    """
    try:
        # Templates aligned with models/imports.py (ActualCreate, CommitmentCreate) and DB columns.
        # Headers use canonical names from map_csv_columns so downloaded CSV maps without custom mapping.
        templates = {
            "actuals": {
                "headers": [
                    "FI Doc No", "Posting Date", "Document Date", "Document Type", "Document Type Desc",
                    "Vendor", "Vendor Description", "Vendor Invoice No", "Project Nr", "Project Description",
                    "WBS Element", "WBS Description", "G/L Account", "G/L Account Desc", "Cost Center", "Cost Center Desc",
                    "Item Text", "Amount", "Legal Entity Currency Code", "Value in document currency", "Document currency code",
                    "PO No", "PO Line No", "Product Desc", "Document Header Text", "Payment Terms", "Net Due Date",
                    "Creation date", "SAP Invoice No.", "Investment Profile",
                    "Account Group (Orka Level 1)", "Account Sub Group (Orka Level 2)", "Account (Orka Level 3)",
                    "Quantity", "Personnel Number", "PO Final Invoice indicator", "Value Type", "Miro Invoice #", "Goods Received Value"
                ],
                "example": {
                    "FI Doc No": "FI-2024-001234",
                    "Posting Date": "2024-01-15",
                    "Document Date": "2024-01-14",
                    "Document Type": "Invoice",
                    "Document Type Desc": "Vendor Invoice",
                    "Vendor": "ACME Corp",
                    "Vendor Description": "ACME Corporation Ltd",
                    "Vendor Invoice No": "INV-ACME-001",
                    "Project Nr": "PRJ-2024-001",
                    "Project Description": "Project Alpha",
                    "WBS Element": "WBS-001",
                    "WBS Description": "Work package 1",
                    "G/L Account": "400000",
                    "G/L Account Desc": "Cost of materials",
                    "Cost Center": "CC-1000",
                    "Cost Center Desc": "IT",
                    "Item Text": "Consulting services for Q1",
                    "Amount": "12345.67",
                    "Legal Entity Currency Code": "EUR",
                    "Value in document currency": "12345.67",
                    "Document currency code": "EUR",
                    "PO No": "PO-2024-001234",
                    "PO Line No": "1",
                    "Product Desc": "",
                    "Document Header Text": "",
                    "Payment Terms": "30 days",
                    "Net Due Date": "2024-02-14",
                    "Creation date": "2024-01-10",
                    "SAP Invoice No.": "",
                    "Investment Profile": "Capex",
                    "Account Group (Orka Level 1)": "Materials",
                    "Account Sub Group (Orka Level 2)": "Services",
                    "Account (Orka Level 3)": "Consulting",
                    "Quantity": "1",
                    "Personnel Number": "",
                    "PO Final Invoice indicator": "",
                    "Value Type": "",
                    "Miro Invoice #": "",
                    "Goods Received Value": ""
                },
                "description": "Import financial actuals (actual costs incurred). Aligned with actuals table and ActualCreate model."
            },
            "commitments": {
                "headers": [
                    "PO Number", "PO Date", "Vendor", "Vendor Description", "Requester", "PO Created By", "Shopping Cart Number",
                    "Project", "Project Description", "WBS Element", "WBS Element Description", "Cost Center", "Cost Center Description",
                    "PO Net Amount", "Tax Amount", "Total Amount Legal Entity Currency", "PO Line Nr.", "PO Status", "PO Line Text", "Delivery Date",
                    "Legal Entity Currency Code", "Value in document currency", "Document currency code", "Investment Profile",
                    "Account Group (Orka Level 1)", "Account Sub Group (Orka Level 2)", "Account (Orka Level 3)",
                    "Change Date", "Purchase requisition", "Procurement Plant", "Contract #", "Joint Commodity Code", "PO Title", "Version", "FI Doc No"
                ],
                "example": {
                    "PO Number": "PO-2024-001234",
                    "PO Date": "2024-01-15",
                    "Vendor": "XYZ Ltd",
                    "Vendor Description": "XYZ Limited",
                    "Requester": "John Doe",
                    "PO Created By": "jane@example.com",
                    "Shopping Cart Number": "SC-12345",
                    "Project": "PRJ-2024-002",
                    "Project Description": "Project Beta",
                    "WBS Element": "WBS-002",
                    "WBS Element Description": "Work package 2",
                    "Cost Center": "CC-2000",
                    "Cost Center Description": "Construction",
                    "PO Net Amount": "10000.00",
                    "Tax Amount": "1900.00",
                    "Total Amount Legal Entity Currency": "11900.00",
                    "PO Line Nr.": "1",
                    "PO Status": "Open",
                    "PO Line Text": "Equipment and services",
                    "Delivery Date": "2024-02-15",
                    "Legal Entity Currency Code": "EUR",
                    "Value in document currency": "10000.00",
                    "Document currency code": "EUR",
                    "Investment Profile": "Capex",
                    "Account Group (Orka Level 1)": "Equipment",
                    "Account Sub Group (Orka Level 2)": "Machinery",
                    "Account (Orka Level 3)": "Heavy equipment",
                    "Change Date": "2024-01-14",
                    "Purchase requisition": "PR-001",
                    "Procurement Plant": "1000",
                    "Contract #": "CON-2024-01",
                    "Joint Commodity Code": "JCC-123",
                    "PO Title": "Q1 equipment order",
                    "Version": "1",
                    "FI Doc No": ""
                },
                "description": "Import financial commitments (purchase orders). Aligned with commitments table and CommitmentCreate model."
            }
        }
        
        if import_type not in templates:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid import_type. Must be 'actuals' or 'commitments'"
            )
        
        template = templates[import_type]
        
        # Generate CSV content
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=template["headers"], delimiter=';')
        writer.writeheader()
        writer.writerow(template["example"])
        
        csv_content = output.getvalue()
        
        return {
            "headers": template["headers"],
            "example": template["example"],
            "description": template["description"],
            "csv_content": csv_content
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get CSV template error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get CSV template: {str(e)}"
        )


@router.get("/history")
async def get_import_history(
    import_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user = Depends(get_current_user)
):
    """
    Get import history for the current user.
    
    Returns a list of past import operations with statistics.
    Uses service role when available so RLS does not hide rows written by import.
    """
    try:
        db = service_supabase if service_supabase else supabase
        if db is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        user_id = current_user.get("user_id") or current_user.get("id")
        query = db.table("import_audit_logs").select("*").eq("user_id", user_id)
        
        if import_type:
            query = query.eq("import_type", import_type)
        
        response = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        # Transform data to match frontend expectations
        imports = []
        for record in (response.data or []):
            imports.append({
                "id": record.get("id"),
                "import_id": record.get("import_id"),
                "import_type": record.get("import_type"),
                "file_name": f"{record.get('import_type')}_import.csv",  # Placeholder
                "import_status": record.get("status"),
                "records_processed": record.get("total_records", 0),
                "records_imported": record.get("success_count", 0),
                "records_failed": record.get("error_count", 0),
                "started_at": record.get("created_at"),
                "completed_at": record.get("completed_at"),
                "file_size": 0  # Not tracked currently
            })
        
        return {"imports": imports}
        
    except Exception as e:
        print(f"Get import history error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get import history: {str(e)}"
        )

@router.get("/status/{import_id}")
async def get_import_status(
    import_id: str,
    current_user = Depends(get_current_user)
):
    """Get status of a specific import operation."""
    try:
        db = service_supabase if service_supabase else supabase
        if db is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        user_id = current_user.get("user_id") or current_user.get("id")
        response = db.table("import_audit_logs").select("*").eq(
            "import_id", import_id
        ).eq("user_id", user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Import not found")
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get import status error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get import status: {str(e)}"
        )


@router.get("/variances")
async def get_financial_variances(
    organization_id: str = "DEFAULT",
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    current_user = Depends(get_current_user)
):
    """Get financial variances calculated from commitments vs actuals (DB tables: commitments, actuals)."""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")

        # Get commitments grouped by project_nr and wbs_element
        try:
            commitments_response = supabase.table("commitments").select(
                "project_nr, wbs_element, project_description, total_amount"
            ).execute()
            commitments = commitments_response.data or []
        except Exception as db_error:
            print(f"Database query error: {db_error}")
            return {
                "variances": [],
                "summary": {"total_variances": 0, "over_budget": 0, "under_budget": 0, "on_budget": 0},
                "filters": {"organization_id": organization_id, "project_id": project_id, "status": status, "limit": limit},
            }

        # Actuals: use amount (Invoice Amount Legal Entity), else value_in_document_currency, else invoice_amount
        try:
            actuals_response = supabase.table("actuals").select(
                "project_nr, wbs, wbs_element, amount, invoice_amount, value_in_document_currency"
            ).execute()
            actuals = actuals_response.data or []
        except Exception as db_error:
            print(f"Database query error: {db_error}")
            actuals = []

        def _actual_wbs(row):
            return row.get("wbs") or row.get("wbs_element") or ""

        def _actual_amount(row):
            v = row.get("amount") or row.get("invoice_amount") or row.get("value_in_document_currency")
            return float(v) if v is not None else 0.0

        # Group commitments by (project_nr, wbs_element)
        commitment_groups = {}
        for commitment in commitments:
            key = (commitment.get("project_nr") or "", commitment.get("wbs_element") or "")
            if key not in commitment_groups:
                commitment_groups[key] = {
                    "project_nr": commitment.get("project_nr"),
                    "wbs_element": commitment.get("wbs_element"),
                    "project_description": commitment.get("project_description"),
                    "total_commitment": 0,
                }
            try:
                commitment_groups[key]["total_commitment"] += float(commitment.get("total_amount", 0))
            except (ValueError, TypeError):
                pass

        # Group actuals by (project_nr, wbs) – wbs matches commitments wbs_element
        actual_groups = {}
        for actual in actuals:
            key = (actual.get("project_nr") or "", _actual_wbs(actual))
            if key not in actual_groups:
                actual_groups[key] = 0
            try:
                actual_groups[key] += _actual_amount(actual)
            except (ValueError, TypeError):
                pass

        # Calculate variances
        variances = []
        for key, commitment_data in commitment_groups.items():
            project_nr = commitment_data['project_nr']
            wbs_element = commitment_data['wbs_element']
            project_description = commitment_data['project_description'] or project_nr
            total_commitment = commitment_data['total_commitment']
            total_actual = actual_groups.get(key, 0)
            
            # Skip if no commitment amount
            if total_commitment <= 0:
                continue
            
            # Calculate variance
            variance = total_actual - total_commitment
            variance_percentage = (variance / total_commitment * 100) if total_commitment > 0 else 0
            
            # Determine status based on variance
            if total_actual < total_commitment * 0.95:
                status_val = 'under'
            elif total_actual <= total_commitment * 1.05:
                status_val = 'on'
            else:
                status_val = 'over'
            
            variance_record = {
                'id': f"{project_nr}_{wbs_element}",
                'project_id': project_nr,  # Human-readable project number
                'project_name': project_description,
                'wbs_element': wbs_element or 'N/A',  # Code format
                'total_commitment': total_commitment,
                'total_actual': total_actual,
                'variance': variance,
                'variance_percentage': variance_percentage,
                'status': status_val,
                'organization_id': organization_id,
                'calculated_at': datetime.now().isoformat()
            }
            
            variances.append(variance_record)
        
        # Apply filters
        if project_id:
            variances = [v for v in variances if project_id.lower() in v["project_id"].lower() or project_id.lower() in v["project_name"].lower()]
        
        if status:
            variances = [v for v in variances if v['status'] == status]
        
        # Sort by variance percentage (highest first)
        variances.sort(key=lambda x: abs(x['variance_percentage']), reverse=True)
        
        # Apply limit
        variances = variances[:limit]
        
        # Calculate summary statistics
        total_variances = len(variances)
        over_budget = len([v for v in variances if v.get('status') == 'over'])
        under_budget = len([v for v in variances if v.get('status') == 'under'])
        on_budget = len([v for v in variances if v.get('status') == 'on'])
        
        return {
            "variances": variances,
            "summary": {
                "total_variances": total_variances,
                "over_budget": over_budget,
                "under_budget": under_budget,
                "on_budget": on_budget
            },
            "filters": {
                "organization_id": organization_id,
                "project_id": project_id,
                "status": status,
                "limit": limit
            }
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"Get variances error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to get variances: {str(e)}")


COMMITMENTS_CACHE_TTL = 60  # seconds; short TTL since data changes on import


def _commitments_cache_key(org_id: str, offset: int, limit: int, project_nr: Optional[str], count_exact: bool) -> str:
    """Build cache key for commitments list (idempotent for same inputs)."""
    pn = project_nr or ""
    return f"commitments:list:{org_id}:{offset}:{limit}:{pn}:{count_exact}"


@router.get("/commitments")
async def get_commitments(
    request: Request,
    limit: int = Query(100, ge=1, le=10000),
    offset: int = Query(0, ge=0),
    project_nr: Optional[str] = None,
    count_exact: bool = Query(False, description="Request exact total count (expensive on large tables); use only when needed for pagination"),
    current_user = Depends(get_current_user)
):
    """
    Get imported commitments data with pagination. Response cached (TTL 60s).
    Default count_exact=false to avoid slow COUNT; pass count_exact=true only for first page when you need exact total.
    """
    try:
        org_id = (current_user.get("organization_id") or current_user.get("tenant_id") or "default")
        if isinstance(org_id, UUID):
            org_id = str(org_id)
        cache = getattr(request.app.state, "cache_manager", None)
        cache_key = _commitments_cache_key(org_id, offset, limit, project_nr, count_exact)
        if cache:
            data = await cache.get(cache_key)
            if data is not None:
                return data
        db_client = service_supabase if service_supabase else supabase
        if db_client is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        if count_exact:
            query = db_client.table("commitments").select("*", count="exact")
        else:
            query = db_client.table("commitments").select("*")
        if project_nr:
            query = query.eq("project_nr", project_nr)
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        response = query.execute()
        data_list = response.data or []
        if count_exact and hasattr(response, "count") and response.count is not None:
            total = response.count
        else:
            total = offset + len(data_list)
        has_more = len(data_list) == limit
        result = {
            "commitments": data_list,
            "total": total,
            "limit": limit,
            "offset": offset,
            "count_exact": count_exact,
            "has_more": has_more,
        }
        if cache:
            await cache.set(cache_key, result, ttl=COMMITMENTS_CACHE_TTL)
        return result
    except Exception as e:
        print(f"Get commitments error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get commitments: {str(e)}"
        )


ACTUALS_CACHE_TTL = 60  # seconds


def _actuals_cache_key(org_id: str, offset: int, limit: int, project_nr: Optional[str], count_exact: bool) -> str:
    """Build cache key for actuals list (idempotent for same inputs)."""
    pn = project_nr or ""
    return f"actuals:list:{org_id}:{offset}:{limit}:{pn}:{count_exact}"


@router.get("/actuals")
async def get_actuals(
    request: Request,
    limit: int = Query(100, ge=1, le=10000),
    offset: int = Query(0, ge=0),
    project_nr: Optional[str] = None,
    count_exact: bool = Query(False, description="Request exact total count (expensive on large tables); use only when needed for pagination"),
    current_user = Depends(get_current_user)
):
    """
    Get imported actuals data with pagination. Response cached (TTL 60s).
    Default count_exact=false to avoid slow COUNT; pass count_exact=true only for first page when you need exact total.
    """
    try:
        org_id = (current_user.get("organization_id") or current_user.get("tenant_id") or "default")
        if isinstance(org_id, UUID):
            org_id = str(org_id)
        cache = getattr(request.app.state, "cache_manager", None)
        cache_key = _actuals_cache_key(org_id, offset, limit, project_nr, count_exact)
        if cache:
            data = await cache.get(cache_key)
            if data is not None:
                return data
        db_client = service_supabase if service_supabase else supabase
        if db_client is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        if count_exact:
            query = db_client.table("actuals").select("*", count="exact")
        else:
            query = db_client.table("actuals").select("*")
        if project_nr:
            query = query.eq("project_nr", project_nr)
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        response = query.execute()
        data_list = response.data or []
        if count_exact and hasattr(response, "count") and response.count is not None:
            total = response.count
        else:
            total = offset + len(data_list)
        has_more = len(data_list) == limit
        result = {
            "actuals": data_list,
            "total": total,
            "limit": limit,
            "offset": offset,
            "count_exact": count_exact,
            "has_more": has_more,
        }
        if cache:
            await cache.set(cache_key, result, ttl=ACTUALS_CACHE_TTL)
        return result
    except Exception as e:
        print(f"Get actuals error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get actuals: {str(e)}"
        )


# Keep the variances endpoint as it's used by the dashboard (LEGACY - kept for compatibility)
@router.get("/variances-legacy")
async def get_financial_variances(
    organization_id: str = "DEFAULT",
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    current_user = Depends(get_current_user)
):
    """Get financial variances calculated from commitments vs actuals"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Get commitments grouped by project_nr and wbs_element
        try:
            commitments_response = supabase.table("commitments").select(
                "project_nr, wbs_element, project_description, total_amount"
            ).execute()
            commitments = commitments_response.data or []
        except Exception as db_error:
            print(f"Database query error: {db_error}")
            # Return empty result instead of failing
            return {
                "variances": [],
                "summary": {
                    "total_variances": 0,
                    "over_budget": 0,
                    "under_budget": 0,
                    "on_budget": 0
                },
                "filters": {
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "status": status,
                    "limit": limit
                }
            }
        
        # Get actuals: amount = Invoice Amount Legal Entity currency, fallback value_in_document_currency / invoice_amount
        try:
            actuals_response = supabase.table("actuals").select(
                "project_nr, wbs_element, wbs, amount, invoice_amount, value_in_document_currency"
            ).execute()
            actuals = actuals_response.data or []
        except Exception as db_error:
            print(f"Database query error: {db_error}")
            actuals = []
        
        # Group commitments by (project_nr, wbs_element)
        commitment_groups = {}
        for commitment in commitments:
            key = (commitment.get('project_nr'), commitment.get('wbs_element'))
            if key not in commitment_groups:
                commitment_groups[key] = {
                    'project_nr': commitment.get('project_nr'),
                    'wbs_element': commitment.get('wbs_element'),
                    'project_description': commitment.get('project_description'),
                    'total_commitment': 0
                }
            try:
                amount = float(commitment.get('total_amount', 0))
                commitment_groups[key]['total_commitment'] += amount
            except (ValueError, TypeError):
                pass
        
        def _actual_amount_val(row):
            v = row.get("amount") or row.get("invoice_amount") or row.get("value_in_document_currency")
            return float(v) if v is not None else 0.0

        # Group actuals by (project_nr, wbs_element or wbs)
        actual_groups = {}
        for actual in actuals:
            wbs = actual.get("wbs_element") or actual.get("wbs") or ""
            key = (actual.get("project_nr"), wbs)
            if key not in actual_groups:
                actual_groups[key] = 0
            try:
                actual_groups[key] += _actual_amount_val(actual)
            except (ValueError, TypeError):
                pass
        
        # Calculate variances
        variances = []
        for key, commitment_data in commitment_groups.items():
            project_nr = commitment_data['project_nr']
            wbs_element = commitment_data['wbs_element']
            project_description = commitment_data['project_description'] or project_nr
            total_commitment = commitment_data['total_commitment']
            total_actual = actual_groups.get(key, 0)
            
            # Skip if no commitment amount
            if total_commitment <= 0:
                continue
            
            # Calculate variance
            variance = total_actual - total_commitment
            variance_percentage = (variance / total_commitment * 100) if total_commitment > 0 else 0
            
            # Determine status based on variance
            if total_actual < total_commitment * 0.95:
                status_val = 'under'
            elif total_actual <= total_commitment * 1.05:
                status_val = 'on'
            else:
                status_val = 'over'
            
            variance_record = {
                'id': f"{project_nr}_{wbs_element}",
                'project_id': project_nr,  # Human-readable project number
                'project_name': project_description,
                'wbs_element': wbs_element or 'N/A',  # Code format
                'total_commitment': total_commitment,
                'total_actual': total_actual,
                'variance': variance,
                'variance_percentage': variance_percentage,
                'status': status_val,
                'organization_id': organization_id,
                'calculated_at': datetime.now().isoformat()
            }
            
            variances.append(variance_record)
        
        # Apply filters
        if project_id:
            variances = [v for v in variances if project_id.lower() in v["project_id"].lower() or project_id.lower() in v["project_name"].lower()]
        
        if status:
            variances = [v for v in variances if v['status'] == status]
        
        # Sort by variance percentage (highest first)
        variances.sort(key=lambda x: abs(x['variance_percentage']), reverse=True)
        
        # Apply limit
        variances = variances[:limit]
        
        # Calculate summary statistics
        total_variances = len(variances)
        over_budget = len([v for v in variances if v.get('status') == 'over'])
        under_budget = len([v for v in variances if v.get('status') == 'under'])
        on_budget = len([v for v in variances if v.get('status') == 'on'])
        
        return {
            "variances": variances,
            "summary": {
                "total_variances": total_variances,
                "over_budget": over_budget,
                "under_budget": under_budget,
                "on_budget": on_budget
            },
            "filters": {
                "organization_id": organization_id,
                "project_id": project_id,
                "status": status,
                "limit": limit
            }
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"Get variances error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to get variances: {str(e)}")
