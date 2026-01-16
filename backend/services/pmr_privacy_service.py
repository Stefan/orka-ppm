"""
PMR Data Privacy Service
Manages data privacy controls, sensitive data handling, and data masking for PMR reports
"""

from typing import Dict, Any, List, Optional, Set
from uuid import UUID
import re
import hashlib

from config.database import supabase


class SensitivityLevel:
    """Data sensitivity levels"""
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class PMRPrivacyService:
    """Service for managing data privacy in PMR reports"""
    
    def __init__(self, supabase_client=None):
        self.supabase = supabase_client or supabase
        
        # Define sensitive field patterns
        self.sensitive_patterns = {
            "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            "phone": r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
            "ssn": r'\b\d{3}-\d{2}-\d{4}\b',
            "credit_card": r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b',
            "ip_address": r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'
        }
        
        # Define sensitive field names
        self.sensitive_field_names = {
            "salary", "compensation", "ssn", "social_security",
            "tax_id", "bank_account", "credit_card", "password",
            "secret", "private_key", "api_key", "token"
        }
    
    async def classify_report_sensitivity(
        self,
        report_data: Dict[str, Any]
    ) -> str:
        """
        Classify the sensitivity level of a PMR report
        
        Args:
            report_data: The report data to classify
        
        Returns:
            Sensitivity level (public, internal, confidential, restricted)
        """
        try:
            # Check for restricted data
            if self._contains_restricted_data(report_data):
                return SensitivityLevel.RESTRICTED
            
            # Check for confidential data
            if self._contains_confidential_data(report_data):
                return SensitivityLevel.CONFIDENTIAL
            
            # Check for internal data
            if self._contains_internal_data(report_data):
                return SensitivityLevel.INTERNAL
            
            return SensitivityLevel.PUBLIC
            
        except Exception as e:
            print(f"Error classifying report sensitivity: {e}")
            # Default to most restrictive on error
            return SensitivityLevel.RESTRICTED
    
    def _contains_restricted_data(self, data: Dict[str, Any]) -> bool:
        """Check if data contains restricted information"""
        data_str = str(data).lower()
        
        # Check for PII patterns
        for pattern_name, pattern in self.sensitive_patterns.items():
            if re.search(pattern, str(data), re.IGNORECASE):
                return True
        
        # Check for sensitive field names
        for field_name in self.sensitive_field_names:
            if field_name in data_str:
                return True
        
        return False
    
    def _contains_confidential_data(self, data: Dict[str, Any]) -> bool:
        """Check if data contains confidential information"""
        confidential_keywords = [
            "budget", "cost", "financial", "revenue", "profit",
            "contract", "vendor", "supplier", "pricing"
        ]
        
        data_str = str(data).lower()
        return any(keyword in data_str for keyword in confidential_keywords)
    
    def _contains_internal_data(self, data: Dict[str, Any]) -> bool:
        """Check if data contains internal information"""
        internal_keywords = [
            "resource", "allocation", "schedule", "milestone",
            "risk", "issue", "team", "project"
        ]
        
        data_str = str(data).lower()
        return any(keyword in data_str for keyword in internal_keywords)
    
    async def mask_sensitive_data(
        self,
        data: Dict[str, Any],
        user_permissions: List[str],
        mask_level: str = "partial"
    ) -> Dict[str, Any]:
        """
        Mask sensitive data based on user permissions
        
        Args:
            data: The data to mask
            user_permissions: List of user permissions
            mask_level: Level of masking (none, partial, full)
        
        Returns:
            Masked data dictionary
        """
        try:
            # If user has full access, return unmasked data
            if "pmr_audit_read" in user_permissions or "system_admin" in user_permissions:
                return data
            
            masked_data = data.copy()
            
            # Mask sensitive fields
            for key, value in masked_data.items():
                if isinstance(value, dict):
                    masked_data[key] = await self.mask_sensitive_data(
                        value, user_permissions, mask_level
                    )
                elif isinstance(value, list):
                    masked_data[key] = [
                        await self.mask_sensitive_data(item, user_permissions, mask_level)
                        if isinstance(item, dict) else item
                        for item in value
                    ]
                elif isinstance(value, str):
                    if self._is_sensitive_field(key):
                        masked_data[key] = self._mask_string(value, mask_level)
                    else:
                        # Check for PII patterns in the value
                        masked_data[key] = self._mask_pii_patterns(value, mask_level)
            
            return masked_data
            
        except Exception as e:
            print(f"Error masking sensitive data: {e}")
            return data
    
    def _is_sensitive_field(self, field_name: str) -> bool:
        """Check if a field name indicates sensitive data"""
        field_lower = field_name.lower()
        return any(sensitive in field_lower for sensitive in self.sensitive_field_names)
    
    def _mask_string(self, value: str, mask_level: str) -> str:
        """Mask a string value"""
        if mask_level == "none":
            return value
        elif mask_level == "full":
            return "***REDACTED***"
        else:  # partial
            if len(value) <= 4:
                return "*" * len(value)
            return value[:2] + "*" * (len(value) - 4) + value[-2:]
    
    def _mask_pii_patterns(self, value: str, mask_level: str) -> str:
        """Mask PII patterns in a string"""
        if mask_level == "none":
            return value
        
        masked_value = value
        
        # Mask email addresses
        masked_value = re.sub(
            self.sensitive_patterns["email"],
            lambda m: self._mask_email(m.group(), mask_level),
            masked_value
        )
        
        # Mask phone numbers
        masked_value = re.sub(
            self.sensitive_patterns["phone"],
            "***-***-****" if mask_level == "full" else "XXX-XXX-****",
            masked_value
        )
        
        # Mask SSN
        masked_value = re.sub(
            self.sensitive_patterns["ssn"],
            "***-**-****",
            masked_value
        )
        
        # Mask credit cards
        masked_value = re.sub(
            self.sensitive_patterns["credit_card"],
            "**** **** **** ****",
            masked_value
        )
        
        return masked_value
    
    def _mask_email(self, email: str, mask_level: str) -> str:
        """Mask an email address"""
        if mask_level == "full":
            return "***@***.***"
        
        parts = email.split("@")
        if len(parts) != 2:
            return email
        
        username = parts[0]
        domain = parts[1]
        
        if len(username) <= 2:
            masked_username = "*" * len(username)
        else:
            masked_username = username[0] + "*" * (len(username) - 2) + username[-1]
        
        return f"{masked_username}@{domain}"
    
    async def get_data_access_permissions(
        self,
        user_id: UUID,
        report_id: UUID
    ) -> Dict[str, bool]:
        """
        Get data access permissions for a user on a specific report
        
        Args:
            user_id: ID of the user
            report_id: ID of the PMR report
        
        Returns:
            Dictionary of permission flags
        """
        try:
            # Check if user has access to the report
            response = self.supabase.table("pmr_reports").select(
                "project_id, generated_by, approved_by"
            ).eq("id", str(report_id)).execute()
            
            if not response.data:
                return {
                    "can_view": False,
                    "can_edit": False,
                    "can_export": False,
                    "can_view_sensitive": False
                }
            
            report = response.data[0]
            
            # Check if user is the report creator or approver
            is_creator = str(report.get("generated_by")) == str(user_id)
            is_approver = str(report.get("approved_by")) == str(user_id)
            
            # Check project access
            project_id = report.get("project_id")
            has_project_access = await self._check_project_access(user_id, project_id)
            
            return {
                "can_view": has_project_access or is_creator or is_approver,
                "can_edit": has_project_access and (is_creator or is_approver),
                "can_export": has_project_access,
                "can_view_sensitive": is_creator or is_approver
            }
            
        except Exception as e:
            print(f"Error getting data access permissions: {e}")
            return {
                "can_view": False,
                "can_edit": False,
                "can_export": False,
                "can_view_sensitive": False
            }
    
    async def _check_project_access(self, user_id: UUID, project_id: UUID) -> bool:
        """Check if user has access to a project"""
        try:
            # Check if user is assigned to the project
            response = self.supabase.table("project_team_members").select("id").eq(
                "project_id", str(project_id)
            ).eq("user_id", str(user_id)).execute()
            
            return bool(response.data)
            
        except Exception as e:
            print(f"Error checking project access: {e}")
            return False
    
    async def anonymize_report_data(
        self,
        report_data: Dict[str, Any],
        preserve_structure: bool = True
    ) -> Dict[str, Any]:
        """
        Anonymize report data for sharing or testing
        
        Args:
            report_data: The report data to anonymize
            preserve_structure: Whether to preserve data structure
        
        Returns:
            Anonymized report data
        """
        try:
            anonymized = report_data.copy()
            
            # Anonymize user IDs
            if "generated_by" in anonymized:
                anonymized["generated_by"] = self._hash_id(anonymized["generated_by"])
            
            if "approved_by" in anonymized:
                anonymized["approved_by"] = self._hash_id(anonymized["approved_by"])
            
            # Anonymize project ID
            if "project_id" in anonymized:
                anonymized["project_id"] = self._hash_id(anonymized["project_id"])
            
            # Anonymize sensitive content
            if "sections" in anonymized:
                anonymized["sections"] = self._anonymize_sections(
                    anonymized["sections"], preserve_structure
                )
            
            if "ai_insights" in anonymized:
                anonymized["ai_insights"] = self._anonymize_insights(
                    anonymized["ai_insights"], preserve_structure
                )
            
            return anonymized
            
        except Exception as e:
            print(f"Error anonymizing report data: {e}")
            return report_data
    
    def _hash_id(self, id_value: Any) -> str:
        """Hash an ID value for anonymization"""
        if not id_value:
            return None
        
        hash_obj = hashlib.sha256(str(id_value).encode())
        return hash_obj.hexdigest()[:16]
    
    def _anonymize_sections(
        self,
        sections: List[Dict[str, Any]],
        preserve_structure: bool
    ) -> List[Dict[str, Any]]:
        """Anonymize report sections"""
        anonymized_sections = []
        
        for section in sections:
            anonymized_section = section.copy()
            
            if "content" in anonymized_section:
                if preserve_structure:
                    anonymized_section["content"] = "[ANONYMIZED CONTENT]"
                else:
                    anonymized_section["content"] = ""
            
            anonymized_sections.append(anonymized_section)
        
        return anonymized_sections
    
    def _anonymize_insights(
        self,
        insights: List[Dict[str, Any]],
        preserve_structure: bool
    ) -> List[Dict[str, Any]]:
        """Anonymize AI insights"""
        anonymized_insights = []
        
        for insight in insights:
            anonymized_insight = insight.copy()
            
            if "content" in anonymized_insight:
                if preserve_structure:
                    anonymized_insight["content"] = "[ANONYMIZED INSIGHT]"
                else:
                    anonymized_insight["content"] = ""
            
            if "supporting_data" in anonymized_insight:
                anonymized_insight["supporting_data"] = {}
            
            anonymized_insights.append(anonymized_insight)
        
        return anonymized_insights


# Initialize privacy service
pmr_privacy_service = PMRPrivacyService()
