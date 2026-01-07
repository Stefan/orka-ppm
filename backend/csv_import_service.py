"""
CSV Import Service for Commitments and Actuals
Handles CSV file upload, parsing, validation, and data import
"""

import csv
import io
import json
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Any, Optional, Union, Tuple
from uuid import UUID, uuid4
from pydantic import BaseModel, ValidationError, validator
from fastapi import UploadFile, HTTPException
from supabase import Client
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ImportError(BaseModel):
    """Model for import errors"""
    row: int
    column: str
    value: Any
    error: str
    severity: str = "error"  # error, warning

class ImportWarning(BaseModel):
    """Model for import warnings"""
    row: int
    column: str
    value: Any
    message: str

class ImportResult(BaseModel):
    """Model for import operation results"""
    success: bool
    records_processed: int
    records_imported: int
    records_failed: int
    errors: List[ImportError]
    warnings: List[ImportWarning]
    import_id: str

class ColumnMapping(BaseModel):
    """Model for CSV column mapping configuration"""
    csv_column: str
    target_field: str
    data_type: str  # string, number, date, boolean
    required: bool = False
    default_value: Optional[Any] = None
    transform_function: Optional[str] = None  # Name of transformation function

class CommitmentData(BaseModel):
    """Model for commitment data validation"""
    po_number: str
    po_date: Optional[date] = None
    vendor: Optional[str] = None
    vendor_description: Optional[str] = None
    requester: Optional[str] = None
    project: Optional[str] = None
    project_description: Optional[str] = None
    wbs_element: Optional[str] = None
    wbs_description: Optional[str] = None
    cost_center: Optional[str] = None
    cost_center_description: Optional[str] = None
    po_net_amount: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    po_status: Optional[str] = None
    delivery_date: Optional[date] = None
    currency_code: str = "USD"
    custom_fields: Dict[str, Any] = {}

    @validator('po_number')
    def validate_po_number(cls, v):
        if not v or not v.strip():
            raise ValueError('PO number is required')
        return v.strip()

    @validator('po_net_amount', 'tax_amount', 'total_amount', pre=True)
    def validate_amounts(cls, v):
        if v is None or v == '':
            return None
        try:
            return Decimal(str(v))
        except (InvalidOperation, ValueError):
            raise ValueError(f'Invalid amount format: {v}')

class ActualData(BaseModel):
    """Model for actual data validation"""
    fi_doc_no: str
    posting_date: Optional[date] = None
    document_type: Optional[str] = None
    vendor: Optional[str] = None
    vendor_invoice_no: Optional[str] = None
    project_nr: Optional[str] = None
    wbs: Optional[str] = None
    gl_account: Optional[str] = None
    cost_center: Optional[str] = None
    invoice_amount: Optional[Decimal] = None
    currency_code: str = "USD"
    po_no: Optional[str] = None
    custom_fields: Dict[str, Any] = {}

    @validator('fi_doc_no')
    def validate_fi_doc_no(cls, v):
        if not v or not v.strip():
            raise ValueError('FI document number is required')
        return v.strip()

    @validator('invoice_amount', pre=True)
    def validate_invoice_amount(cls, v):
        if v is None or v == '':
            return None
        try:
            return Decimal(str(v))
        except (InvalidOperation, ValueError):
            raise ValueError(f'Invalid amount format: {v}')

