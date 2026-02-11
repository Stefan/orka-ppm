"""
Project Import Router for Project Import MVP

This router provides REST API endpoints for importing projects via JSON arrays
and CSV file uploads. It integrates with ImportService for business logic,
CSVParser for file parsing, and enforces authentication and authorization.

Requirements: 1.3, 1.4, 1.5, 2.4, 2.5, 4.1, 4.2, 4.3, 4.4, 4.5
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query, status
from typing import List, Dict, Any, Optional
from uuid import UUID, uuid4
from datetime import datetime
import logging

from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission
from models.projects import ProjectCreate, ProjectPpmInput
from services.import_service import ImportService, ImportResult
from services.csv_parser import CSVParser, CSVParseError
from services.anonymizer import AnonymizerService
from config.database import get_db, service_supabase
from services.data_import_audit import log_data_import_to_audit_trail, trim_import_history

router = APIRouter(prefix="/api/projects", tags=["import"])
logger = logging.getLogger(__name__)

# Max CSV upload size (same as csv_import router for commitments/actuals)
MAX_CSV_UPLOAD_BYTES = 80 * 1024 * 1024  # 80 MB


def _log_project_import_to_history(
    user_id: str,
    result: ImportResult,
    total_records: int,
) -> None:
    """Write a project import to import_audit_logs so it appears in Data Import history."""
    if not service_supabase or not user_id:
        return
    try:
        now = datetime.utcnow().isoformat()
        # Ensure errors are JSONB-safe (list of dicts with str keys)
        errors_safe = None
        if result.errors:
            errors_safe = []
            for e in result.errors:
                if isinstance(e, dict):
                    errors_safe.append({k: (v if isinstance(v, (str, int, float, bool, type(None))) else str(v)) for k, v in e.items()})
                else:
                    errors_safe.append({"error": str(e)})
        row = {
            "import_id": str(uuid4()),
            "user_id": str(user_id),
            "import_type": "projects",
            "total_records": total_records,
            "success_count": result.count,
            "duplicate_count": 0,
            "error_count": len(result.errors) if result.errors else 0,
            "status": "completed" if result.success else "failed",
            "errors": errors_safe,
            "created_at": now,
            "completed_at": now,
        }
        service_supabase.table("import_audit_logs").insert(row, returning="minimal").execute()
        trim_import_history(user_id, service_supabase)
    except Exception as e:
        logger.warning("Failed to log project import to history: %s", e)


def _create_error_response(
    message: str,
    errors: List[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Create a standardized error response format.
    
    Ensures all error responses follow the structure:
    {success: false, count: 0, errors: [...], message: "..."}
    
    Validates: Requirement 7.6 (Error response format consistency)
    """
    return {
        "success": False,
        "count": 0,
        "errors": errors or [],
        "message": message
    }


def _make_names_unique_in_batch(projects: List[ProjectCreate]) -> List[ProjectCreate]:
    """
    Ensure project names are unique within the batch by appending " (2)", " (3)", etc.
    to duplicates. Keeps the first occurrence unchanged. Used after anonymization when
    multiple source projects can get the same deterministic name (e.g. P7552).
    """
    if not projects:
        return projects
    name_count: Dict[str, int] = {}
    result: List[ProjectCreate] = []
    for p in projects:
        name_count[p.name] = name_count.get(p.name, 0) + 1
        k = name_count[p.name]
        new_name = p.name if k == 1 else f"{p.name} ({k})"
        new_p = p.model_copy(update={"name": new_name}) if new_name != p.name else p
        result.append(new_p)
    return result


