"""
CSV import functionality endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File, Query, Request
from uuid import UUID
from typing import Optional, Dict, Any, List
import csv
import io
import json
from datetime import datetime

from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission
from config.database import supabase, service_supabase
from utils.converters import convert_uuids
from services.actuals_commitments_import import ActualsCommitmentsImportService
from services.enterprise_audit_service import EnterpriseAuditService

router = APIRouter(prefix="/csv-import", tags=["csv-import"])


def map_csv_columns(rows: List[Dict[str, Any]], import_type: str) -> List[Dict[str, Any]]:
    """
    Map CSV column names to expected field names.
    
    Handles various column name formats (with spaces, different casing, etc.)
    and maps them to the standardized field names expected by the Pydantic models.
    """
    if import_type == "commitments":
        # Mapping for commitments CSV columns
        column_mapping = {
            'PO Number': 'po_number',
            'PO_Number': 'po_number',
            'po_number': 'po_number',
            'PO Date': 'po_date',
            'PO_Date': 'po_date',
            'po_date': 'po_date',
            'Vendor': 'vendor',
            'vendor': 'vendor',
            'Vendor Description': 'vendor_description',
            'Vendor_Description': 'vendor_description',
            'vendor_description': 'vendor_description',
            'Requester': 'requester',
            'requester': 'requester',
            'PO Created By': 'po_created_by',
            'PO_Created_By': 'po_created_by',
            'po_created_by': 'po_created_by',
            'Shopping Cart Number': 'shopping_cart_number',
            'Shopping_Cart_Number': 'shopping_cart_number',
            'shopping_cart_number': 'shopping_cart_number',
            'Project': 'project_nr',
            'Project Nr': 'project_nr',
            'Project_Nr': 'project_nr',
            'project_nr': 'project_nr',
            'Project Description': 'project_description',
            'Project_Description': 'project_description',
            'project_description': 'project_description',
            'WBS Element': 'wbs_element',
            'WBS_Element': 'wbs_element',
            'wbs_element': 'wbs_element',
            'WBS Element Description': 'wbs_description',
            'WBS_Element_Description': 'wbs_description',
            'wbs_description': 'wbs_description',
            'Cost Center': 'cost_center',
            'Cost_Center': 'cost_center',
            'cost_center': 'cost_center',
            'Cost Center Description': 'cost_center_description',
            'Cost_Center_Description': 'cost_center_description',
            'cost_center_description': 'cost_center_description',
            'PO Net Amount': 'po_net_amount',
            'PO_Net_Amount': 'po_net_amount',
            'po_net_amount': 'po_net_amount',
            'Tax Amount': 'tax_amount',
            'Tax_Amount': 'tax_amount',
            'tax_amount': 'tax_amount',
            'Total Amount Legal Entity Currency': 'total_amount',
            'Total Amount': 'total_amount',
            'Total_Amount': 'total_amount',
            'total_amount': 'total_amount',
            'Legal Entity Currency Code': 'currency',
            'Currency': 'currency',
            'currency': 'currency',
            'PO Status': 'po_status',
            'PO_Status': 'po_status',
            'po_status': 'po_status',
            'PO Line Nr.': 'po_line_nr',
            'PO Line Nr': 'po_line_nr',
            'PO_Line_Nr': 'po_line_nr',
            'po_line_nr': 'po_line_nr',
            'PO Line Text': 'po_line_text',
            'PO_Line_Text': 'po_line_text',
            'po_line_text': 'po_line_text',
            'Delivery Date': 'delivery_date',
            'Delivery_Date': 'delivery_date',
            'delivery_date': 'delivery_date',
            'Value in document currency': 'value_in_document_currency',
            'Value_in_document_currency': 'value_in_document_currency',
            'value_in_document_currency': 'value_in_document_currency',
            'Document currency code': 'document_currency_code',
            'Document_currency_code': 'document_currency_code',
            'document_currency_code': 'document_currency_code',
            'Investment Profile': 'investment_profile',
            'Investment_Profile': 'investment_profile',
            'investment_profile': 'investment_profile',
            'Account Group (Cora Level 1)': 'account_group_level1',
            'Account_Group_(Cora_Level_1)': 'account_group_level1',
            'account_group_level1': 'account_group_level1',
            'Account Sub Group (Cora Level 2)': 'account_subgroup_level2',
            'Account_Sub_Group_(Cora_Level_2)': 'account_subgroup_level2',
            'account_subgroup_level2': 'account_subgroup_level2',
            'Account (Cora Level 3)': 'account_level3',
            'Account_(Cora_Level_3)': 'account_level3',
            'account_level3': 'account_level3',
            'Change Date': 'change_date',
            'Change_Date': 'change_date',
            'change_date': 'change_date',
            'Purchase requisition': 'purchase_requisition',
            'Purchase_requisition': 'purchase_requisition',
            'purchase_requisition': 'purchase_requisition',
            'Procurement Plant': 'procurement_plant',
            'Procurement_Plant': 'procurement_plant',
            'procurement_plant': 'procurement_plant',
            'Contract #': 'contract_number',
            'Contract_#': 'contract_number',
            'contract_number': 'contract_number',
            'Joint Commodity Code': 'joint_commodity_code',
            'Joint_Commodity_Code': 'joint_commodity_code',
            'joint_commodity_code': 'joint_commodity_code',
            'PO Title': 'po_title',
            'PO_Title': 'po_title',
            'po_title': 'po_title',
            'Version': 'version',
            'version': 'version',
            'FI Doc No': 'fi_doc_no',
            'FI_Doc_No': 'fi_doc_no',
            'fi_doc_no': 'fi_doc_no',
        }
    else:  # actuals
        # Mapping for actuals CSV columns
        column_mapping = {
            'FI Doc No': 'fi_doc_no',
            'FI_Doc_No': 'fi_doc_no',
            'fi_doc_no': 'fi_doc_no',
            'FI Doc Date': 'document_date',
            'FI_Doc_Date': 'document_date',
            'Posting Date': 'posting_date',
            'Posting_Date': 'posting_date',
            'posting_date': 'posting_date',
            'Document Date': 'document_date',
            'Document_Date': 'document_date',
            'document_date': 'document_date',
            'Document Type': 'document_type',
            'Document_Type': 'document_type',
            'document_type': 'document_type',
            'Document Type Desc': 'document_type_desc',
            'Document_Type_Desc': 'document_type_desc',
            'PO No': 'po_no',
            'PO_No': 'po_no',
            'po_no': 'po_no',
            'PO Line No': 'po_line_no',
            'PO_Line_No': 'po_line_no',
            'po_line_no': 'po_line_no',
            'Vendor': 'vendor',
            'vendor': 'vendor',
            'Vendor Description': 'vendor_description',
            'Vendor_Description': 'vendor_description',
            'vendor_description': 'vendor_description',
            'Vendor Invoice No': 'vendor_invoice_no',
            'Vendor_Invoice_No': 'vendor_invoice_no',
            'vendor_invoice_no': 'vendor_invoice_no',
            'Project': 'project_nr',
            'Project Nr': 'project_nr',
            'Project Nr.': 'project_nr',
            'Project_Nr': 'project_nr',
            'project_nr': 'project_nr',
            'Project Description': 'project_description',
            'Project_Description': 'project_description',
            'project_description': 'project_description',
            'WBS': 'wbs_element',
            'WBS Element': 'wbs_element',
            'WBS_Element': 'wbs_element',
            'wbs_element': 'wbs_element',
            'wbs': 'wbs_element',
            'WBS Description': 'wbs_description',
            'WBS_Description': 'wbs_description',
            'wbs_description': 'wbs_description',
            'G/L Account': 'gl_account',
            'GL_Account': 'gl_account',
            'gl_account': 'gl_account',
            'G/L Account Desc': 'gl_account_desc',
            'GL_Account_Desc': 'gl_account_desc',
            'gl_account_desc': 'gl_account_desc',
            'Cost Center': 'cost_center',
            'Cost_Center': 'cost_center',
            'cost_center': 'cost_center',
            'Cost Center Desc': 'cost_center_desc',
            'Cost_Center_Desc': 'cost_center_desc',
            'cost_center_desc': 'cost_center_desc',
            'Product Desc': 'product_desc',
            'Product_Desc': 'product_desc',
            'product_desc': 'product_desc',
            'Item Text': 'item_text',
            'Item_Text': 'item_text',
            'item_text': 'item_text',
            'Document Header Text': 'document_header_text',
            'Document_Header_Text': 'document_header_text',
            'document_header_text': 'document_header_text',
            'Payment Terms': 'payment_terms',
            'Payment_Terms': 'payment_terms',
            'payment_terms': 'payment_terms',
            'Net Due Date': 'net_due_date',
            'Net_Due_Date': 'net_due_date',
            'net_due_date': 'net_due_date',
            'Amount': 'amount',
            'amount': 'amount',
            'Invoice Amount Legal Entity currency': 'amount',
            'Invoice Amount': 'amount',
            'invoice_amount': 'amount',
            'Creation date': 'creation_date',
            'Creation_date': 'creation_date',
            'creation_date': 'creation_date',
            'SAP Invoice No.': 'sap_invoice_no',
            'SAP_Invoice_No': 'sap_invoice_no',
            'sap_invoice_no': 'sap_invoice_no',
            'Investment Profile': 'investment_profile',
            'Investment_Profile': 'investment_profile',
            'investment_profile': 'investment_profile',
            'Account Group (Cora Level 1)': 'account_group_level1',
            'Account_Group_(Cora_Level_1)': 'account_group_level1',
            'account_group_level1': 'account_group_level1',
            'Account Sub Group (Cora Level 2)': 'account_subgroup_level2',
            'Account_Sub_Group_(Cora_Level_2)': 'account_subgroup_level2',
            'account_subgroup_level2': 'account_subgroup_level2',
            'Account (Cora Level 3)': 'account_level3',
            'Account_(Cora_Level_3)': 'account_level3',
            'account_level3': 'account_level3',
            'Legal Entity Currency Code': 'currency',
            'Currency': 'currency',
            'currency': 'currency',
            'Value in document currency': 'value_in_document_currency',
            'Value_in_document_currency': 'value_in_document_currency',
            'value_in_document_currency': 'value_in_document_currency',
            'Document currency Code': 'document_currency_code',
            'Document_currency_Code': 'document_currency_code',
            'document_currency_code': 'document_currency_code',
            'Quantity': 'quantity',
            'quantity': 'quantity',
            'Personnel Number': 'personnel_number',
            'Personnel_Number': 'personnel_number',
            'personnel_number': 'personnel_number',
            'PO Final Invoice indicator': 'po_final_invoice_indicator',
            'PO_Final_Invoice_indicator': 'po_final_invoice_indicator',
            'po_final_invoice_indicator': 'po_final_invoice_indicator',
            'Value Type': 'value_type',
            'Value_Type': 'value_type',
            'value_type': 'value_type',
            'Miro Invoice #': 'miro_invoice_no',
            'Miro_Invoice_#': 'miro_invoice_no',
            'miro_invoice_no': 'miro_invoice_no',
            'Goods Received Value': 'goods_received_value',
            'Goods_Received_Value': 'goods_received_value',
            'goods_received_value': 'goods_received_value',
        }
    
    # Map each row
    mapped_rows = []
    for row in rows:
        mapped_row = {}
        for csv_col, value in row.items():
            # Find the mapped column name
            mapped_col = column_mapping.get(csv_col, csv_col.lower().replace(' ', '_'))
            mapped_row[mapped_col] = value
        mapped_rows.append(mapped_row)
    
    return mapped_rows

@router.post("/upload")
async def upload_csv_file(
    request: Request,
    file: UploadFile = File(...),
    import_type: str = Query(...),  # "actuals" or "commitments"
    current_user = Depends(require_permission(Permission.data_import)),
):
    """
    Upload and process CSV file for actuals or commitments import.
    
    This endpoint handles CSV imports for financial data (actuals and commitments).
    The data is validated, anonymized, and linked to projects automatically.
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
        
        import_service = ActualsCommitmentsImportService(db_client, user_id)
        
        # Process import based on type
        if import_type == "actuals":
            result = await import_service.import_actuals(rows, anonymize=True)
        else:  # commitments
            result = await import_service.import_commitments(rows, anonymize=True)

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

        # Return result in format expected by frontend
        return {
            "success": result.success,
            "records_processed": result.total_records,
            "records_imported": result.success_count,
            "errors": [
                {
                    "row": err.row,
                    "field": err.field,
                    "message": err.error
                }
                for err in result.errors
            ],
            "warnings": [],  # Can be extended if needed
            "import_id": result.import_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
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
        templates = {
            "actuals": {
                "headers": [
                    "fi_doc_no", "posting_date", "document_date", "vendor",
                    "vendor_description", "project_nr", "wbs_element", "amount",
                    "currency", "item_text", "document_type"
                ],
                "example": {
                    "fi_doc_no": "FI-2024-001234",
                    "posting_date": "2024-01-15",
                    "document_date": "2024-01-14",
                    "vendor": "ACME Corp",
                    "vendor_description": "ACME Corporation Ltd",
                    "project_nr": "PRJ-2024-001",
                    "wbs_element": "WBS-001",
                    "amount": "12345.67",
                    "currency": "EUR",
                    "item_text": "Consulting services for Q1",
                    "document_type": "Invoice"
                },
                "description": "Import financial actuals (actual costs incurred)"
            },
            "commitments": {
                "headers": [
                    "po_number", "po_date", "vendor", "vendor_description",
                    "project_nr", "wbs_element", "po_net_amount", "total_amount",
                    "currency", "po_status", "po_line_nr", "delivery_date"
                ],
                "example": {
                    "po_number": "PO-2024-001234",
                    "po_date": "2024-01-15",
                    "vendor": "XYZ Ltd",
                    "vendor_description": "XYZ Limited",
                    "project_nr": "PRJ-2024-002",
                    "wbs_element": "WBS-002",
                    "po_net_amount": "10000.00",
                    "total_amount": "11900.00",
                    "currency": "EUR",
                    "po_status": "Open",
                    "po_line_nr": "1",
                    "delivery_date": "2024-02-15"
                },
                "description": "Import financial commitments (purchase orders)"
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
    """
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        user_id = current_user.get("user_id") or current_user.get("id")
        query = supabase.table("import_audit_logs").select("*").eq("user_id", user_id)
        
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
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        user_id = current_user.get("user_id") or current_user.get("id")
        response = supabase.table("import_audit_logs").select("*").eq(
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

        # Actuals table: project_nr, wbs, invoice_amount (not wbs_element/amount)
        try:
            actuals_response = supabase.table("actuals").select(
                "project_nr, wbs, invoice_amount"
            ).execute()
            actuals = actuals_response.data or []
        except Exception as db_error:
            print(f"Database query error: {db_error}")
            actuals = []

        def _actual_wbs(row):
            return row.get("wbs") or row.get("wbs_element") or ""

        def _actual_amount(row):
            return float(row.get("invoice_amount") or row.get("amount") or 0)

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


@router.get("/commitments")
async def get_commitments(
    limit: int = 100,
    offset: int = 0,
    project_nr: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Get imported commitments data.
    
    Returns a list of commitment records with all imported fields.
    """
    try:
        # Use service role client to bypass RLS
        db_client = service_supabase if service_supabase else supabase
        if db_client is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Build query
        query = db_client.table("commitments").select("*")
        
        # Apply filters
        if project_nr:
            query = query.eq("project_nr", project_nr)
        
        # Apply pagination
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        
        response = query.execute()
        
        # Get total count
        count_response = db_client.table("commitments").select("id", count="exact").execute()
        total = count_response.count if hasattr(count_response, 'count') else len(response.data or [])
        
        return {
            "commitments": response.data or [],
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        print(f"Get commitments error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get commitments: {str(e)}"
        )


@router.get("/actuals")
async def get_actuals(
    limit: int = 100,
    offset: int = 0,
    project_nr: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Get imported actuals data.
    
    Returns a list of actual records with all imported fields.
    """
    try:
        # Use service role client to bypass RLS
        db_client = service_supabase if service_supabase else supabase
        if db_client is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Build query
        query = db_client.table("actuals").select("*")
        
        # Apply filters
        if project_nr:
            query = query.eq("project_nr", project_nr)
        
        # Apply pagination
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        
        response = query.execute()
        
        # Get total count
        count_response = db_client.table("actuals").select("id", count="exact").execute()
        total = count_response.count if hasattr(count_response, 'count') else len(response.data or [])
        
        return {
            "actuals": response.data or [],
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
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
        
        # Get actuals grouped by project_nr and wbs
        try:
            actuals_response = supabase.table("actuals").select(
                "project_nr, wbs_element, amount"
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
        
        # Group actuals by (project_nr, wbs_element)
        actual_groups = {}
        for actual in actuals:
            key = (actual.get('project_nr'), actual.get('wbs_element'))
            if key not in actual_groups:
                actual_groups[key] = 0
            try:
                amount = float(actual.get('amount', 0))
                actual_groups[key] += amount
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
