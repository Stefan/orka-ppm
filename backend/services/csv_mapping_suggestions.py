"""
CSV → PPM mapping suggestions (Orka-Surpass Phase 2.2).
Heuristic-based: suggest target PPM field for each CSV header.
Optional later: OpenAI Embeddings for semantic match.
"""

import re
from typing import Any, Dict, List

# Known PPM target fields per import type (subset; full mapping lives in csv_import.map_csv_columns)
COMMITMENTS_TARGETS = {
    "po_number", "po_date", "vendor", "vendor_description", "requester", "project_nr",
    "project_description", "wbs_element", "wbs_description", "cost_center", "po_net_amount",
    "tax_amount", "total_amount", "currency", "po_status", "po_line_nr", "po_line_text",
    "delivery_date", "account_group_level1", "account_subgroup_level2", "account_level3",
}
ACTUALS_TARGETS = {
    "fi_doc_no", "posting_date", "document_date", "document_type", "po_no", "vendor",
    "vendor_description", "vendor_invoice_no", "project_nr", "wbs_element", "gl_account",
    "cost_center", "amount", "currency", "item_text", "quantity", "net_due_date",
}

# Normalized header -> target (heuristic: lowercase, spaces/special to underscore)
def _normalize(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", "_", s).strip("_")
    return s

def _build_normalized_to_target(import_type: str) -> Dict[str, str]:
    if import_type == "commitments":
        column_mapping = {
            "PO Number": "po_number", "PO_Number": "po_number", "po_number": "po_number",
            "PO Date": "po_date", "Vendor": "vendor", "Vendor Description": "vendor_description", "vendor": "vendor",
            "Requester": "requester", "PO Created By": "po_created_by", "Shopping Cart Number": "shopping_cart_number",
            "Project": "project_nr", "Project Nr": "project_nr", "project_nr": "project_nr", "Project Description": "project_description",
            "WBS Element": "wbs_element", "WBS Element Description": "wbs_description", "wbs_element": "wbs_element",
            "Cost Center": "cost_center", "Cost Center Description": "cost_center_description",
            "PO Net Amount": "po_net_amount", "Tax Amount": "tax_amount",
            "Total Amount Legal Entity Currency": "total_amount", "Total Amount": "total_amount", "total_amount": "total_amount",
            "PO Line Nr.": "po_line_nr", "PO Line Nr": "po_line_nr", "PO Status": "po_status", "PO Line Text": "po_line_text",
            "Delivery Date": "delivery_date", "Legal Entity Currency Code": "currency", "Currency": "currency", "currency": "currency",
            "Value in document currency": "value_in_document_currency", "Document currency code": "document_currency_code",
            "Investment Profile": "investment_profile",
            "Account Group (Orka Level 1)": "account_group_level1", "Account Sub Group (Orka Level 2)": "account_subgroup_level2", "Account (Orka Level 3)": "account_level3",
            "Change Date": "change_date", "Purchase requisition": "purchase_requisition", "Procurement Plant": "procurement_plant",
            "Contract #": "contract_number", "Joint Commodity Code": "joint_commodity_code", "PO Title": "po_title", "Version": "version",
            "FI Doc No.": "fi_doc_no", "FI Doc No": "fi_doc_no",
        }
    else:
        column_mapping = {
            "FI Doc No": "fi_doc_no", "FI Doc Date": "document_date",
            "Posting Date": "posting_date", "Document Date": "document_date",
            "Document Type": "document_type", "Document Type Desc": "document_type_desc",
            "PO No": "po_no", "PO Line No": "po_line_no",
            "Vendor": "vendor", "Vendor Description": "vendor_description", "Vendor Invoice No": "vendor_invoice_no",
            "Project Nr.": "project_nr", "Project Nr": "project_nr", "Project": "project_nr", "Project Description": "project_description",
            "WBS": "wbs_element", "WBS Description": "wbs_description",
            "G/L Account": "gl_account", "G/L Account Desc": "gl_account_desc",
            "Cost Center": "cost_center", "Cost Center Desc": "cost_center_desc",
            "Invoice Amount Legal Entity currency": "amount", "Amount": "amount", "amount": "amount",
            "Currency": "currency", "Legal Entity Currency Code": "currency",
            "Value in document currency": "value_in_document_currency", "Document currency Code": "document_currency_code",
            "Item Text": "item_text", "Product Desc": "product_desc", "Document Header Text": "document_header_text",
            "Payment Terms": "payment_terms", "Net Due Date": "net_due_date", "Creation date": "creation_date",
            "SAP Invoice No.": "sap_invoice_no", "Investment Profile": "investment_profile",
            "Account Group (Orka Level 1)": "account_group_level1", "Account Sub Group (Orka Level 2)": "account_subgroup_level2", "Account (Orka Level 3)": "account_level3",
            "Quantity": "quantity", "Personnel Number": "personnel_number",
            "PO Final Invoice indicator": "po_final_invoice_indicator", "Value Type": "value_type",
            "Miro Invoice #": "miro_invoice_no", "Goods Received Value": "goods_received_value",
        }
    out: Dict[str, str] = {}
    for k, v in column_mapping.items():
        n = _normalize(k)
        if n and n not in out:
            out[n] = v
    return out


def suggest_mapping(headers: List[str], import_type: str) -> List[Dict[str, Any]]:
    """
    Suggest PPM target field for each CSV header.
    Returns list of { "source_header": str, "target_field": str, "confidence": float }.
    """
    if import_type not in ("commitments", "actuals"):
        import_type = "commitments"
    norm_to_target = _build_normalized_to_target(import_type)
    targets = COMMITMENTS_TARGETS if import_type == "commitments" else ACTUALS_TARGETS
    result: List[Dict[str, Any]] = []
    for h in headers:
        if not (h and isinstance(h, str)):
            continue
        norm = _normalize(h)
        target = norm_to_target.get(norm)
        if not target and "cora" in norm:
            # Map Cora column names to Orka (e.g. "Account Group (Cora Level 1)" -> account_group_level1)
            target = norm_to_target.get(norm.replace("cora", "orka"))
        if target:
            result.append({"source_header": h, "target_field": target, "confidence": 1.0})
            continue
        if norm in targets:
            result.append({"source_header": h, "target_field": norm, "confidence": 0.95})
            continue
        best = None
        best_score = 0.0
        for t in targets:
            if norm in t or t in norm:
                score = len(t) / max(len(norm), len(t)) if norm else 0
                if score > best_score:
                    best_score = score
                    best = t
        if best:
            result.append({"source_header": h, "target_field": best, "confidence": round(best_score * 0.9, 2)})
        else:
            result.append({"source_header": h, "target_field": norm or "unknown", "confidence": 0.0})
    return result