def _clear_projects_before_import(db) -> int:
    """Delete all rows from the projects table. Tries RPC first (server-side batches), then client-side chunks."""
    # Prefer RPC so clearing runs server-side in small batches; one round trip, no large response.
    try:
        r = db.rpc("clear_projects_for_import").execute()
        if r.data and len(r.data) > 0:
            row = r.data[0]
            if isinstance(row, dict):
                val = row.get("clear_projects_for_import") or next(iter(row.values()), 0)
            else:
                val = row
            return int(val) if val is not None else 0
        return 0
    except Exception as e:
        logger.warning(
            "clear_projects_for_import RPC failed (run migration 067 to enable server-side clear): %s",
            e,
        )
    # Fallback: client-side chunked delete (can timeout or hit response size limits with many rows)
    total_deleted = 0
    select_chunk = 50
    delete_batch = 10
    while True:
        r = db.table("projects").select("id").limit(select_chunk).execute()
        ids = [row["id"] for row in (r.data or []) if row.get("id") is not None]
        if not ids:
            break
        for i in range(0, len(ids), delete_batch):
            batch = ids[i : i + delete_batch]
            db.table("projects").delete().in_("id", batch).execute()
            total_deleted += len(batch)
    return total_deleted


@router.post("/import", status_code=status.HTTP_200_OK)
async def import_projects_json(
    projects: List[ProjectCreate],
    anonymize: bool = Query(True, description="Daten anonymisieren (Vendor, Projekt, Beträge, etc.) / Anonymize names, descriptions, budgets"),
    clear_before_import: bool = Query(False, description="Zieltabelle vor Import leeren (bestehende Daten löschen) / Clear target table before import"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    _: Dict[str, Any] = Depends(require_permission(Permission.data_import))
) -> Dict[str, Any]:
    """
    Import multiple projects from JSON array.
    
    This endpoint accepts a JSON array of project data and imports all projects
    into the database. The import is atomic - either all projects are created
    or none are (if any validation fails). When anonymize=True (default), project
    names are replaced with deterministic Pxxxx (same scheme as commitments/actuals
    so they link correctly), descriptions and budgets are obfuscated.
    
    **Authentication**: Requires valid JWT token (Requirement 4.1, 4.2)
    **Authorization**: Requires `data_import` permission (Requirement 4.3, 4.4, 4.5)
    
    Args:
        projects: List of project data to import
        current_user: Authenticated user from JWT
        
    Returns:
        ImportResult with success status and count:
        - success: true/false
        - count: number of projects imported
        - errors: list of validation errors (if any)
        - message: human-readable summary
        
    Raises:
        HTTPException 400: Validation errors in project data
        HTTPException 401: Missing or invalid JWT token (handled by get_current_user)
        HTTPException 403: User lacks data_import permission (handled by require_permission)
        HTTPException 500: Internal server error
        
    Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3, 4.4, 4.5
    """
    try:
        # Optionally anonymize projects (same Pxxxx scheme as commitments/actuals for linking)
        if anonymize and projects:
            anonymizer = AnonymizerService()
            def _to_dict(p: ProjectCreate) -> Dict[str, Any]:
                return p.model_dump() if hasattr(p, "model_dump") else p.dict()
            projects = [ProjectCreate(**anonymizer.anonymize_project(_to_dict(p))) for p in projects]
            # Ensure names are unique within batch (anonymizer can produce same name for different sources)
            projects = _make_names_unique_in_batch(projects)
        
        # Extract user ID for audit logging
        user_id = current_user.get("user_id", "")
        
        # Use service role client so inserts bypass RLS (user already authorized via data_import permission)
        db = service_supabase or get_db()
        if not db:
            logger.error("Database client not available")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=_create_error_response("Database service unavailable")
            )
        
        if clear_before_import:
            try:
                _clear_projects_before_import(db)
            except Exception as clear_err:
                err_str = str(clear_err)
                if "statement timeout" in err_str.lower() or "57014" in err_str:
                    raise HTTPException(
                        status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                        detail=_create_error_response(
                            message="Clearing the table timed out. Run migration 067_clear_projects_for_import_rpc.sql so clearing runs server-side, or use 'Clear before import' off and import, or clear via script: backend/scripts/clear_projects_actuals_commitments.py",
                            errors=[{"index": -1, "field": "server", "value": None, "error": "Statement timeout during clear"}],
                        ),
                    ) from clear_err
                raise
        
        # Initialize import service with user context
        import_service = ImportService(db_session=db, user_id=user_id)
        # Process the import
        result: ImportResult = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        # Log to import_audit_logs so it appears in Data Import history
        _log_project_import_to_history(user_id, result, total_records=len(projects))
        # Also write to central audit trail (audit_logs)
        tenant_id = current_user.get("organization_id") or current_user.get("tenant_id")
        log_data_import_to_audit_trail(
            user_id=user_id,
            import_type="projects",
            success=result.success,
            total_records=len(projects),
            success_count=result.count,
            error_count=len(result.errors) if result.errors else 0,
            duplicate_count=0,
            tenant_id=tenant_id,
        )
        
        # Return appropriate response based on result
        if result.success:
            return result.to_dict()
        else:
            # Validation failed - return 400 with error details
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.to_dict()
            )
            
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Log unexpected errors and return 500
        logger.error(f"Unexpected error during JSON import: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_create_error_response(
                message="An unexpected error occurred during import",
                errors=[{
                    "index": -1,
                    "field": "server",
                    "value": None,
                    "error": str(e)
                }]
            )
        )