class CSVImportService:
    """Service for handling CSV import operations"""
    
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
        
        # Default column mappings for commitments
        self.default_commitment_mapping = {
            'po_number': ColumnMapping(csv_column='PO Number', target_field='po_number', data_type='string', required=True),
            'po_date': ColumnMapping(csv_column='PO Date', target_field='po_date', data_type='date'),
            'vendor': ColumnMapping(csv_column='Vendor', target_field='vendor', data_type='string'),
            'vendor_description': ColumnMapping(csv_column='Vendor Description', target_field='vendor_description', data_type='string'),
            'requester': ColumnMapping(csv_column='Requester', target_field='requester', data_type='string'),
            'project': ColumnMapping(csv_column='Project', target_field='project', data_type='string'),
            'project_description': ColumnMapping(csv_column='Project Description', target_field='project_description', data_type='string'),
            'wbs_element': ColumnMapping(csv_column='WBS Element', target_field='wbs_element', data_type='string'),
            'wbs_description': ColumnMapping(csv_column='WBS Description', target_field='wbs_description', data_type='string'),
            'cost_center': ColumnMapping(csv_column='Cost Center', target_field='cost_center', data_type='string'),
            'cost_center_description': ColumnMapping(csv_column='Cost Center Description', target_field='cost_center_description', data_type='string'),
            'po_net_amount': ColumnMapping(csv_column='PO Net Amount', target_field='po_net_amount', data_type='number'),
            'tax_amount': ColumnMapping(csv_column='Tax Amount', target_field='tax_amount', data_type='number'),
            'total_amount': ColumnMapping(csv_column='Total Amount', target_field='total_amount', data_type='number'),
            'po_status': ColumnMapping(csv_column='PO Status', target_field='po_status', data_type='string'),
            'delivery_date': ColumnMapping(csv_column='Delivery Date', target_field='delivery_date', data_type='date'),
            'currency_code': ColumnMapping(csv_column='Currency', target_field='currency_code', data_type='string', default_value='USD'),
        }
        
        # Default column mappings for actuals
        self.default_actual_mapping = {
            'fi_doc_no': ColumnMapping(csv_column='FI Doc No', target_field='fi_doc_no', data_type='string', required=True),
            'posting_date': ColumnMapping(csv_column='Posting Date', target_field='posting_date', data_type='date'),
            'document_type': ColumnMapping(csv_column='Document Type', target_field='document_type', data_type='string'),
            'vendor': ColumnMapping(csv_column='Vendor', target_field='vendor', data_type='string'),
            'vendor_invoice_no': ColumnMapping(csv_column='Vendor Invoice No', target_field='vendor_invoice_no', data_type='string'),
            'project_nr': ColumnMapping(csv_column='Project Nr', target_field='project_nr', data_type='string'),
            'wbs': ColumnMapping(csv_column='WBS', target_field='wbs', data_type='string'),
            'gl_account': ColumnMapping(csv_column='GL Account', target_field='gl_account', data_type='string'),
            'cost_center': ColumnMapping(csv_column='Cost Center', target_field='cost_center', data_type='string'),
            'invoice_amount': ColumnMapping(csv_column='Invoice Amount', target_field='invoice_amount', data_type='number'),
            'currency_code': ColumnMapping(csv_column='Currency', target_field='currency_code', data_type='string', default_value='USD'),
            'po_no': ColumnMapping(csv_column='PO No', target_field='po_no', data_type='string'),
        }

    async def upload_csv(self, file: UploadFile, import_type: str, user_id: str, organization_id: str, 
                        column_mapping: Optional[Dict[str, ColumnMapping]] = None) -> ImportResult:
        """
        Upload and process a CSV file
        
        Args:
            file: The uploaded CSV file
            import_type: 'commitments' or 'actuals'
            user_id: ID of the user performing the import
            organization_id: Organization ID for multi-tenant support
            column_mapping: Custom column mapping (optional)
            
        Returns:
            ImportResult with processing details
        """
        
        # Validate file type
        if not file.filename.lower().endswith('.csv'):
            raise HTTPException(status_code=400, detail="File must be a CSV file")
        
        # Validate import type
        if import_type not in ['commitments', 'actuals']:
            raise HTTPException(status_code=400, detail="Import type must be 'commitments' or 'actuals'")
        
        # Generate import ID
        import_id = str(uuid4())
        
        # Create import log entry
        import_log = {
            'id': import_id,
            'import_type': import_type,
            'file_name': file.filename,
            'file_size': file.size if hasattr(file, 'size') else None,
            'imported_by': user_id,
            'organization_id': organization_id,
            'import_status': 'processing',
            'column_mapping': column_mapping.dict() if column_mapping else {},
            'started_at': datetime.now().isoformat()
        }
        
        try:
            # Insert import log
            self.supabase.table('csv_import_logs').insert(import_log).execute()
            
            # Read and parse CSV file
            content = await file.read()
            csv_content = content.decode('utf-8')
            
            # Parse CSV data
            parsed_data = self._parse_csv(csv_content, import_type, column_mapping)
            
            # Validate data
            validation_result = self._validate_data(parsed_data, import_type)
            
            # Import valid records
            import_result = await self._import_data(
                validation_result['valid_records'], 
                import_type, 
                organization_id, 
                file.filename
            )
            
            # Combine validation errors with import errors
            all_errors = validation_result['errors'] + import_result.get('errors', [])
            all_warnings = validation_result['warnings'] + import_result.get('warnings', [])
            
            # Update import log
            final_status = 'completed' if import_result['success'] else 'failed'
            update_data = {
                'import_status': final_status,
                'records_processed': len(parsed_data),
                'records_imported': import_result['records_imported'],
                'records_failed': len(all_errors),
                'error_details': {'errors': [e.dict() for e in all_errors], 'warnings': [w.dict() for w in all_warnings]},
                'completed_at': datetime.now().isoformat()
            }
            
            self.supabase.table('csv_import_logs').update(update_data).eq('id', import_id).execute()
            
            return ImportResult(
                success=import_result['success'],
                records_processed=len(parsed_data),
                records_imported=import_result['records_imported'],
                records_failed=len(all_errors),
                errors=all_errors,
                warnings=all_warnings,
                import_id=import_id
            )
            
        except Exception as e:
            logger.error(f"CSV import failed: {str(e)}")
            
            # Update import log with error
            error_data = {
                'import_status': 'failed',
                'error_details': {'error': str(e)},
                'completed_at': datetime.now().isoformat()
            }
            
            try:
                self.supabase.table('csv_import_logs').update(error_data).eq('id', import_id).execute()
            except:
                pass  # Don't fail if we can't update the log
            
            raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

    def _parse_csv(self, csv_content: str, import_type: str, 
                   column_mapping: Optional[Dict[str, ColumnMapping]] = None) -> List[Dict[str, Any]]:
        """Parse CSV content into structured data"""
        
        # Use default mapping if none provided
        if column_mapping is None:
            column_mapping = (self.default_commitment_mapping if import_type == 'commitments' 
                            else self.default_actual_mapping)
        
        # Parse CSV
        csv_reader = csv.DictReader(io.StringIO(csv_content))
        parsed_data = []
        
        for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 to account for header
            parsed_row = {'_row_number': row_num}
            
            # Map CSV columns to target fields
            for target_field, mapping in column_mapping.items():
                csv_value = row.get(mapping.csv_column, '')
                
                # Apply transformations
                transformed_value = self._transform_value(
                    csv_value, 
                    mapping.data_type, 
                    mapping.default_value
                )
                
                parsed_row[target_field] = transformed_value
            
            # Store any unmapped columns as custom fields
            custom_fields = {}
            mapped_columns = {mapping.csv_column for mapping in column_mapping.values()}
            for csv_col, value in row.items():
                if csv_col not in mapped_columns and value:
                    custom_fields[csv_col] = value
            
            if custom_fields:
                parsed_row['custom_fields'] = custom_fields
            
            parsed_data.append(parsed_row)
        
        return parsed_data

    def _transform_value(self, value: str, data_type: str, default_value: Any = None) -> Any:
        """Transform CSV string value to appropriate data type"""
        
        # Handle empty values
        if not value or value.strip() == '':
            return default_value
        
        value = value.strip()
        
        try:
            if data_type == 'string':
                return value
            elif data_type == 'number':
                # Handle various number formats
                cleaned_value = value.replace(',', '').replace('$', '').replace('€', '').replace('£', '')
                return float(cleaned_value) if '.' in cleaned_value else int(cleaned_value)
            elif data_type == 'date':
                # Try multiple date formats
                for date_format in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d']:
                    try:
                        return datetime.strptime(value, date_format).date()
                    except ValueError:
                        continue
                raise ValueError(f"Unable to parse date: {value}")
            elif data_type == 'boolean':
                return value.lower() in ['true', '1', 'yes', 'y', 'on']
            else:
                return value
                
        except (ValueError, TypeError) as e:
            logger.warning(f"Failed to transform value '{value}' to {data_type}: {e}")
            return default_value

    def _validate_data(self, parsed_data: List[Dict[str, Any]], import_type: str) -> Dict[str, Any]:
        """Validate parsed data against Pydantic models"""
        
        valid_records = []
        errors = []
        warnings = []
        
        model_class = CommitmentData if import_type == 'commitments' else ActualData
        
        for row_data in parsed_data:
            row_num = row_data.pop('_row_number', 0)
            
            try:
                # Validate using Pydantic model
                validated_record = model_class(**row_data)
                valid_records.append(validated_record.dict())
                
            except ValidationError as e:
                # Convert Pydantic validation errors to ImportError objects
                for error in e.errors():
                    field = error['loc'][0] if error['loc'] else 'unknown'
                    errors.append(ImportError(
                        row=row_num,
                        column=field,
                        value=row_data.get(field, ''),
                        error=error['msg'],
                        severity='error'
                    ))
            except Exception as e:
                errors.append(ImportError(
                    row=row_num,
                    column='general',
                    value='',
                    error=str(e),
                    severity='error'
                ))
        
        return {
            'valid_records': valid_records,
            'errors': errors,
            'warnings': warnings
        }

    async def _import_data(self, valid_records: List[Dict[str, Any]], import_type: str, 
                          organization_id: str, source_file: str) -> Dict[str, Any]:
        """Import validated data into the database"""
        
        imported_count = 0
        errors = []
        warnings = []
        
        try:
            for record in valid_records:
                # Add metadata
                record['organization_id'] = organization_id
                record['source_file'] = source_file
                record['imported_at'] = datetime.now().isoformat()
                
                try:
                    if import_type == 'commitments':
                        # Use upsert function for commitments
                        result = self.supabase.rpc('upsert_commitment', record).execute()
                    else:
                        # Use upsert function for actuals
                        result = self.supabase.rpc('upsert_actual', record).execute()
                    
                    imported_count += 1
                    
                except Exception as e:
                    logger.error(f"Failed to import record: {e}")
                    errors.append(ImportError(
                        row=0,  # We don't have row number at this point
                        column='database',
                        value=str(record),
                        error=str(e),
                        severity='error'
                    ))
            
            return {
                'success': len(errors) == 0,
                'records_imported': imported_count,
                'errors': errors,
                'warnings': warnings
            }
            
        except Exception as e:
            logger.error(f"Batch import failed: {e}")
            return {
                'success': False,
                'records_imported': imported_count,
                'errors': [ImportError(
                    row=0,
                    column='database',
                    value='',
                    error=f"Batch import failed: {str(e)}",
                    severity='error'
                )],
                'warnings': warnings
            }

    async def get_import_history(self, user_id: str, organization_id: str, 
                               limit: int = 50) -> List[Dict[str, Any]]:
        """Get import history for a user/organization"""
        
        try:
            result = self.supabase.table('csv_import_logs')\
                .select('*')\
                .eq('organization_id', organization_id)\
                .order('started_at', desc=True)\
                .limit(limit)\
                .execute()
            
            return result.data
            
        except Exception as e:
            logger.error(f"Failed to get import history: {e}")
            raise HTTPException(status_code=500, detail="Failed to retrieve import history")

    async def get_column_mapping_suggestions(self, file: UploadFile, import_type: str) -> Dict[str, List[str]]:
        """Analyze CSV headers and suggest column mappings"""
        
        try:
            # Read first few lines to get headers
            content = await file.read()
            csv_content = content.decode('utf-8')
            
            # Reset file pointer
            await file.seek(0)
            
            # Get CSV headers
            csv_reader = csv.reader(io.StringIO(csv_content))
            headers = next(csv_reader)
            
            # Get default mappings
            default_mapping = (self.default_commitment_mapping if import_type == 'commitments' 
                             else self.default_actual_mapping)
            
            suggestions = {}
            for target_field, mapping in default_mapping.items():
                # Find potential matches in CSV headers
                potential_matches = []
                for header in headers:
                    if self._is_potential_match(header, mapping.csv_column, target_field):
                        potential_matches.append(header)
                
                suggestions[target_field] = potential_matches
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Failed to analyze CSV headers: {e}")
            raise HTTPException(status_code=500, detail="Failed to analyze CSV file")

    def _is_potential_match(self, csv_header: str, expected_header: str, target_field: str) -> bool:
        """Check if a CSV header is a potential match for a target field"""
        
        csv_lower = csv_header.lower().replace('_', ' ').replace('-', ' ')
        expected_lower = expected_header.lower().replace('_', ' ').replace('-', ' ')
        target_lower = target_field.lower().replace('_', ' ').replace('-', ' ')
        
        # Exact match
        if csv_lower == expected_lower:
            return True
        
        # Contains expected header
        if expected_lower in csv_lower or csv_lower in expected_lower:
            return True
        
        # Contains target field name
        if target_lower in csv_lower or csv_lower in target_lower:
            return True
        
        # Common variations
        variations = {
            'po number': ['purchase order', 'po no', 'po#'],
            'fi doc no': ['document number', 'doc no', 'fi document'],
            'vendor': ['supplier', 'vendor name'],
            'amount': ['value', 'cost', 'price'],
            'currency': ['curr', 'currency code'],
            'date': ['dt', 'date'],
        }
        
        for key, variants in variations.items():
            if key in target_lower:
                for variant in variants:
                    if variant in csv_lower:
                        return True
        
        return False