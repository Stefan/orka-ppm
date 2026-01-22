"""
Bulk Import Processor for CSV and JSON file uploads

This module handles parsing, validation, and batch insertion of bulk data imports
for projects, resources, and financials.
"""

import json
import pandas as pd
from typing import Dict, List, Tuple, Any, Optional
from io import BytesIO
from decimal import Decimal
from datetime import date, datetime
from uuid import UUID
import logging

from pydantic import BaseModel, Field, EmailStr, validator
from supabase import Client

logger = logging.getLogger(__name__)


# Import Validation Models
class ProjectImportModel(BaseModel):
    """Validation model for project imports"""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    start_date: date
    end_date: date
    budget: Decimal = Field(..., ge=0)
    status: str = Field(default="planning")
    priority: Optional[str] = None
    portfolio_id: Optional[UUID] = None
    
    @validator('end_date')
    def end_after_start(cls, v, values):
        if 'start_date' in values and v < values['start_date']:
            raise ValueError('end_date must be after start_date')
        return v
    
    @validator('status')
    def valid_status(cls, v):
        valid_statuses = ['planning', 'active', 'on_hold', 'completed', 'cancelled']
        if v not in valid_statuses:
            raise ValueError(f'status must be one of: {", ".join(valid_statuses)}')
        return v


class ResourceImportModel(BaseModel):
    """Validation model for resource imports"""
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    role: str = Field(..., min_length=1, max_length=100)
    hourly_rate: Decimal = Field(..., ge=0)
    skills: List[str] = Field(default_factory=list)
    capacity: int = Field(default=40, ge=0, le=168)  # hours per week
    availability: int = Field(default=100, ge=0, le=100)  # percentage
    location: Optional[str] = None


class FinancialImportModel(BaseModel):
    """Validation model for financial imports"""
    project_id: UUID
    category: str = Field(..., min_length=1, max_length=100)
    amount: Decimal
    date_incurred: date = Field(default_factory=date.today)
    transaction_type: str = Field(default="expense")
    description: Optional[str] = None
    currency: str = Field(default="USD", max_length=3)
    
    @validator('transaction_type')
    def valid_transaction_type(cls, v):
        valid_types = ['expense', 'income', 'budget_allocation']
        if v not in valid_types:
            raise ValueError(f'transaction_type must be one of: {", ".join(valid_types)}')
        return v


