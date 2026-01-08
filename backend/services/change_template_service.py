"""
Change Template Service

Handles change request templates for different change types with form generation,
validation, versioning, and customization capabilities.
"""

import asyncio
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
import logging
import json

from config.database import supabase
from models.change_management import (
    ChangeTemplateCreate, ChangeTemplateResponse, ChangeType,
    ChangeRequestCreate
)
from .cache_service import cache_service

logger = logging.getLogger(__name__)

class ChangeTemplateService:
    """
    Service for managing change request templates.
    
    Handles:
    - Template system for different change types
    - Template-based form generation and validation
    - Template versioning and customization
    """
    
    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")
    
    async def create_template(
        self,
        template_data: ChangeTemplateCreate,
        created_by: UUID
    ) -> ChangeTemplateResponse:
        """
        Create a new change request template.
        
        Args:
            template_data: Template creation data
            created_by: ID of the user creating the template
            
        Returns:
            ChangeTemplateResponse: Created template data
        """
        try:
            # Validate template data structure
            self._validate_template_data(template_data.template_data)
            
            # Prepare data for insertion
            insert_data = {
                "name": template_data.name,
                "description": template_data.description,
                "change_type": template_data.change_type.value,
                "template_data": template_data.template_data,
                "is_active": template_data.is_active,
                "created_by": str(created_by),
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Insert into database
            result = self.db.table("change_templates").insert(insert_data).execute()
            
            if not result.data:
                raise RuntimeError("Failed to create template")
            
            created_template = result.data[0]
            
            return await self._convert_to_response(created_template)
            
        except Exception as e:
            logger.error(f"Error creating template: {e}")
            raise RuntimeError(f"Failed to create template: {str(e)}")
    
    async def get_template(self, template_id: UUID) -> Optional[ChangeTemplateResponse]:
        """
        Retrieve a template by ID.
        
        Args:
            template_id: ID of the template
            
        Returns:
            ChangeTemplateResponse or None if not found
        """
        try:
            result = self.db.table("change_templates").select("*").eq("id", str(template_id)).execute()
            
            if not result.data:
                return None
            
            return await self._convert_to_response(result.data[0])
            
        except Exception as e:
            logger.error(f"Error retrieving template {template_id}: {e}")
            raise RuntimeError(f"Failed to retrieve template: {str(e)}")
    
    async def list_templates(
        self,
        change_type: Optional[ChangeType] = None,
        active_only: bool = True
    ) -> List[ChangeTemplateResponse]:
        """
        List available templates with optional filtering.
        
        Args:
            change_type: Optional filter by change type
            active_only: Whether to include only active templates
            
        Returns:
            List of template responses
        """
        try:
            query = self.db.table("change_templates").select("*")
            
            if change_type:
                query = query.eq("change_type", change_type.value)
            
            if active_only:
                query = query.eq("is_active", True)
            
            query = query.order("name")
            
            result = query.execute()
            
            templates = []
            for item in result.data:
                templates.append(await self._convert_to_response(item))
            
            return templates
            
        except Exception as e:
            logger.error(f"Error listing templates: {e}")
            raise RuntimeError(f"Failed to list templates: {str(e)}")
    
    async def update_template(
        self,
        template_id: UUID,
        updates: Dict[str, Any],
        updated_by: UUID
    ) -> ChangeTemplateResponse:
        """
        Update an existing template.
        
        Args:
            template_id: ID of the template to update
            updates: Update data
            updated_by: ID of the user making the update
            
        Returns:
            ChangeTemplateResponse: Updated template data
        """
        try:
            # Validate template data if being updated
            if "template_data" in updates:
                self._validate_template_data(updates["template_data"])
            
            # Add metadata
            updates["updated_at"] = datetime.utcnow().isoformat()
            
            # Update in database
            result = self.db.table("change_templates").update(updates).eq("id", str(template_id)).execute()
            
            if not result.data:
                raise RuntimeError("Failed to update template")
            
            updated_template = result.data[0]
            
            return await self._convert_to_response(updated_template)
            
        except Exception as e:
            logger.error(f"Error updating template {template_id}: {e}")
            raise RuntimeError(f"Failed to update template: {str(e)}")
    
    async def apply_template_to_change_request(
        self,
        template_id: UUID,
        base_data: ChangeRequestCreate,
        custom_values: Optional[Dict[str, Any]] = None
    ) -> ChangeRequestCreate:
        """
        Apply a template to a change request, merging template data with provided values.
        
        Args:
            template_id: ID of the template to apply
            base_data: Base change request data
            custom_values: Custom values to override template defaults
            
        Returns:
            ChangeRequestCreate: Enhanced change request data with template applied
        """
        try:
            # Get template
            template = await self.get_template(template_id)
            if not template:
                raise ValueError(f"Template {template_id} not found")
            
            # Verify change type matches
            if base_data.change_type.value != template.change_type:
                raise ValueError(f"Change type mismatch: request is {base_data.change_type}, template is {template.change_type}")
            
            # Apply template data
            enhanced_data = base_data.copy()
            template_data = template.template_data
            
            # Apply template defaults
            if "default_priority" in template_data:
                enhanced_data.priority = template_data["default_priority"]
            
            if "default_description_template" in template_data and not enhanced_data.description:
                enhanced_data.description = template_data["default_description_template"]
            
            if "required_fields" in template_data:
                # Validate required fields are present
                for field in template_data["required_fields"]:
                    if not getattr(enhanced_data, field, None):
                        raise ValueError(f"Required field '{field}' is missing")
            
            # Apply custom values if provided
            if custom_values:
                for key, value in custom_values.items():
                    if hasattr(enhanced_data, key):
                        setattr(enhanced_data, key, value)
            
            # Set template reference
            enhanced_data.template_id = template_id
            enhanced_data.template_data = {
                "template_name": template.name,
                "applied_at": datetime.utcnow().isoformat(),
                "custom_values": custom_values or {}
            }
            
            return enhanced_data
            
        except Exception as e:
            logger.error(f"Error applying template {template_id}: {e}")
            raise RuntimeError(f"Failed to apply template: {str(e)}")
    
    async def generate_form_schema(
        self,
        template_id: UUID
    ) -> Dict[str, Any]:
        """
        Generate a form schema based on template configuration.
        
        Args:
            template_id: ID of the template
            
        Returns:
            Dict containing form schema for frontend rendering
        """
        try:
            template = await self.get_template(template_id)
            if not template:
                raise ValueError(f"Template {template_id} not found")
            
            template_data = template.template_data
            
            # Base form schema
            form_schema = {
                "title": f"Create {template.change_type.title()} Change Request",
                "description": template.description,
                "sections": []
            }
            
            # Basic information section
            basic_section = {
                "title": "Basic Information",
                "fields": [
                    {
                        "name": "title",
                        "type": "text",
                        "label": "Change Title",
                        "required": True,
                        "placeholder": template_data.get("title_placeholder", "Enter change title")
                    },
                    {
                        "name": "description",
                        "type": "textarea",
                        "label": "Description",
                        "required": True,
                        "placeholder": template_data.get("description_placeholder", "Describe the change"),
                        "default": template_data.get("default_description_template", "")
                    },
                    {
                        "name": "justification",
                        "type": "textarea",
                        "label": "Justification",
                        "required": template_data.get("justification_required", False),
                        "placeholder": "Why is this change needed?"
                    }
                ]
            }
            
            form_schema["sections"].append(basic_section)
            
            # Impact estimation section
            if template_data.get("include_impact_estimation", True):
                impact_section = {
                    "title": "Impact Estimation",
                    "fields": [
                        {
                            "name": "estimated_cost_impact",
                            "type": "number",
                            "label": "Estimated Cost Impact ($)",
                            "required": template_data.get("cost_impact_required", False),
                            "min": 0
                        },
                        {
                            "name": "estimated_schedule_impact_days",
                            "type": "number",
                            "label": "Estimated Schedule Impact (days)",
                            "required": template_data.get("schedule_impact_required", False),
                            "min": 0
                        },
                        {
                            "name": "estimated_effort_hours",
                            "type": "number",
                            "label": "Estimated Effort (hours)",
                            "required": False,
                            "min": 0
                        }
                    ]
                }
                
                form_schema["sections"].append(impact_section)
            
            # Custom sections from template
            if "custom_sections" in template_data:
                for section in template_data["custom_sections"]:
                    form_schema["sections"].append(section)
            
            # Validation rules
            form_schema["validation"] = template_data.get("validation_rules", {})
            
            return form_schema
            
        except Exception as e:
            logger.error(f"Error generating form schema for template {template_id}: {e}")
            raise RuntimeError(f"Failed to generate form schema: {str(e)}")
    
    async def validate_change_request_against_template(
        self,
        change_request: ChangeRequestCreate,
        template_id: UUID
    ) -> Tuple[bool, List[str]]:
        """
        Validate a change request against its template requirements.
        
        Args:
            change_request: Change request to validate
            template_id: ID of the template to validate against
            
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        try:
            template = await self.get_template(template_id)
            if not template:
                return False, [f"Template {template_id} not found"]
            
            errors = []
            template_data = template.template_data
            
            # Validate required fields
            if "required_fields" in template_data:
                for field in template_data["required_fields"]:
                    value = getattr(change_request, field, None)
                    if not value:
                        errors.append(f"Required field '{field}' is missing")
            
            # Validate field constraints
            if "field_constraints" in template_data:
                for field, constraints in template_data["field_constraints"].items():
                    value = getattr(change_request, field, None)
                    if value is not None:
                        # Min/max length for strings
                        if "min_length" in constraints and len(str(value)) < constraints["min_length"]:
                            errors.append(f"Field '{field}' must be at least {constraints['min_length']} characters")
                        
                        if "max_length" in constraints and len(str(value)) > constraints["max_length"]:
                            errors.append(f"Field '{field}' must be no more than {constraints['max_length']} characters")
                        
                        # Min/max values for numbers
                        if "min_value" in constraints and float(value) < constraints["min_value"]:
                            errors.append(f"Field '{field}' must be at least {constraints['min_value']}")
                        
                        if "max_value" in constraints and float(value) > constraints["max_value"]:
                            errors.append(f"Field '{field}' must be no more than {constraints['max_value']}")
                        
                        # Pattern matching
                        if "pattern" in constraints:
                            import re
                            if not re.match(constraints["pattern"], str(value)):
                                errors.append(f"Field '{field}' does not match required format")
            
            # Custom validation rules
            if "custom_validation" in template_data:
                for rule in template_data["custom_validation"]:
                    # Simple rule evaluation (can be extended)
                    if rule["type"] == "conditional_required":
                        condition_field = rule["condition_field"]
                        condition_value = rule["condition_value"]
                        required_field = rule["required_field"]
                        
                        if getattr(change_request, condition_field, None) == condition_value:
                            if not getattr(change_request, required_field, None):
                                errors.append(f"Field '{required_field}' is required when {condition_field} is {condition_value}")
            
            return len(errors) == 0, errors
            
        except Exception as e:
            logger.error(f"Error validating change request against template {template_id}: {e}")
            return False, [f"Validation error: {str(e)}"]
    
    async def create_default_templates(self) -> List[ChangeTemplateResponse]:
        """
        Create default templates for common change types.
        
        Returns:
            List of created templates
        """
        try:
            default_templates = [
                {
                    "name": "Scope Change Template",
                    "description": "Template for project scope changes",
                    "change_type": ChangeType.SCOPE,
                    "template_data": {
                        "title_placeholder": "Scope Change: [Brief Description]",
                        "description_placeholder": "Describe the scope change in detail, including what is being added, removed, or modified",
                        "justification_required": True,
                        "cost_impact_required": True,
                        "schedule_impact_required": True,
                        "required_fields": ["title", "description", "justification"],
                        "custom_sections": [
                            {
                                "title": "Scope Details",
                                "fields": [
                                    {
                                        "name": "scope_addition",
                                        "type": "textarea",
                                        "label": "What is being added to scope?",
                                        "required": False
                                    },
                                    {
                                        "name": "scope_removal",
                                        "type": "textarea",
                                        "label": "What is being removed from scope?",
                                        "required": False
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    "name": "Budget Change Template",
                    "description": "Template for budget-related changes",
                    "change_type": ChangeType.BUDGET,
                    "template_data": {
                        "title_placeholder": "Budget Change: [Brief Description]",
                        "description_placeholder": "Describe the budget change and its impact",
                        "justification_required": True,
                        "cost_impact_required": True,
                        "required_fields": ["title", "description", "justification", "estimated_cost_impact"],
                        "field_constraints": {
                            "estimated_cost_impact": {
                                "min_value": 0
                            }
                        }
                    }
                },
                {
                    "name": "Schedule Change Template",
                    "description": "Template for schedule-related changes",
                    "change_type": ChangeType.SCHEDULE,
                    "template_data": {
                        "title_placeholder": "Schedule Change: [Brief Description]",
                        "description_placeholder": "Describe the schedule change and affected activities",
                        "justification_required": True,
                        "schedule_impact_required": True,
                        "required_fields": ["title", "description", "justification", "estimated_schedule_impact_days"],
                        "custom_sections": [
                            {
                                "title": "Schedule Details",
                                "fields": [
                                    {
                                        "name": "critical_path_affected",
                                        "type": "checkbox",
                                        "label": "Does this change affect the critical path?",
                                        "required": False
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    "name": "Emergency Change Template",
                    "description": "Template for emergency changes requiring immediate attention",
                    "change_type": ChangeType.EMERGENCY,
                    "template_data": {
                        "title_placeholder": "EMERGENCY: [Brief Description]",
                        "description_placeholder": "Describe the emergency situation and required immediate action",
                        "justification_required": True,
                        "default_priority": "emergency",
                        "required_fields": ["title", "description", "justification"],
                        "custom_sections": [
                            {
                                "title": "Emergency Details",
                                "fields": [
                                    {
                                        "name": "safety_impact",
                                        "type": "textarea",
                                        "label": "Safety Impact",
                                        "required": True
                                    },
                                    {
                                        "name": "immediate_action_required",
                                        "type": "textarea",
                                        "label": "Immediate Action Required",
                                        "required": True
                                    }
                                ]
                            }
                        ],
                        "custom_validation": [
                            {
                                "type": "conditional_required",
                                "condition_field": "change_type",
                                "condition_value": "emergency",
                                "required_field": "justification"
                            }
                        ]
                    }
                }
            ]
            
            created_templates = []
            system_user_id = UUID("00000000-0000-0000-0000-000000000000")  # System user
            
            for template_data in default_templates:
                try:
                    template_create = ChangeTemplateCreate(**template_data)
                    created_template = await self.create_template(template_create, system_user_id)
                    created_templates.append(created_template)
                except Exception as e:
                    logger.warning(f"Could not create default template {template_data['name']}: {e}")
            
            return created_templates
            
        except Exception as e:
            logger.error(f"Error creating default templates: {e}")
            return []
    
    def _validate_template_data(self, template_data: Dict[str, Any]) -> None:
        """
        Validate template data structure.
        
        Args:
            template_data: Template data to validate
            
        Raises:
            ValueError: If template data is invalid
        """
        # Basic structure validation
        if not isinstance(template_data, dict):
            raise ValueError("Template data must be a dictionary")
        
        # Validate custom sections if present
        if "custom_sections" in template_data:
            if not isinstance(template_data["custom_sections"], list):
                raise ValueError("custom_sections must be a list")
            
            for section in template_data["custom_sections"]:
                if not isinstance(section, dict):
                    raise ValueError("Each custom section must be a dictionary")
                
                if "title" not in section:
                    raise ValueError("Each custom section must have a title")
                
                if "fields" in section:
                    if not isinstance(section["fields"], list):
                        raise ValueError("Section fields must be a list")
                    
                    for field in section["fields"]:
                        if not isinstance(field, dict):
                            raise ValueError("Each field must be a dictionary")
                        
                        required_field_keys = ["name", "type", "label"]
                        for key in required_field_keys:
                            if key not in field:
                                raise ValueError(f"Field must have '{key}' property")
        
        # Validate field constraints if present
        if "field_constraints" in template_data:
            if not isinstance(template_data["field_constraints"], dict):
                raise ValueError("field_constraints must be a dictionary")
    
    async def _convert_to_response(self, db_record: Dict[str, Any]) -> ChangeTemplateResponse:
        """
        Convert database record to response model.
        
        Args:
            db_record: Database record
            
        Returns:
            ChangeTemplateResponse: Converted response model
        """
        return ChangeTemplateResponse(
            id=db_record["id"],
            name=db_record["name"],
            description=db_record.get("description"),
            change_type=db_record["change_type"],
            template_data=db_record["template_data"],
            is_active=db_record["is_active"],
            created_by=db_record["created_by"],
            created_at=datetime.fromisoformat(db_record["created_at"].replace("Z", "+00:00")),
            updated_at=datetime.fromisoformat(db_record["updated_at"].replace("Z", "+00:00"))
        )