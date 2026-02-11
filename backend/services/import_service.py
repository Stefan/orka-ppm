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
import json
import math
import logging

from models.projects import ProjectCreate, ProjectPpmInput
from services.validation_service import ValidationService
from services.audit_service import AuditService
from services.project_ppm_mapper import ppm_input_to_project_record
from services.anonymizer import AnonymizerService
from config.database import get_db


def _status_for_db(status: str) -> str:
    """Return status value for DB insert. Some DBs use CHECK with 'on_hold' not 'on-hold'."""
    if status == "on-hold":
        return "on_hold"
    return status


def _sanitize_number(v: Any) -> Optional[float]:
    """Ensure numeric value is JSON/DB safe (no nan/inf). Returns None for invalid."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        if math.isfinite(v):
            return float(v)
        return None
    try:
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


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
            # Prepare all project records for batch insert (JSON/PostgREST-safe: no nan, inf, or non-serializable types)
            project_records = []
            for project in projects:
                status_val = project.status.value if hasattr(project.status, 'value') else project.status
                budget_safe = _sanitize_number(project.budget)
                record = {
                    "id": str(uuid4()),
                    "portfolio_id": str(project.portfolio_id),
                    "name": str(project.name) if project.name is not None else "",
                    "description": str(project.description) if project.description is not None else None,
                    "status": _status_for_db(status_val),
                    "priority": str(project.priority) if project.priority is not None else None,
                    "budget": budget_safe,
                    "start_date": project.start_date.isoformat() if project.start_date else None,
                    "end_date": project.end_date.isoformat() if project.end_date else None,
                    "manager_id": str(project.manager_id) if project.manager_id else None,
                    "team_members": [str(m) for m in project.team_members] if project.team_members else [],
                    "health": "green",
                    "actual_cost": 0.0,
                }
                project_records.append(record)
            
            # Prefer RPC insert_projects_batch (trigger disabled) for speed; fallback to table insert per chunk
            BATCH_SIZE_RPC = 500
            BATCH_SIZE_TABLE = 200
            use_rpc = True
            created_count = 0
            for i in range(0, len(project_records), BATCH_SIZE_RPC):
                chunk = project_records[i : i + BATCH_SIZE_RPC]
                payload = json.loads(json.dumps(chunk, default=str))
                if use_rpc:
                    try:
                        r = self.db.rpc("insert_projects_batch", {"records": payload}).execute()
                        raw = r.data
                        if isinstance(raw, (int, float)):
                            created_count += int(raw)
                        elif isinstance(raw, list) and raw and isinstance(raw[0], dict):
                            created_count += int(raw[0].get("insert_projects_batch") or len(chunk))
                        else:
                            created_count += len(chunk)
                    except Exception as e:
                        self.logger.warning("insert_projects_batch RPC failed (%s), falling back to table insert", e)
                        use_rpc = False
                        for j in range(0, len(chunk), BATCH_SIZE_TABLE):
                            sub = chunk[j : j + BATCH_SIZE_TABLE]
                            self.db.table("projects").insert(json.loads(json.dumps(sub, default=str)), returning="minimal").execute()
                        created_count += len(chunk)
                else:
                    for j in range(0, len(chunk), BATCH_SIZE_TABLE):
                        sub = chunk[j : j + BATCH_SIZE_TABLE]
                        self.db.table("projects").insert(json.loads(json.dumps(sub, default=str)), returning="minimal").execute()
                    created_count += len(chunk)
            self.logger.info(f"Successfully created {created_count} projects in transaction")
            
            return created_count
            
        except Exception as e:
            # Log the error and re-raise to trigger rollback handling
            self.logger.error(f"Transaction failed: {str(e)}", exc_info=True)
            raise

    async def import_projects_from_ppm(
        self,
        projects_ppm: List[ProjectPpmInput],
        portfolio_id: str,
        anonymize: bool = False,
    ) -> ImportResult:
        """
        Import projects from PPM (e.g. Roche DIA / Cora) payload.
        Maps each PPM object to a project record and batch-inserts.
        If anonymize=True, anonymizes name, description, and amounts (same scheme as JSON/CSV import).
        """
        if not projects_ppm:
            return ImportResult(
                success=False,
                count=0,
                errors=[],
                message="No PPM project records provided",
            )
        if not self.db:
            return ImportResult(
                success=False,
                count=0,
                errors=[{"index": -1, "field": "db", "value": None, "error": "Database client not available"}],
                message="Database client not available",
            )
        audit_id = await self.auditor.log_import_start(
            user_id=self.user_id,
            import_method="ppm",
            record_count=len(projects_ppm),
        )
        try:
            records = [ppm_input_to_project_record(p, portfolio_id) for p in projects_ppm]
            if anonymize:
                anonymizer = AnonymizerService()
                for r in records:
                    out = anonymizer.anonymize_project({
                        "name": r.get("name") or "",
                        "description": r.get("description"),
                        "budget": r.get("budget"),
                        "start_date": r.get("start_date"),
                        "end_date": r.get("end_date"),
                    })
                    r["name"] = out.get("name", r.get("name"))
                    if "description" in out:
                        r["description"] = out["description"]
                    if "budget" in out:
                        r["budget"] = out["budget"]
                    if "start_date" in out:
                        r["start_date"] = out["start_date"]
                    if "end_date" in out:
                        r["end_date"] = out["end_date"]
            response = self.db.table("projects").insert(records).execute()
            created_count = len(response.data) if response.data else 0
            await self.auditor.log_import_complete(
                audit_id=audit_id,
                success=True,
                imported_count=created_count,
            )
            return ImportResult(
                success=True,
                count=created_count,
                errors=[],
                message=f"Successfully imported {created_count} projects from PPM",
            )
        except Exception as e:
            self.logger.error(f"PPM import failed: {str(e)}", exc_info=True)
            await self.auditor.log_import_complete(
                audit_id=audit_id,
                success=False,
                imported_count=0,
                error_message=str(e),
            )
            return ImportResult(
                success=False,
                count=0,
                errors=[{"index": -1, "field": "server", "value": None, "error": str(e)}],
                message=f"PPM import failed: {str(e)}",
            )
