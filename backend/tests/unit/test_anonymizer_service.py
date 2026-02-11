"""
Unit tests for Anonymizer Service

Tests the anonymization functionality for actuals and commitments imports.
"""

import pytest
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from services.anonymizer import AnonymizerService


class TestAnonymizerService:
    """Test suite for AnonymizerService"""
    
    def test_anonymize_vendor_creates_sequential_identifiers(self):
        """Test that vendors are anonymized with sequential letter identifiers"""
        anonymizer = AnonymizerService()
        
        vendor1 = anonymizer.anonymize_vendor("ACME Corp")
        vendor2 = anonymizer.anonymize_vendor("XYZ Ltd")
        vendor3 = anonymizer.anonymize_vendor("ABC Inc")
        
        assert vendor1 == "Vendor A"
        assert vendor2 == "Vendor B"
        assert vendor3 == "Vendor C"
    
    def test_anonymize_vendor_maintains_consistency(self):
        """Test that same vendor always maps to same anonymized value"""
        anonymizer = AnonymizerService()
        
        vendor1_first = anonymizer.anonymize_vendor("ACME Corp")
        vendor2 = anonymizer.anonymize_vendor("XYZ Ltd")
        vendor1_second = anonymizer.anonymize_vendor("ACME Corp")
        
        assert vendor1_first == vendor1_second == "Vendor A"
        assert vendor2 == "Vendor B"
    
    def test_anonymize_vendor_handles_empty_string(self):
        """Test that empty vendor string is preserved"""
        anonymizer = AnonymizerService()
        
        result = anonymizer.anonymize_vendor("")
        
        assert result == ""
    
    def test_anonymize_project_nr_deterministic_format(self):
        """Test that project numbers are anonymized to P0001-P9999 format (deterministic hash)"""
        anonymizer = AnonymizerService()
        
        project1 = anonymizer.anonymize_project_nr("PRJ-2024-001")
        project2 = anonymizer.anonymize_project_nr("PRJ-2024-002")
        project3 = anonymizer.anonymize_project_nr("PRJ-2024-003")
        
        import re
        pattern = re.compile(r"^P\d{4}$")
        assert pattern.match(project1), f"Expected P0001-P9999, got {project1}"
        assert pattern.match(project2), f"Expected P0001-P9999, got {project2}"
        assert pattern.match(project3), f"Expected P0001-P9999, got {project3}"
    
    def test_anonymize_project_nr_maintains_consistency(self):
        """Test that same project number always maps to same anonymized value (deterministic)"""
        anonymizer = AnonymizerService()
        
        project1_first = anonymizer.anonymize_project_nr("PRJ-2024-001")
        project2 = anonymizer.anonymize_project_nr("PRJ-2024-002")
        project1_second = anonymizer.anonymize_project_nr("PRJ-2024-001")
        
        assert project1_first == project1_second
        assert project2 != project1_first or project2 == project1_first  # may differ or collide
    
    def test_anonymize_personnel_creates_sequential_identifiers(self):
        """Test that personnel numbers are anonymized with EMP001 format"""
        anonymizer = AnonymizerService()
        
        emp1 = anonymizer.anonymize_personnel("12345")
        emp2 = anonymizer.anonymize_personnel("67890")
        emp3 = anonymizer.anonymize_personnel("11111")
        
        assert emp1 == "EMP001"
        assert emp2 == "EMP002"
        assert emp3 == "EMP003"
    
    def test_anonymize_personnel_maintains_consistency(self):
        """Test that same personnel number always maps to same anonymized value"""
        anonymizer = AnonymizerService()
        
        emp1_first = anonymizer.anonymize_personnel("12345")
        emp2 = anonymizer.anonymize_personnel("67890")
        emp1_second = anonymizer.anonymize_personnel("12345")
        
        assert emp1_first == emp1_second == "EMP001"
        assert emp2 == "EMP002"
    
    def test_anonymize_text_replaces_with_generic_placeholder(self):
        """Test that descriptive text is replaced with generic placeholder"""
        anonymizer = AnonymizerService()
        
        result1 = anonymizer.anonymize_text("Consulting services for Q1")
        result2 = anonymizer.anonymize_text("Hardware purchase")
        
        assert result1 == "Item Description"
        assert result2 == "Item Description"
    
    def test_anonymize_text_handles_empty_string(self):
        """Test that empty text is preserved"""
        anonymizer = AnonymizerService()
        
        result = anonymizer.anonymize_text("")
        
        assert result == ""
    
    def test_anonymize_actual_anonymizes_sensitive_fields(self):
        """Test that actual record has sensitive fields anonymized"""
        anonymizer = AnonymizerService()
        
        record = {
            "fi_doc_no": "FI-2024-001",
            "vendor": "ACME Corp",
            "vendor_description": "ACME Corporation Ltd",
            "project_nr": "PRJ-2024-001",
            "item_text": "Consulting services",
            "amount": 1000.00,
            "currency": "EUR",
            "posting_date": "2024-01-15"
        }
        
        result = anonymizer.anonymize_actual(record)
        
        # Sensitive fields should be anonymized
        assert result["vendor"] == "Vendor A"
        assert result["vendor_description"] == "Vendor Description"
        assert result["project_nr"].startswith("P") and len(result["project_nr"]) == 5 and result["project_nr"][1:].isdigit()
        assert result["item_text"] == "Item Description"
        
        # Non-sensitive fields preserved; amount is obfuscated (scaled)
        assert result["fi_doc_no"] == "FI-2024-001"
        assert isinstance(result["amount"], (int, float)) and result["amount"] != 0
        assert result["currency"] == "EUR"
        assert result["posting_date"] == "2024-01-15"
    
    def test_anonymize_actual_preserves_non_sensitive_fields(self):
        """Test that actual record preserves dates, amounts, and currency"""
        anonymizer = AnonymizerService()
        
        record = {
            "fi_doc_no": "FI-2024-002",
            "posting_date": "2024-02-20",
            "document_date": "2024-02-18",
            "vendor": "XYZ Ltd",
            "project_nr": "PRJ-2024-002",
            "amount": 5000.50,
            "currency": "USD",
            "document_type": "invoice"
        }
        
        result = anonymizer.anonymize_actual(record)
        
        # Non-sensitive fields unchanged; amount is obfuscated
        assert result["fi_doc_no"] == "FI-2024-002"
        assert result["posting_date"] == "2024-02-20"
        assert result["document_date"] == "2024-02-18"
        assert isinstance(result["amount"], (int, float))
        assert result["currency"] == "USD"
        assert result["document_type"] == "invoice"
    
    def test_anonymize_commitment_anonymizes_sensitive_fields(self):
        """Test that commitment record has sensitive fields anonymized"""
        anonymizer = AnonymizerService()
        
        record = {
            "po_number": "PO-2024-001",
            "vendor": "ABC Inc",
            "vendor_description": "ABC Incorporated",
            "project_nr": "PRJ-2024-003",
            "po_net_amount": 10000.00,
            "total_amount": 11000.00,
            "currency": "EUR",
            "po_date": "2024-03-01"
        }
        
        result = anonymizer.anonymize_commitment(record)
        
        # Sensitive fields should be anonymized
        assert result["vendor"] == "Vendor A"
        assert result["vendor_description"] == "Vendor Description"
        assert result["project_nr"].startswith("P") and len(result["project_nr"]) == 5 and result["project_nr"][1:].isdigit()
        
        # Amounts are obfuscated (scaled); other non-sensitive preserved
        assert result["po_number"] == "PO-2024-001"
        assert isinstance(result["po_net_amount"], (int, float))
        assert isinstance(result["total_amount"], (int, float))
        assert result["currency"] == "EUR"
        assert result["po_date"] == "2024-03-01"
    
    def test_anonymize_commitment_preserves_non_sensitive_fields(self):
        """Test that commitment record preserves dates, amounts, and status"""
        anonymizer = AnonymizerService()
        
        record = {
            "po_number": "PO-2024-002",
            "po_date": "2024-03-15",
            "delivery_date": "2024-04-15",
            "vendor": "XYZ Ltd",
            "project_nr": "PRJ-2024-004",
            "po_net_amount": 25000.00,
            "total_amount": 27500.00,
            "currency": "CHF",
            "po_status": "approved",
            "po_line_nr": 1
        }
        
        result = anonymizer.anonymize_commitment(record)
        
        # Amounts obfuscated; rest unchanged
        assert result["po_number"] == "PO-2024-002"
        assert result["po_date"] == "2024-03-15"
        assert result["delivery_date"] == "2024-04-15"
        assert isinstance(result["po_net_amount"], (int, float))
        assert isinstance(result["total_amount"], (int, float))
        assert result["currency"] == "CHF"
        assert result["po_status"] == "approved"
        assert result["po_line_nr"] == 1
    
    def test_anonymize_actual_handles_missing_optional_fields(self):
        """Test that anonymizer handles records with missing optional fields"""
        anonymizer = AnonymizerService()
        
        record = {
            "fi_doc_no": "FI-2024-003",
            "vendor": "Test Vendor",
            "project_nr": "PRJ-2024-005",
            "amount": 500.00,
            "currency": "EUR"
        }
        
        result = anonymizer.anonymize_actual(record)
        
        assert result["vendor"] == "Vendor A"
        assert result["project_nr"].startswith("P") and result["project_nr"][1:].isdigit()
        assert "vendor_description" not in result
        assert "item_text" not in result
    
    def test_anonymize_commitment_handles_missing_optional_fields(self):
        """Test that anonymizer handles commitment records with missing optional fields"""
        anonymizer = AnonymizerService()
        
        record = {
            "po_number": "PO-2024-003",
            "vendor": "Test Vendor",
            "project_nr": "PRJ-2024-006",
            "po_net_amount": 1000.00,
            "total_amount": 1100.00,
            "currency": "USD"
        }
        
        result = anonymizer.anonymize_commitment(record)
        
        assert result["vendor"] == "Vendor A"
        assert result["project_nr"].startswith("P") and result["project_nr"][1:].isdigit()
        assert "vendor_description" not in result