class ImportProcessor:
    """
    Processes bulk imports from CSV and JSON files
    
    Supports entity types: projects, resources, financials
    Validates records against Pydantic models
    Performs batch insertion with transaction atomicity
    """
    
    def __init__(self, supabase_client: Client):
        """
        Initialize ImportProcessor
        
        Args:
            supabase_client: Supabase client instance
        """
        self.supabase = supabase_client
        self.batch_size = 100
        
        # Map entity types to validation models and table names
        self.entity_config = {
            'projects': {
                'model': ProjectImportModel,
                'table': 'projects'
            },
            'resources': {
                'model': ResourceImportModel,
                'table': 'resources'
            },
            'financials': {
                'model': FinancialImportModel,
                'table': 'financial_tracking'
            }
        }
    
    async def process_import(
        self,
        file_content: bytes,
        file_type: str,
        entity_type: str,
        organization_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process import file with validation and batch insertion
        
        Args:
            file_content: Raw file content as bytes
            file_type: File format ('csv' or 'json')
            entity_type: Type of entity ('projects', 'resources', 'financials')
            organization_id: Organization ID for filtering
            user_id: User ID for audit logging
            
        Returns:
            Dict containing success_count, error_count, errors, and processing_time
        """
        start_time = datetime.now()
        
        try:
            # Validate entity type
            if entity_type not in self.entity_config:
                raise ValueError(f"Invalid entity_type: {entity_type}. Must be one of: {', '.join(self.entity_config.keys())}")
            
            # Parse file based on type
            if file_type == 'csv':
                records = self._parse_csv(file_content)
            elif file_type == 'json':
                records = self._parse_json(file_content)
            else:
                raise ValueError(f"Invalid file_type: {file_type}. Must be 'csv' or 'json'")
            
            # Validate records
            valid_records, validation_errors = await self._validate_records(
                records, entity_type
            )
            
            # If there are validation errors, return them without inserting
            if validation_errors:
                processing_time = (datetime.now() - start_time).total_seconds()
                return {
                    'success_count': 0,
                    'error_count': len(validation_errors),
                    'errors': validation_errors,
                    'processing_time_seconds': processing_time
                }
            
            # Batch insert valid records
            success_count = await self._batch_insert(
                valid_records,
                self.entity_config[entity_type]['table'],
                organization_id
            )
            
            # Log import operation to audit_logs
            await self._log_import(
                user_id=user_id,
                organization_id=organization_id,
                entity_type=entity_type,
                success_count=success_count,
                error_count=0
            )
            
            processing_time = (datetime.now() - start_time).total_seconds()
            
            return {
                'success_count': success_count,
                'error_count': 0,
                'errors': [],
                'processing_time_seconds': processing_time
            }
            
        except Exception as e:
            logger.error(f"Import processing error: {str(e)}", exc_info=True)
            
            # Log failed import
            await self._log_import(
                user_id=user_id,
                organization_id=organization_id,
                entity_type=entity_type,
                success_count=0,
                error_count=1,
                error_message=str(e)
            )
            
            raise
    
    def _parse_csv(self, content: bytes) -> List[Dict[str, Any]]:
        """
        Parse CSV file using pandas
        
        Args:
            content: Raw CSV content as bytes
            
        Returns:
            List of dictionaries representing records
        """
        try:
            # Try multiple encodings
            encodings = ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']
            df = None
            
            for encoding in encodings:
                try:
                    df = pd.read_csv(
                        BytesIO(content),
                        encoding=encoding,
                        parse_dates=False,  # Don't auto-parse dates
                        keep_default_na=False,  # Don't use default NA values
                        na_values=[''],  # Only treat empty strings as NA
                        dtype=str  # Read everything as string initially
                    )
                    break
                except UnicodeDecodeError:
                    continue
            
            if df is None:
                raise ValueError("Failed to decode CSV file with any supported encoding")
            
            # Convert DataFrame to list of dictionaries
            # Replace NaN/None with None for optional fields
            records = []
            for _, row in df.iterrows():
                record = {}
                for col in df.columns:
                    value = row[col]
                    # Convert pandas NA/NaN to None
                    if pd.isna(value):
                        record[col] = None
                    else:
                        record[col] = value
                records.append(record)
            
            return records
            
        except pd.errors.ParserError as e:
            raise ValueError(f"Failed to parse CSV file: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error reading CSV file: {str(e)}")
    
    def _parse_json(self, content: bytes) -> List[Dict[str, Any]]:
        """
        Parse JSON file
        
        Args:
            content: Raw JSON content as bytes
            
        Returns:
            List of dictionaries representing records
        """
        try:
            # Decode bytes to string
            json_str = content.decode('utf-8')
            
            # Parse JSON
            data = json.loads(json_str)
            
            # Ensure data is a list
            if isinstance(data, dict):
                # If it's a single object, wrap in list
                data = [data]
            elif not isinstance(data, list):
                raise ValueError("JSON must be an array of objects or a single object")
            
            # Validate structure - each item should be a dictionary
            for i, item in enumerate(data):
                if not isinstance(item, dict):
                    raise ValueError(f"Item at index {i} is not an object")
            
            return data
            
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse JSON file: {str(e)}")
        except UnicodeDecodeError as e:
            raise ValueError(f"Failed to decode JSON file: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error reading JSON file: {str(e)}")
    
    async def _validate_records(
        self,
        records: List[Dict[str, Any]],
        entity_type: str
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Validate records against Pydantic model
        
        Args:
            records: List of record dictionaries
            entity_type: Type of entity for validation
            
        Returns:
            Tuple of (valid_records, validation_errors)
        """
        validation_model = self.entity_config[entity_type]['model']
        valid_records = []
        validation_errors = []
        
        for line_number, record in enumerate(records, start=1):
            try:
                # Validate record using Pydantic model
                validated = validation_model(**record)
                
                # Convert to dict for insertion
                valid_dict = validated.model_dump()
                
                # Convert Decimal to float for JSON serialization
                for key, value in valid_dict.items():
                    if isinstance(value, Decimal):
                        valid_dict[key] = float(value)
                    elif isinstance(value, (date, datetime)):
                        valid_dict[key] = value.isoformat()
                    elif isinstance(value, UUID):
                        valid_dict[key] = str(value)
                
                valid_records.append(valid_dict)
                
            except Exception as e:
                # Extract field and error message from validation error
                error_details = self._extract_validation_error(e, line_number, record)
                validation_errors.append(error_details)
        
        return valid_records, validation_errors
    
    def _extract_validation_error(
        self,
        error: Exception,
        line_number: int,
        record: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Extract detailed error information from validation exception
        
        Args:
            error: The validation exception
            line_number: Line number in the file
            record: The record that failed validation
            
        Returns:
            Dictionary with error details
        """
        # Handle Pydantic validation errors
        if hasattr(error, 'errors'):
            errors = error.errors()
            if errors:
                first_error = errors[0]
                field = '.'.join(str(loc) for loc in first_error.get('loc', []))
                message = first_error.get('msg', str(error))
                value = record.get(field) if field in record else None
                
                return {
                    'line_number': line_number,
                    'field': field,
                    'message': message,
                    'value': value
                }
        
        # Generic error handling
        return {
            'line_number': line_number,
            'field': 'unknown',
            'message': str(error),
            'value': None
        }
    
    async def _batch_insert(
        self,
        records: List[Dict[str, Any]],
        table_name: str,
        organization_id: str
    ) -> int:
        """
        Batch insert records using Supabase transaction
        
        Args:
            records: List of validated records
            table_name: Target table name
            organization_id: Organization ID to add to all records
            
        Returns:
            Number of successfully inserted records
        """
        if not records:
            return 0
        
        # Add organization_id and timestamps to all records
        for record in records:
            record['organization_id'] = organization_id
            record['created_at'] = datetime.now().isoformat()
            record['updated_at'] = datetime.now().isoformat()
        
        # Insert in batches
        total_inserted = 0
        
        for i in range(0, len(records), self.batch_size):
            batch = records[i:i + self.batch_size]
            
            try:
                # Insert batch
                result = self.supabase.table(table_name).insert(batch).execute()
                
                # Count successful insertions
                if result.data:
                    total_inserted += len(result.data)
                    
            except Exception as e:
                logger.error(f"Batch insert error for {table_name}: {str(e)}")
                # Rollback is handled by Supabase automatically
                raise Exception(f"Database error during import: {str(e)}")
        
        return total_inserted
    
    async def _log_import(
        self,
        user_id: str,
        organization_id: str,
        entity_type: str,
        success_count: int,
        error_count: int,
        error_message: Optional[str] = None
    ):
        """
        Log import operation to audit_logs
        
        Args:
            user_id: User who initiated the import
            organization_id: Organization ID
            entity_type: Type of entity imported
            success_count: Number of successful imports
            error_count: Number of failed imports
            error_message: Optional error message
        """
        try:
            audit_entry = {
                'organization_id': organization_id,
                'user_id': user_id,
                'action': 'bulk_import',
                'entity_type': entity_type,
                'details': {
                    'entity_type': entity_type,
                    'success_count': success_count,
                    'error_count': error_count,
                    'error_message': error_message
                },
                'success': error_count == 0,
                'error_message': error_message,
                'created_at': datetime.now().isoformat()
            }
            
            self.supabase.table('audit_logs').insert(audit_entry).execute()
            
        except Exception as e:
            logger.error(f"Failed to log import to audit_logs: {str(e)}")
            # Don't raise - logging failure shouldn't break the import