@router.post("/import/ppm", status_code=status.HTTP_200_OK)
async def import_projects_ppm(
    body: List[ProjectPpmInput],
    portfolio_id: str = Query(..., description="Portfolio ID to assign to all imported projects"),
    anonymize: bool = Query(True, description="Daten anonymisieren (Vendor, Projekt, Beträge, etc.) / Anonymize names, descriptions, amounts"),
    clear_before_import: bool = Query(False, description="Zieltabelle vor Import leeren (bestehende Daten löschen) / Clear target table before import"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    _: Dict[str, Any] = Depends(require_permission(Permission.data_import)),
) -> Dict[str, Any]:
    """
    Import projects from PPM payload (e.g. Roche DIA / Cora).
    Expects a JSON array of project objects with id, orderIds, description, startDate, finishDate, etc.
    Name is derived from orderIds[0], description, or id. All PPM fields are stored.
    Supports anonymize (names, descriptions, amounts) and clear_before_import (delete existing projects).
    """
    if not portfolio_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=_create_error_response(
                message="portfolio_id query parameter is required for PPM import",
                errors=[{"index": -1, "field": "portfolio_id", "value": None, "error": "Missing required parameter"}],
            ),
        )
    try:
        UUID(portfolio_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=_create_error_response(
                message="Invalid portfolio_id format",
                errors=[{"index": -1, "field": "portfolio_id", "value": portfolio_id, "error": "Must be a valid UUID"}],
            ),
        )
    if not body:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_create_error_response(
                message="Request body must be a non-empty array of PPM project objects",
                errors=[{"index": -1, "field": "body", "value": None, "error": "Empty array"}],
            ),
        )
    db = service_supabase or get_db()
    if not db:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_create_error_response("Database service unavailable"),
        )
    if clear_before_import:
        try:
            _clear_projects_before_import(db)
        except Exception as clear_err:
            err_str = str(clear_err)
            if "statement timeout" in err_str.lower() or "57014" in err_str:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail=_create_error_response(
                        message="Clearing the table timed out. Run migration 067_clear_projects_for_import_rpc.sql, or use 'Clear before import' off, or clear via script: backend/scripts/clear_projects_actuals_commitments.py",
                        errors=[{"index": -1, "field": "server", "value": None, "error": "Statement timeout during clear"}],
                    ),
                ) from clear_err
            raise
    user_id = current_user.get("user_id", "")
    import_service = ImportService(db_session=db, user_id=user_id)
    result = await import_service.import_projects_from_ppm(
        projects_ppm=body, portfolio_id=portfolio_id, anonymize=anonymize
    )
    _log_project_import_to_history(user_id, result, total_records=len(body))
    tenant_id = current_user.get("organization_id") or current_user.get("tenant_id")
    log_data_import_to_audit_trail(
        user_id=user_id,
        import_type="projects",
        success=result.success,
        total_records=len(body),
        success_count=result.count,
        error_count=len(result.errors) if result.errors else 0,
        duplicate_count=0,
        tenant_id=tenant_id,
    )
    if result.success:
        return result.to_dict()
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result.to_dict())


