"""
Bulk operations module for data import/export with progress tracking.
Supports CSV, JSON, and Excel formats with validation and error handling.
"""

import csv
import json
import uuid
import asyncio
from typing import Dict, List, Any, Optional, Union, AsyncGenerator
from datetime import datetime
from io import StringIO, BytesIO
from dataclasses import dataclass
from enum import Enum

import aiofiles
from fastapi import UploadFile, HTTPException
from pydantic import BaseModel, ValidationError

class BulkOperationType(str, Enum):
    IMPORT = "import"
    EXPORT = "export"

class BulkOperationStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class DataFormat(str, Enum):
    CSV = "csv"
    JSON = "json"
    JSONL = "jsonl"
    EXCEL = "xlsx"

@dataclass
class BulkOperationResult:
    operation_id: str
    operation_type: BulkOperationType
    status: BulkOperationStatus
    total_items: int
    processed_items: int
    successful_items: int
    failed_items: int
    errors: List[Dict[str, Any]]
    start_time: datetime
    end_time: Optional[datetime] = None
    metadata: Dict[str, Any] = None

class BulkImportRequest(BaseModel):
    entity_type: str  # "projects", "resources", "risks", etc.
    format: DataFormat = DataFormat.CSV
    validate_only: bool = False
    batch_size: int = 100
    skip_duplicates: bool = True
    update_existing: bool = False
    metadata: Dict[str, Any] = {}

class BulkExportRequest(BaseModel):
    entity_type: str
    format: DataFormat = DataFormat.CSV
    filters: Dict[str, Any] = {}
    include_fields: Optional[List[str]] = None
    exclude_fields: Optional[List[str]] = None
    metadata: Dict[str, Any] = {}

