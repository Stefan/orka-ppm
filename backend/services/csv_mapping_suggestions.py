"""
CSV → PPM mapping suggestions (Cora-Surpass Phase 2.2).
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
            "PO Date": "po_date", "Vendor": "vendor", "vendor": "vendor",
            "Project": "project_nr", "Project Nr": "project_nr", "project_nr": "project_nr",
            "WBS Element": "wbs_element", "wbs_element": "wbs_element",
            "Total Amount": "total_amount", "total_amount": "total_amount",
            "Currency": "currency", "currency": "currency",
            "PO Status": "po_status", "PO Line Nr": "po_line_nr",
            "Vendor Description": "vendor_description", "Delivery Date": "delivery_date",
            "Cost Center": "cost_center", "PO Net Amount": "po_net_amount",
        }
    else:
        column_mapping = {
            "FI Doc No": "fi_doc_no", "Posting Date": "posting_date", "Document Date": "document_date",
            "Vendor": "vendor", "Project": "project_nr", "WBS": "wbs_element",
            "Amount": "amount", "amount": "amount", "Currency": "currency",
            "Item Text": "item_text", "Cost Center": "cost_center",
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
