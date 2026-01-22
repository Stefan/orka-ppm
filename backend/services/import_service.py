"""
Import Service for Project Import MVP

This service orchestrates the project import process, coordinating validation,
database transactions, and audit logging. It ensures atomic batch imports
where either all projects are imported or none are (all-or-nothing semantics).

Requirements: 1.1, 1.2, 2.3, 3.5, 3.6, 9.2, 9.3
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from uuid import uuid4
import logging

from models.projects import ProjectCreate
from services.validation_service import ValidationService
from services.audit_service import AuditService
from config.database import get_db


@dataclass
class ImportResult:
    """
    Result of an import operation.
    
    Attributes:
        success: Whether the import operation succeeded
        count: Number of projects successfully imported
        errors: List of validation/import errors with details
        message: Human-readable summary message
    """
    success: bool
    count: int
    errors: List[Dict[str, Any]] = field(default_factory=list)
    message: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "success": self.success,
            "count": self.count,
            "errors": self.errors,
            "message": self.message
        }


class ImportService:
    """
    Service for importing projects with validation and audit logging.
    
    This service orchestrates the complete import workflow:
    1. Validate all projects in the batch
    2. Log audit event (start)
    3. Create all projects in a single database transaction
    4. Log audit event (complete)
    5. Return result with success status or detailed errors
    
    The service ensures atomic imports - either all projects are created
    or none are (all-or-nothing semantics per Requirement 3.6, 9.1, 9.5).
    """
    
    def __init__(self, db_session=None, user_id: str = ""):
        """
        Initialize the import service.
        
        Args:
            db_session: Database client (defaults to global Supabase client)
            user_id: ID of the user performing the import
        """
        self.db = db_session or get_db()
        self.user_id = user_id
        self.validator = ValidationService(self.db)
        self.auditor = AuditService(self.db)
        self.logger = logging.getLogger(__name__)
    
    async def import_projects(
        self, 
        projects: List[ProjectCreate],
        import_method: str
    ) -> ImportResult:
        """
        Import multiple projects with validation and audit logging.
        
        Process:
        1. Validate all projects
        2. Log audit event (start)
        3. Create all projects in transaction
        4. Log audit event (complete)
        5. Return result
        
        Args:
            projects: List of project data to import
            import_method: "json" or "csv"
            
        Returns:
            ImportResult with success status, count, and any errors
            
        Requirements: 1.1, 1.2, 2.3, 3.5, 3.6
        """
        # Handle empty batch
        if not projects:
            return ImportResult(
                success=False,
                count=0,
                errors=[],
                message="No projects provided for import"
            )
        
        # Step 1: Validate all projects in the batch
        validation_errors = await self._validate_batch(projects)
        
        # Step 2: Log audit event (start)
        audit_id = await self.auditor.log_import_start(
            user_id=self.user_id,
            import_method=import_method,
            record_count=len(projects)
        )
        
        # If validation failed, reject entire batch (Requirement 3.6)
        if validation_errors:
            error_message = f"Validation failed for {len(validation_errors)} records"
            
            # Log audit completion with failure
            await self.auditor.log_import_complete(
                audit_id=audit_id,
                success=False,
                imported_count=0,
                error_message=error_message
            )
            
            return ImportResult(
                success=False,
                count=0,
                errors=validation_errors,
                message=error_message
            )
        
        # Step 3: Create all projects in a single transaction
        try:
            imported_count = await self._create_projects_transaction(projects)
            
            # Step 4: Log audit completion with success
            await self.auditor.log_import_complete(
                audit_id=audit_id,
                success=True,
                imported_count=imported_count
            )
            
            # Step 5: Return success result
            return ImportResult(
                success=True,
                count=imported_count,
                errors=[],
                message=f"Successfully imported {imported_count} projects"
            )
            
        except Exception as e:
            # Database error - rollback occurred (Requirement 9.3)
            error_message = f"Database error during import: {str(e)}"
            self.logger.error(f"Import failed: {error_message}", exc_info=True)
            
            # Log audit completion with failure
            await self.auditor.log_import_complete(
                audit_id=audit_id,
                success=False,
                imported_count=0,
                error_message=error_message
            )
            
            return ImportResult(
                success=False,
                count=0,
                errors=[{
                    "index": -1,
                    "field": "database",
                    "value": None,
                    "error": "Import rolled back due to database error"
                }],
                message=error_message
            )
    
    async def _validate_batch(
        self, 
        projects: List[ProjectCreate]
    ) -> List[Dict[str, Any]]:
        """
        Validate all projects in batch.
        
        Validates each project against business rules and collects all errors.
        Returns all validation errors (doesn't fail fast) to provide comprehensive
        feedback to the user (Requirement 3.5).
        
        Args:
            projects: List of projects to validate
            
        Returns:
            List of validation errors (empty if all valid)
            Each error contains: index, field, value, error message
        """
        errors: List[Dict[str, Any]] = []
        
        # Track names within the batch to detect duplicates within import
        names_in_batch: Dict[str, int] = {}
        
        for index, project in enumerate(projects):
            # Check for duplicate names within the batch itself
            if project.name in names_in_batch:
                errors.append({
                    "index": index,
                    "field": "name",
                    "value": project.name,
                    "error": f"Duplicate project name '{project.name}' in import batch (first occurrence at index {names_in_batch[project.name]})"
                })
                continue
            
            # Track this name for batch duplicate detection
            names_in_batch[project.name] = index
            
            # Validate project against all business rules
            error = self.validator.validate_project(project, index)
            if error:
                errors.append(error)
        
        return errors
    
    async def _create_projects_transaction(
        self, 
        projects: List[ProjectCreate]
    ) -> int:
        """
        Create all projects in a single database transaction.
        
        Implements atomic batch creation - either all projects are created
        or none are. If any database error occurs, all changes are rolled back
        (Requirement 9.2, 9.3).
        
        Args:
            projects: List of validated projects to create
            
        Returns:
            Count of created projects
            
        Raises:
            Exception: If database operation fails (triggers rollback)
        """
        if not self.db:
            raise Exception("Database client not available")
        
        created_count = 0
        
        try:
            # Prepare all project records for batch insert
            project_records = []
            for project in projects:
                record = {
                    "id": str(uuid4()),
                    "portfolio_id": str(project.portfolio_id),
                    "name": project.name,
                    "description": project.description,
                    "status": project.status.value if hasattr(project.status, 'value') else project.status,
                    "priority": project.priority,
                    "budget": project.budget,
                    "start_date": project.start_date.isoformat() if project.start_date else None,
                    "end_date": project.end_date.isoformat() if project.end_date else None,
                    "manager_id": str(project.manager_id) if project.manager_id else None,
                    "team_members": [str(m) for m in project.team_members] if project.team_members else [],
                    "health": "green",  # Default health indicator for new projects
                    "actual_cost": 0.0  # Default actual cost for new projects
                }
                project_records.append(record)
            
            # Batch insert all projects in a single operation
            # Supabase handles this as a transaction - if any insert fails,
            # the entire batch is rolled back (Requirement 9.2)
            response = self.db.table("projects").insert(project_records).execute()
            
            # Verify all records were created
            if response.data:
                created_count = len(response.data)
                self.logger.info(f"Successfully created {created_count} projects in transaction")
            else:
                raise Exception("No projects were created - empty response from database")
            
            # Verify count matches expected
            if created_count != len(projects):
                raise Exception(
                    f"Project count mismatch: expected {len(projects)}, "
                    f"created {created_count}"
                )
            
            return created_count
            
        except Exception as e:
            # Log the error and re-raise to trigger rollback handling
            self.logger.error(f"Transaction failed: {str(e)}", exc_info=True)
            raise