@router.post("/import/csv", status_code=status.HTTP_200_OK)
async def import_projects_csv(
    file: UploadFile = File(..., description="CSV file containing project data"),
    portfolio_id: str = None,
    anonymize: bool = Query(True, description="Daten anonymisieren (Vendor, Projekt, Beträge, etc.) / Anonymize names, descriptions, budgets"),
    clear_before_import: bool = Query(False, description="Zieltabelle vor Import leeren (bestehende Daten löschen) / Clear target table before import"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    _: Dict[str, Any] = Depends(require_permission(Permission.data_import))
) -> Dict[str, Any]:
    """
    Import multiple projects from CSV file.
    
    This endpoint accepts a CSV file upload containing project data and imports
    all projects into the database. The CSV must have a header row with column
    names matching the expected fields (name, budget, status, etc.).
    Max file size: 80 MB (same as commitments/actuals CSV import).
    
    **Authentication**: Requires valid JWT token (Requirement 4.1, 4.2)
    **Authorization**: Requires `data_import` permission (Requirement 4.3, 4.4, 4.5)
    
    **CSV Format Requirements**:
    - Header row with column names: name, budget, status (required)
    - Optional columns: start_date, end_date, description, priority, manager_id
    - Supports comma and semicolon delimiters
    - Supports quoted fields with embedded commas/newlines
    
    Args:
        file: CSV file upload
        portfolio_id: Portfolio ID to assign to imported projects (query param)
        current_user: Authenticated user from JWT
        
    Returns:
        ImportResult with success status and count:
        - success: true/false
        - count: number of projects imported
        - errors: list of validation/parsing errors (if any)
        - message: human-readable summary
        
    Raises:
        HTTPException 400: CSV parsing errors or validation errors
        HTTPException 401: Missing or invalid JWT token (handled by get_current_user)
        HTTPException 403: User lacks data_import permission (handled by require_permission)
        HTTPException 422: Invalid file format or missing portfolio_id
        HTTPException 500: Internal server error
        
    Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 4.3, 4.4, 4.5, 10.1-10.5
    """
    try:
        # Validate portfolio_id is provided
        if not portfolio_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=_create_error_response(
                    message="portfolio_id query parameter is required for CSV imports",
                    errors=[{
                        "index": -1,
                        "field": "portfolio_id",
                        "value": None,
                        "error": "Missing required parameter: portfolio_id"
                    }]
                )
            )
        
        # Validate portfolio_id is a valid UUID
        try:
            portfolio_uuid = UUID(portfolio_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=_create_error_response(
                    message="Invalid portfolio_id format",
                    errors=[{
                        "index": -1,
                        "field": "portfolio_id",
                        "value": portfolio_id,
                        "error": "portfolio_id must be a valid UUID"
                    }]
                )
            )
        
        # Validate file type
        if file.filename:
            filename_lower = file.filename.lower()
            if not filename_lower.endswith('.csv'):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=_create_error_response(
                        message="Invalid file format. Only CSV files are accepted.",
                        errors=[{
                            "index": -1,
                            "field": "file",
                            "value": file.filename,
                            "error": "File must have .csv extension"
                        }]
                    )
                )
        
        # Read file content
        file_content = await file.read()
        if len(file_content) > MAX_CSV_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=_create_error_response(
                    message=f"File too large. Maximum size is {MAX_CSV_UPLOAD_BYTES // (1024*1024)} MB. Split the file or use multiple uploads.",
                    errors=[{
                        "index": -1,
                        "field": "file",
                        "value": file.filename,
                        "error": "File exceeds maximum allowed size"
                    }]
                )
            )
        
        # Validate file is not empty
        if not file_content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=_create_error_response(
                    message="CSV file is empty",
                    errors=[{
                        "index": -1,
                        "field": "file",
                        "value": file.filename,
                        "error": "Uploaded file contains no data"
                    }]
                )
            )
        
        # Parse CSV file
        csv_parser = CSVParser()
        try:
            projects = csv_parser.parse_csv(
                file_content=file_content,
                portfolio_id=portfolio_uuid
            )
        except CSVParseError as e:
            # Return CSV parsing error with details (Requirement 2.5)
            logger.warning(f"CSV parsing failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=_create_error_response(
                    message=f"CSV parsing failed: {str(e)}",
                    errors=[{
                        "index": -1,
                        "field": "csv",
                        "value": file.filename,
                        "error": str(e)
                    }]
                )
            )
        
        # Check if any projects were parsed
        if not projects:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=_create_error_response(
                    message="No valid project records found in CSV file",
                    errors=[{
                        "index": -1,
                        "field": "csv",
                        "value": file.filename,
                        "error": "CSV file contains no valid project records"
                    }]
                )
            )
        
        # Optionally anonymize (same Pxxxx scheme as commitments/actuals for linking)
        if anonymize:
            anonymizer = AnonymizerService()
            def _to_dict(p: ProjectCreate) -> Dict[str, Any]:
                return p.model_dump() if hasattr(p, "model_dump") else p.dict()
            projects = [ProjectCreate(**anonymizer.anonymize_project(_to_dict(p))) for p in projects]
            projects = _make_names_unique_in_batch(projects)
        
        # Extract user ID for audit logging
        user_id = current_user.get("user_id", "")
        
        # Use service role client so inserts bypass RLS (user already authorized via data_import permission)
        db = service_supabase or get_db()
        if not db:
            logger.error("Database client not available")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=_create_error_response("Database service unavailable")
            )
        
        if clear_before_import:
            try:
                _clear_projects_before_import(db)
            except Exception as clear_err:
                err_str = str(clear_err)
                if "statement timeout" in err_str.lower() or "57014" in err_str:
                    raise HTTPException(
                        status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                        detail=_create_error_response(
                            message="Clearing the table timed out. Run migration 067_clear_projects_for_import_rpc.sql, or use 'Clear before import' off, or clear via script: backend/scripts/clear_projects_actuals_commitments.py",
                            errors=[{"index": -1, "field": "server", "value": None, "error": "Statement timeout during clear"}],
                        ),
                    ) from clear_err
                raise
        
        # Initialize import service with user context
        import_service = ImportService(db_session=db, user_id=user_id)
        
        # Process the import
        result: ImportResult = await import_service.import_projects(
            projects=projects,
            import_method="csv"
        )
        
        # Log to import_audit_logs so it appears in Data Import history
        _log_project_import_to_history(user_id, result, total_records=len(projects))
        # Also write to central audit trail (audit_logs)
        tenant_id = current_user.get("organization_id") or current_user.get("tenant_id")
        log_data_import_to_audit_trail(
            user_id=user_id,
            import_type="projects",
            success=result.success,
            total_records=len(projects),
            success_count=result.count,
            error_count=len(result.errors) if result.errors else 0,
            duplicate_count=0,
            tenant_id=tenant_id,
        )
        
        # Return appropriate response based on result
        if result.success:
            return result.to_dict()
        else:
            # Validation failed - return 400 with error details
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.to_dict()
            )
            
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Log unexpected errors and return 500
        logger.error(f"Unexpected error during CSV import: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_create_error_response(
                message="An unexpected error occurred during CSV import",
                errors=[{
                    "index": -1,
                    "field": "server",
                    "value": None,
                    "error": str(e)
                }]
            )
        )