class BulkOperationsService:
    """Service for handling bulk data operations"""
    
    def __init__(self, supabase_client, cache_manager):
        self.supabase = supabase_client
        self.cache_manager = cache_manager
        self.active_operations: Dict[str, BulkOperationResult] = {}
        
        # Entity type mappings
        self.entity_mappings = {
            "projects": {
                "table": "projects",
                "required_fields": ["name", "portfolio_id"],
                "optional_fields": ["description", "status", "priority", "budget", "start_date", "end_date"]
            },
            "resources": {
                "table": "resources", 
                "required_fields": ["name", "email"],
                "optional_fields": ["role", "capacity", "availability", "hourly_rate", "skills", "location"]
            },
            "risks": {
                "table": "risks",
                "required_fields": ["project_id", "title", "category", "probability", "impact"],
                "optional_fields": ["description", "mitigation", "owner_id", "due_date"]
            },
            "issues": {
                "table": "issues",
                "required_fields": ["project_id", "title"],
                "optional_fields": ["description", "severity", "assigned_to", "reporter_id", "due_date"]
            },
            "portfolios": {
                "table": "portfolios",
                "required_fields": ["name", "owner_id"],
                "optional_fields": ["description"]
            }
        }
    
    async def start_bulk_import(self, file: UploadFile, request: BulkImportRequest, user_id: str) -> str:
        """Start a bulk import operation"""
        operation_id = str(uuid.uuid4())
        
        # Validate entity type
        if request.entity_type not in self.entity_mappings:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported entity type: {request.entity_type}"
            )
        
        # Initialize operation tracking
        result = BulkOperationResult(
            operation_id=operation_id,
            operation_type=BulkOperationType.IMPORT,
            status=BulkOperationStatus.PENDING,
            total_items=0,
            processed_items=0,
            successful_items=0,
            failed_items=0,
            errors=[],
            start_time=datetime.now(),
            metadata={
                "entity_type": request.entity_type,
                "format": request.format,
                "user_id": user_id,
                "filename": file.filename,
                "validate_only": request.validate_only,
                **request.metadata
            }
        )
        
        self.active_operations[operation_id] = result
        
        # Cache operation status
        await self.cache_manager.set(f"bulk_op:{operation_id}", result.__dict__, ttl=3600)
        
        # Start processing in background
        asyncio.create_task(self._process_import(file, request, result))
        
        return operation_id
    
    async def start_bulk_export(self, request: BulkExportRequest, user_id: str) -> str:
        """Start a bulk export operation"""
        operation_id = str(uuid.uuid4())
        
        # Validate entity type
        if request.entity_type not in self.entity_mappings:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported entity type: {request.entity_type}"
            )
        
        # Initialize operation tracking
        result = BulkOperationResult(
            operation_id=operation_id,
            operation_type=BulkOperationType.EXPORT,
            status=BulkOperationStatus.PENDING,
            total_items=0,
            processed_items=0,
            successful_items=0,
            failed_items=0,
            errors=[],
            start_time=datetime.now(),
            metadata={
                "entity_type": request.entity_type,
                "format": request.format,
                "user_id": user_id,
                "filters": request.filters,
                **request.metadata
            }
        )
        
        self.active_operations[operation_id] = result
        
        # Cache operation status
        await self.cache_manager.set(f"bulk_op:{operation_id}", result.__dict__, ttl=3600)
        
        # Start processing in background
        asyncio.create_task(self._process_export(request, result))
        
        return operation_id
    
    async def get_operation_status(self, operation_id: str) -> Optional[BulkOperationResult]:
        """Get the status of a bulk operation"""
        # Check active operations first
        if operation_id in self.active_operations:
            return self.active_operations[operation_id]
        
        # Check cache
        cached_data = await self.cache_manager.get(f"bulk_op:{operation_id}")
        if cached_data:
            return BulkOperationResult(**cached_data)
        
        return None
    
    async def cancel_operation(self, operation_id: str) -> bool:
        """Cancel a running bulk operation"""
        if operation_id not in self.active_operations:
            return False
        
        result = self.active_operations[operation_id]
        if result.status in [BulkOperationStatus.COMPLETED, BulkOperationStatus.FAILED]:
            return False
        
        result.status = BulkOperationStatus.CANCELLED
        result.end_time = datetime.now()
        
        # Update cache
        await self.cache_manager.set(f"bulk_op:{operation_id}", result.__dict__, ttl=3600)
        
        return True
    
    async def _process_import(self, file: UploadFile, request: BulkImportRequest, result: BulkOperationResult):
        """Process bulk import operation"""
        try:
            result.status = BulkOperationStatus.RUNNING
            await self._update_operation_cache(result)
            
            # Read and parse file
            content = await file.read()
            
            if request.format == DataFormat.CSV:
                data = await self._parse_csv(content.decode('utf-8'))
            elif request.format == DataFormat.JSON:
                data = json.loads(content.decode('utf-8'))
                if not isinstance(data, list):
                    data = [data]
            elif request.format == DataFormat.JSONL:
                lines = content.decode('utf-8').strip().split('\n')
                data = [json.loads(line) for line in lines if line.strip()]
            else:
                raise ValueError(f"Unsupported format: {request.format}")
            
            result.total_items = len(data)
            await self._update_operation_cache(result)
            
            # Process data in batches
            entity_config = self.entity_mappings[request.entity_type]
            batch_size = min(request.batch_size, 100)  # Max 100 items per batch
            
            for i in range(0, len(data), batch_size):
                if result.status == BulkOperationStatus.CANCELLED:
                    break
                
                batch = data[i:i + batch_size]
                await self._process_import_batch(batch, entity_config, request, result)
                
                result.processed_items = min(i + batch_size, len(data))
                await self._update_operation_cache(result)
                
                # Small delay to prevent overwhelming the database
                await asyncio.sleep(0.1)
            
            result.status = BulkOperationStatus.COMPLETED
            result.end_time = datetime.now()
            
        except Exception as e:
            result.status = BulkOperationStatus.FAILED
            result.end_time = datetime.now()
            result.errors.append({
                "type": "system_error",
                "message": str(e),
                "timestamp": datetime.now().isoformat()
            })
        
        finally:
            await self._update_operation_cache(result)
    
    async def _process_export(self, request: BulkExportRequest, result: BulkOperationResult):
        """Process bulk export operation"""
        try:
            result.status = BulkOperationStatus.RUNNING
            await self._update_operation_cache(result)
            
            entity_config = self.entity_mappings[request.entity_type]
            table_name = entity_config["table"]
            
            # Build query
            query = self.supabase.table(table_name).select("*")
            
            # Apply filters
            for field, value in request.filters.items():
                if isinstance(value, dict):
                    # Handle complex filters like {"gte": 100}
                    for op, val in value.items():
                        if op == "gte":
                            query = query.gte(field, val)
                        elif op == "lte":
                            query = query.lte(field, val)
                        elif op == "eq":
                            query = query.eq(field, val)
                        elif op == "neq":
                            query = query.neq(field, val)
                        elif op == "in":
                            query = query.in_(field, val)
                else:
                    query = query.eq(field, value)
            
            # Execute query
            response = query.execute()
            data = response.data or []
            
            result.total_items = len(data)
            result.processed_items = len(data)
            result.successful_items = len(data)
            
            # Filter fields if specified
            if request.include_fields:
                data = [{k: v for k, v in item.items() if k in request.include_fields} for item in data]
            elif request.exclude_fields:
                data = [{k: v for k, v in item.items() if k not in request.exclude_fields} for item in data]
            
            # Generate export file
            export_data = await self._generate_export_data(data, request.format)
            
            # Store export data in cache with longer TTL
            export_key = f"export:{result.operation_id}"
            await self.cache_manager.set(export_key, export_data, ttl=86400)  # 24 hours
            
            result.status = BulkOperationStatus.COMPLETED
            result.end_time = datetime.now()
            result.metadata["export_key"] = export_key
            
        except Exception as e:
            result.status = BulkOperationStatus.FAILED
            result.end_time = datetime.now()
            result.errors.append({
                "type": "export_error",
                "message": str(e),
                "timestamp": datetime.now().isoformat()
            })
        
        finally:
            await self._update_operation_cache(result)
    
    async def _parse_csv(self, content: str) -> List[Dict[str, Any]]:
        """Parse CSV content into list of dictionaries"""
        reader = csv.DictReader(StringIO(content))
        return [row for row in reader]
    
    async def _process_import_batch(self, batch: List[Dict[str, Any]], entity_config: Dict[str, Any], 
                                  request: BulkImportRequest, result: BulkOperationResult):
        """Process a batch of import data"""
        table_name = entity_config["table"]
        required_fields = entity_config["required_fields"]
        
        for item in batch:
            try:
                # Validate required fields
                missing_fields = [field for field in required_fields if field not in item or not item[field]]
                if missing_fields:
                    result.failed_items += 1
                    result.errors.append({
                        "type": "validation_error",
                        "message": f"Missing required fields: {missing_fields}",
                        "item": item,
                        "timestamp": datetime.now().isoformat()
                    })
                    continue
                
                # Skip validation-only mode
                if request.validate_only:
                    result.successful_items += 1
                    continue
                
                # Check for duplicates if skip_duplicates is enabled
                if request.skip_duplicates:
                    # Simple duplicate check based on name or email
                    duplicate_field = "email" if "email" in item else "name"
                    if duplicate_field in item:
                        existing = self.supabase.table(table_name).select("id").eq(
                            duplicate_field, item[duplicate_field]
                        ).execute()
                        
                        if existing.data:
                            if request.update_existing:
                                # Update existing record
                                update_response = self.supabase.table(table_name).update(item).eq(
                                    "id", existing.data[0]["id"]
                                ).execute()
                                
                                if update_response.data:
                                    result.successful_items += 1
                                else:
                                    result.failed_items += 1
                                    result.errors.append({
                                        "type": "update_error",
                                        "message": "Failed to update existing record",
                                        "item": item,
                                        "timestamp": datetime.now().isoformat()
                                    })
                            else:
                                # Skip duplicate
                                continue
                
                # Insert new record
                insert_response = self.supabase.table(table_name).insert(item).execute()
                
                if insert_response.data:
                    result.successful_items += 1
                else:
                    result.failed_items += 1
                    result.errors.append({
                        "type": "insert_error",
                        "message": "Failed to insert record",
                        "item": item,
                        "timestamp": datetime.now().isoformat()
                    })
                
            except Exception as e:
                result.failed_items += 1
                result.errors.append({
                    "type": "processing_error",
                    "message": str(e),
                    "item": item,
                    "timestamp": datetime.now().isoformat()
                })
    
    async def _generate_export_data(self, data: List[Dict[str, Any]], format: DataFormat) -> str:
        """Generate export data in specified format"""
        if format == DataFormat.CSV:
            if not data:
                return ""
            
            output = StringIO()
            writer = csv.DictWriter(output, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
            return output.getvalue()
        
        elif format == DataFormat.JSON:
            return json.dumps(data, indent=2, default=str)
        
        elif format == DataFormat.JSONL:
            return '\n'.join(json.dumps(item, default=str) for item in data)
        
        else:
            raise ValueError(f"Unsupported export format: {format}")
    
    async def get_export_data(self, operation_id: str) -> Optional[str]:
        """Get exported data for download"""
        result = await self.get_operation_status(operation_id)
        if not result or result.operation_type != BulkOperationType.EXPORT:
            return None
        
        if result.status != BulkOperationStatus.COMPLETED:
            return None
        
        export_key = result.metadata.get("export_key")
        if not export_key:
            return None
        
        return await self.cache_manager.get(export_key)
    
    async def _update_operation_cache(self, result: BulkOperationResult):
        """Update operation status in cache"""
        await self.cache_manager.set(f"bulk_op:{result.operation_id}", result.__dict__, ttl=3600)
    
    def get_supported_entities(self) -> Dict[str, Dict[str, Any]]:
        """Get supported entity types and their configurations"""
        return {
            entity_type: {
                "required_fields": config["required_fields"],
                "optional_fields": config["optional_fields"],
                "total_fields": len(config["required_fields"]) + len(config["optional_fields"])
            }
            for entity_type, config in self.entity_mappings.items()
        }

# Export main components
__all__ = [
    'BulkOperationsService',
    'BulkImportRequest',
    'BulkExportRequest', 
    'BulkOperationResult',
    'BulkOperationType',
    'BulkOperationStatus',
    'DataFormat'
]