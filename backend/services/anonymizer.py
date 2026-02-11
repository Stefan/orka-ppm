"""
Anonymizer Service for Import Actuals, Commitments, and Projects

This service anonymizes sensitive information in financial data imports,
replacing vendor names, project numbers, personnel numbers, and descriptive
text with generic placeholders while maintaining referential integrity.

- Project numbers use deterministic hashing so that the same project_nr
  always maps to the same Pxxxx across project import and commitments/actuals
  import (enables correct linking).
- Amounts are obfuscated by a per-session scale factor so they are not
  traceable but ratios and totals remain meaningful in PPM context.
"""

import hashlib
import random
from datetime import date, timedelta
from typing import Dict, Any, Optional


class AnonymizerService:
    """
    Service for anonymizing sensitive data in actuals and commitments imports.
    
    Maintains consistent mapping within an import session:
    - Same vendor always maps to same anonymized vendor
    - Same project number always maps to same anonymized project number
    - Same personnel number always maps to same anonymized personnel number
    
    Preserves non-sensitive fields:
    - Dates (posting_date, document_date, po_date, delivery_date)
    - Amounts (amount, po_net_amount, total_amount)
    - Currency codes
    - Status fields
    - Document types
    """
    
    def __init__(self, amount_factor: Optional[float] = None, date_days_shift: Optional[int] = None):
        """Initialize anonymizer with empty mapping dictionaries and optional obfuscation parameters."""
        self.vendor_map: Dict[str, str] = {}
        self.project_map: Dict[str, str] = {}
        self.personnel_map: Dict[str, str] = {}
        self.vendor_counter = 0
        self.project_counter = 0
        self.personnel_counter = 0
        # Per-session amount obfuscation: scale factor so amounts are not traceable but ratios stay meaningful
        self._amount_factor: float = amount_factor if amount_factor is not None else round(random.uniform(0.82, 1.18), 4)
        # Optional date shift (days) so dates are not traceable
        self._date_days_shift: int = date_days_shift if date_days_shift is not None else random.randint(-200, 200)
        
        # Generic descriptions for anonymization
        self.generic_descriptions = {
            'project': [
                'Infrastructure Development Project',
                'Software Implementation Initiative',
                'Business Process Optimization',
                'Technology Upgrade Program',
                'Quality Improvement Project',
                'Facility Modernization',
                'Digital Transformation Initiative',
                'Operational Excellence Program',
                'Strategic Planning Project',
                'Innovation Development Program'
            ],
            'wbs': [
                'Planning and Design Phase',
                'Implementation Phase',
                'Testing and Validation',
                'Deployment and Rollout',
                'Training and Documentation',
                'Maintenance and Support',
                'Quality Assurance',
                'Project Management',
                'Technical Infrastructure',
                'User Acceptance Testing'
            ],
            'cost_center': [
                'Operations Department',
                'IT Services',
                'Finance and Administration',
                'Human Resources',
                'Facilities Management',
                'Quality Assurance',
                'Research and Development',
                'Customer Service',
                'Supply Chain Management',
                'Business Development'
            ],
            'po_line': [
                'Professional Services',
                'Software Licenses',
                'Hardware Equipment',
                'Consulting Services',
                'Maintenance Contract',
                'Training Services',
                'Technical Support',
                'Cloud Services',
                'Network Equipment',
                'Office Supplies'
            ],
            'po_title': [
                'Annual Service Agreement',
                'Software License Renewal',
                'Equipment Procurement',
                'Consulting Engagement',
                'Maintenance Services',
                'Professional Services Contract',
                'Technology Infrastructure',
                'Support Services Agreement',
                'Implementation Services',
                'Training and Development'
            ]
        }
        self.description_counters = {key: 0 for key in self.generic_descriptions.keys()}
    
    def anonymize_vendor(self, vendor: str) -> str:
        """
        Replace vendor name with generic identifier.
        
        Uses letter-based naming: Vendor A, Vendor B, Vendor C, etc.
        Maintains consistent mapping within import session.
        
        Args:
            vendor: Original vendor name
            
        Returns:
            Anonymized vendor name (e.g., "Vendor A", "Vendor B")
            
        Example:
            >>> anonymizer = AnonymizerService()
            >>> anonymizer.anonymize_vendor("ACME Corp")
            "Vendor A"
            >>> anonymizer.anonymize_vendor("ACME Corp")
            "Vendor A"
            >>> anonymizer.anonymize_vendor("XYZ Ltd")
            "Vendor B"
        """
        if not vendor:
            return vendor
            
        if vendor not in self.vendor_map:
            self.vendor_counter += 1
            # Convert counter to letter (1=A, 2=B, etc.)
            self.vendor_map[vendor] = f"Vendor {chr(64 + self.vendor_counter)}"
        
        return self.vendor_map[vendor]
    
    def _project_nr_deterministic(self, project_nr: str) -> str:
        """
        Map project number to P0001–P9999 deterministically (same input → same output across imports).
        Ensures projects and commitments/actuals link correctly when both are anonymized.
        """
        normalized = (project_nr or "").strip()
        if not normalized:
            return project_nr or ""
        h = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        slot = (int(h[:8], 16) % 9999) + 1
        return f"P{slot:04d}"

    def anonymize_project_nr(self, project_nr: str) -> str:
        """
        Replace project number with fictitious format (deterministic).
        
        Same project_nr always maps to the same Pxxxx so that project import and
        commitments/actuals import stay linked (projects.name and commitment/actual
        project_nr match after anonymization).
        
        Args:
            project_nr: Original project number
            
        Returns:
            Anonymized project number (e.g., "P0042", "P1234")
        """
        if not project_nr:
            return project_nr
        if project_nr not in self.project_map:
            self.project_map[project_nr] = self._project_nr_deterministic(project_nr)
        return self.project_map[project_nr]
    
    def anonymize_personnel(self, personnel_nr: str) -> str:
        """
        Replace personnel number with anonymized identifier.
        
        Uses format EMP001, EMP002, EMP003, etc.
        Maintains consistent mapping within import session.
        
        Args:
            personnel_nr: Original personnel number
            
        Returns:
            Anonymized personnel number (e.g., "EMP001", "EMP002")
            
        Example:
            >>> anonymizer = AnonymizerService()
            >>> anonymizer.anonymize_personnel("12345")
            "EMP001"
            >>> anonymizer.anonymize_personnel("12345")
            "EMP001"
            >>> anonymizer.anonymize_personnel("67890")
            "EMP002"
        """
        if not personnel_nr:
            return personnel_nr
            
        if personnel_nr not in self.personnel_map:
            self.personnel_counter += 1
            self.personnel_map[personnel_nr] = f"EMP{self.personnel_counter:03d}"
        
        return self.personnel_map[personnel_nr]
    
    def anonymize_text(self, text: str) -> str:
        """
        Replace descriptive text with generic placeholder.
        
        Args:
            text: Original descriptive text
            
        Returns:
            Generic placeholder text "Item Description"
            
        Example:
            >>> anonymizer = AnonymizerService()
            >>> anonymizer.anonymize_text("Consulting services for Q1")
            "Item Description"
        """
        if not text:
            return text
        
        return "Item Description"
    
    def get_generic_description(self, category: str, original: str = None) -> str:
        """
        Get a generic description from predefined list.
        
        Cycles through available descriptions to provide variety while
        maintaining anonymization.
        
        Args:
            category: Category of description (project, wbs, cost_center, etc.)
            original: Original text (not used, for future enhancement)
            
        Returns:
            Generic description from the category
        """
        if category not in self.generic_descriptions:
            return "Generic Description"
        
        descriptions = self.generic_descriptions[category]
        counter = self.description_counters[category]
        
        # Cycle through descriptions
        description = descriptions[counter % len(descriptions)]
        self.description_counters[category] += 1
        
        return description

    def obfuscate_amount(self, value: Optional[float]) -> Optional[float]:
        """
        Scale monetary values so they are not traceable but ratios remain meaningful.
        Uses a per-session factor (set at init). None and zero are preserved.
        """
        if value is None:
            return None
        try:
            v = float(value)
            if v == 0:
                return 0.0
            return round(v * self._amount_factor, 2)
        except (TypeError, ValueError):
            return value

    def obfuscate_date(self, d: Optional[date]) -> Optional[date]:
        """Shift date by session offset so dates are not traceable."""
        if d is None:
            return None
        if isinstance(d, str):
            try:
                d = date.fromisoformat(d[:10])
            except (ValueError, TypeError):
                return d
        return d + timedelta(days=self._date_days_shift)

    def anonymize_project(self, project: Dict[str, Any]) -> Dict[str, Any]:
        """
        Anonymize a project record for project import.
        
        - name: Replaced with deterministic Pxxxx (same as project_nr in commitments/actuals).
        - description: Replaced with generic project description.
        - budget: Obfuscated with session amount factor.
        - start_date / end_date: Optional shift by session offset (if obfuscation desired).
        
        Other fields (portfolio_id, status, priority, manager_id, etc.) are preserved.
        """
        out = dict(project)
        name = (project.get("name") or "").strip()
        if name:
            out["name"] = self._project_nr_deterministic(name)
        if project.get("description"):
            out["description"] = self.get_generic_description("project", project.get("description"))
        if project.get("budget") is not None:
            out["budget"] = self.obfuscate_amount(float(project["budget"]))
        if project.get("start_date"):
            out["start_date"] = self.obfuscate_date(project["start_date"])
        if project.get("end_date"):
            out["end_date"] = self.obfuscate_date(project["end_date"])
        return out

    def anonymize_actual(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Anonymize a single actual record.
        
        Anonymizes:
        - vendor: Replaced with "Vendor A", "Vendor B", etc. (if present)
        - vendor_description: Replaced with "Vendor Description" (if present)
        - project_nr: Replaced with "P0001", "P0002", etc.
        - item_text: Replaced with "Item Description" (if present)
        
        Preserves:
        - fi_doc_no: Financial document number (unique identifier)
        - posting_date: Date of posting
        - document_date: Date of document
        - wbs_element: Work breakdown structure element
        - amount: Transaction amount
        - currency: Currency code
        - document_type: Type of document
        
        Args:
            record: Dictionary containing actual record fields
            
        Returns:
            Dictionary with anonymized fields
        """
        anonymized = record.copy()
        
        # Anonymize vendor name (if present and not empty)
        if "vendor" in anonymized and anonymized["vendor"]:
            anonymized["vendor"] = self.anonymize_vendor(anonymized["vendor"])
        
        # Anonymize vendor description (if present and not empty)
        if "vendor_description" in anonymized and anonymized["vendor_description"]:
            anonymized["vendor_description"] = "Vendor Description"
        
        # Anonymize project number
        if "project_nr" in anonymized and anonymized["project_nr"]:
            anonymized["project_nr"] = self.anonymize_project_nr(anonymized["project_nr"])
        
        # Anonymize item text (if present and not empty)
        if "item_text" in anonymized and anonymized["item_text"]:
            anonymized["item_text"] = self.anonymize_text(anonymized["item_text"])
        
        # Obfuscate amounts so they are not traceable but ratios remain meaningful
        for key in ("amount", "value_in_document_currency", "tax_amount"):
            if key in anonymized and anonymized[key] is not None:
                anonymized[key] = self.obfuscate_amount(anonymized[key])
        
        return anonymized
    
    def anonymize_commitment(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Anonymize a single commitment record.
        
        Anonymizes:
        - vendor: Replaced with "Vendor A", "Vendor B", etc.
        - vendor_description: Replaced with "Vendor Description"
        - project_nr: Replaced with "P0001", "P0002", etc.
        - project_description: Replaced with generic project description
        - wbs_description: Replaced with generic WBS description
        - cost_center_description: Replaced with generic cost center description
        - po_line_text: Replaced with generic item description
        - po_title: Replaced with generic PO title
        - requester: Replaced with anonymized personnel number
        - po_created_by: Replaced with anonymized personnel number
        
        Preserves:
        - po_number: Purchase order number (unique identifier)
        - po_date: Date of purchase order
        - wbs_element: Work breakdown structure element
        - cost_center: Cost center code
        - po_net_amount: Net amount of purchase order
        - total_amount: Total amount including taxes
        - currency: Currency code
        - po_status: Status of purchase order
        - po_line_nr: Line number within purchase order
        - delivery_date: Expected delivery date
        - All other technical/financial fields
        
        Args:
            record: Dictionary containing commitment record fields
            
        Returns:
            Dictionary with anonymized fields
        """
        anonymized = record.copy()
        
        # Anonymize vendor name
        if "vendor" in anonymized and anonymized["vendor"]:
            anonymized["vendor"] = self.anonymize_vendor(anonymized["vendor"])
        
        # Anonymize vendor description
        if "vendor_description" in anonymized and anonymized["vendor_description"]:
            anonymized["vendor_description"] = "Vendor Description"
        
        # Anonymize project number
        if "project_nr" in anonymized and anonymized["project_nr"]:
            anonymized["project_nr"] = self.anonymize_project_nr(anonymized["project_nr"])
        
        # Anonymize project description
        if "project_description" in anonymized and anonymized["project_description"]:
            anonymized["project_description"] = self.get_generic_description('project', anonymized["project_description"])
        
        # Anonymize WBS description
        if "wbs_description" in anonymized and anonymized["wbs_description"]:
            anonymized["wbs_description"] = self.get_generic_description('wbs', anonymized["wbs_description"])
        
        # Anonymize cost center description
        if "cost_center_description" in anonymized and anonymized["cost_center_description"]:
            anonymized["cost_center_description"] = self.get_generic_description('cost_center', anonymized["cost_center_description"])
        
        # Anonymize PO line text
        if "po_line_text" in anonymized and anonymized["po_line_text"]:
            anonymized["po_line_text"] = self.get_generic_description('po_line', anonymized["po_line_text"])
        
        # Anonymize PO title
        if "po_title" in anonymized and anonymized["po_title"]:
            anonymized["po_title"] = self.get_generic_description('po_title', anonymized["po_title"])
        
        # Anonymize requester
        if "requester" in anonymized and anonymized["requester"]:
            anonymized["requester"] = self.anonymize_personnel(anonymized["requester"])
        
        # Anonymize PO created by
        if "po_created_by" in anonymized and anonymized["po_created_by"]:
            anonymized["po_created_by"] = self.anonymize_personnel(anonymized["po_created_by"])
        
        # Obfuscate amounts so they are not traceable but ratios remain meaningful
        for key in ("po_net_amount", "total_amount", "tax_amount", "value_in_document_currency"):
            if key in anonymized and anonymized[key] is not None:
                anonymized[key] = self.obfuscate_amount(anonymized[key])
        
        return anonymized
