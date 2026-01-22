"""
Project Import Router for Project Import MVP

This router provides REST API endpoints for importing projects via JSON arrays
and CSV file uploads. It integrates with ImportService for business logic,
CSVParser for file parsing, and enforces authentication and authorization.

Requirements: 1.3, 1.4, 1.5, 2.4, 2.5, 4.1, 4.2, 4.3, 4.4, 4.5
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, status
from typing import List, Dict, Any
from uuid import UUID
import logging

from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission
from models.projects import ProjectCreate
from services.import_service import ImportService, ImportResult
from services.csv_parser import CSVParser, CSVParseError
from config.database import get_db

router = APIRouter(prefix="/api/projects", tags=["import"])
logger = logging.getLogger(__name__)


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


@router.post("/import", status_code=status.HTTP_200_OK)
async def import_projects_json(
    projects: List[ProjectCreate],
    current_user: Dict[str, Any] = Depends(get_current_user),
    _: Dict[str, Any] = Depends(require_permission(Permission.data_import))
) -> Dict[str, Any]:
    """
    Import multiple projects from JSON array.
    
    This endpoint accepts a JSON array of project data and imports all projects
    into the database. The import is atomic - either all projects are created
    or none are (if any validation fails).
    
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
        # Extract user ID for audit logging
        user_id = current_user.get("user_id", "")
        
        # Get database client
        db = get_db()
        if not db:
            logger.error("Database client not available")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=_create_error_response("Database service unavailable")
            )
        
        # Initialize import service with user context
        import_service = ImportService(db_session=db, user_id=user_id)
        
        # Process the import
        result: ImportResult = await import_service.import_projects(
            projects=projects,
            import_method="json"
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


@router.post("/import/csv", status_code=status.HTTP_200_OK)
async def import_projects_csv(
    file: UploadFile = File(..., description="CSV file containing project data"),
    portfolio_id: str = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
    _: Dict[str, Any] = Depends(require_permission(Permission.data_import))
) -> Dict[str, Any]:
    """
    Import multiple projects from CSV file.
    
    This endpoint accepts a CSV file upload containing project data and imports
    all projects into the database. The CSV must have a header row with column
    names matching the expected fields (name, budget, status, etc.).
    
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
        
        # Extract user ID for audit logging
        user_id = current_user.get("user_id", "")
        
        # Get database client
        db = get_db()
        if not db:
            logger.error("Database client not available")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=_create_error_response("Database service unavailable")
            )
        
        # Initialize import service with user context
        import_service = ImportService(db_session=db, user_id=user_id)
        
        # Process the import
        result: ImportResult = await import_service.import_projects(
            projects=projects,
            import_method="csv"
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
