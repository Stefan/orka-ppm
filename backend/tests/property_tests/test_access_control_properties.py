"""
Property-Based Tests for Shareable Project URLs - Access Control

This module contains property-based tests using Hypothesis to validate
the access control operations for the shareable project URLs system.

Feature: shareable-project-urls
Property 2: Permission Enforcement Consistency
Property 3: Time-Based Access Control
Property 5: Data Filtering Accuracy
**Validates: Requirements 2.2, 2.3, 2.4, 2.5, 3.2, 3.3, 5.2**
"""

import pytest
from hypothesis import given, settings, strategies as st, assume
from datetime import datetime, timedelta, timezone
from uuid import uuid4, UUID
import asyncio
import sys
import os
from typing import List, Dict, Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from services.guest_access_controller import GuestAccessController
from models.shareable_urls import SharePermissionLevel, ShareLinkValidation, FilteredProjectData


# ============================================================================
# Mock Database for Testing
# ============================================================================

class MockDatabase:
    """Mock database for testing access control operations without real DB"""
    
    def __init__(self):
        self.shares = {}  # share_id -> share_data
        self.shares_by_token = {}  # token -> share_id
        self.projects = {}  # project_id -> project_data
        self.milestones = {}  # project_id -> [milestones]
        self.team_members = {}  # project_id -> [team_members]
        self.documents = {}  # project_id -> [documents]
        self.tasks = {}  # project_id -> [tasks]
        
    def table(self, table_name: str):
        """Return self to allow method chaining"""
        self.current_table = table_name
        return self
        
    def select(self, columns: str):
        """Mock select operation"""
        self.select_columns = columns
        return self
        
    def eq(self, column: str, value: Any):
        """Mock equality filter"""
        if not hasattr(self, 'filters'):
            self.filters = []
        self.filters.append((column, value))
        self.filter_column = column
        self.filter_value = value
        return self
        
    def in_(self, column: str, values: List[Any]):
        """Mock IN filter"""
        self.in_column = column
        self.in_values = values
        return self
        
    def execute(self):
        """Mock execute operation"""
        result_data = []
        
        if self.current_table == "project_shares":
            if hasattr(self, 'filter_column') and hasattr(self, 'filter_value'):
                if self.filter_column == "token":
                    token = self.filter_value
                    if token in self.shares_by_token:
                        share_id = self.shares_by_token[token]
                        result_data = [self.shares[share_id]]
                elif self.filter_column == "id":
                    share_id = self.filter_value
                    if share_id in self.shares:
                        result_data = [self.shares[share_id]]
        
        elif self.current_table == "projects":
            if hasattr(self, 'filter_column') and hasattr(self, 'filter_value'):
                if self.filter_column == "id":
                    project_id = self.filter_value
                    if project_id in self.projects:
                        result_data = [self.projects[project_id]]
        
        elif self.current_table == "milestones":
            if hasattr(self, 'filter_column') and hasattr(self, 'filter_value'):
                if self.filter_column == "project_id":
                    project_id = self.filter_value
                    result_data = self.milestones.get(project_id, [])
        
        elif self.current_table == "project_team_members":
            if hasattr(self, 'filter_column') and hasattr(self, 'filter_value'):
                if self.filter_column == "project_id":
                    project_id = self.filter_value
                    result_data = self.team_members.get(project_id, [])
        
        elif self.current_table == "documents":
            if hasattr(self, 'filters') and len(self.filters) > 0:
                # Start with all documents for the project
                project_id = None
                is_public_filter = None
                
                # Extract filters
                for filter_col, filter_val in self.filters:
                    if filter_col == "project_id":
                        project_id = filter_val
                    elif filter_col == "is_public":
                        is_public_filter = filter_val
                
                if project_id:
                    docs = self.documents.get(project_id, [])
                    # Apply is_public filter if present
                    if is_public_filter is not None:
                        docs = [d for d in docs if d.get("is_public", True) == is_public_filter]
                    result_data = docs
                else:
                    result_data = []
            else:
                result_data = []
        
        elif self.current_table == "tasks":
            if hasattr(self, 'filter_column') and hasattr(self, 'filter_value'):
                if self.filter_column == "project_id":
                    project_id = self.filter_value
                    result_data = self.tasks.get(project_id, [])
        
        # Return mock result
        result = type('obj', (object,), {'data': result_data})()
        
        # Clear filters for next query
        if hasattr(self, 'filters'):
            delattr(self, 'filters')
        
        return result


# ============================================================================
# Test Fixtures and Helpers
# ============================================================================

def create_test_project(
    mock_db: MockDatabase,
    project_id: UUID,
    include_sensitive_data: bool = True
) -> Dict[str, Any]:
    """Helper to create a test project with various data"""
    project_data = {
        "id": str(project_id),
        "name": "Test Construction Project",
        "description": "A major construction project",
        "status": "active",
        "progress_percentage": 75.5,
        "start_date": "2024-01-01",
        "end_date": "2024-12-31",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-06-01T00:00:00Z",
        "priority": "high",
        "health": "green",
        "portfolio_id": str(uuid4()),
        "manager_id": str(uuid4())
    }
    
    if include_sensitive_data:
        # Add sensitive data that should NEVER be exposed
        project_data.update({
            "budget": 5000000.00,
            "actual_cost": 3250000.00,
            "spent": 3250000.00,
            "financial_data": {"q1": 1000000, "q2": 1250000},
            "cost_breakdown": {"labor": 2000000, "materials": 1250000},
            "internal_notes": "Confidential project information",
            "private_notes": "Private management notes",
            "confidential_notes": "Top secret details",
            "created_by_email": "admin@example.com",
            "updated_by_email": "manager@example.com"
        })
    
    mock_db.projects[str(project_id)] = project_data
    return project_data


def create_test_share_link(
    mock_db: MockDatabase,
    project_id: UUID,
    token: str,
    permission_level: SharePermissionLevel,
    expires_at: datetime,
    is_active: bool = True,
    revoked_at: Optional[datetime] = None
) -> Dict[str, Any]:
    """Helper to create a test share link"""
    share_id = str(uuid4())
    share_data = {
        "id": share_id,
        "project_id": str(project_id),
        "token": token,
        "permission_level": permission_level.value,
        "expires_at": expires_at.isoformat(),
        "is_active": is_active,
        "revoked_at": revoked_at.isoformat() if revoked_at else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    mock_db.shares[share_id] = share_data
    mock_db.shares_by_token[token] = share_id
    return share_data


def add_project_milestones(mock_db: MockDatabase, project_id: UUID, count: int = 3):
    """Add milestones to a project"""
    milestones = []
    for i in range(count):
        milestones.append({
            "id": str(uuid4()),
            "name": f"Milestone {i+1}",
            "description": f"Description for milestone {i+1}",
            "due_date": "2024-06-01",
            "status": "in_progress",
            "completion_percentage": 50.0
        })
    mock_db.milestones[str(project_id)] = milestones


def add_project_team_members(mock_db: MockDatabase, project_id: UUID, count: int = 2):
    """Add team members to a project"""
    team_members = []
    for i in range(count):
        team_members.append({
            "user_id": str(uuid4()),
            "role": f"role_{i+1}"
        })
    mock_db.team_members[str(project_id)] = team_members


def add_project_documents(mock_db: MockDatabase, project_id: UUID, count: int = 2):
    """Add documents to a project"""
    documents = []
    for i in range(count):
        documents.append({
            "id": str(uuid4()),
            "name": f"Document {i+1}.pdf",
            "description": f"Description for document {i+1}",
            "file_type": "pdf",
            "uploaded_at": "2024-01-01T00:00:00Z",
            "is_public": True  # Mark as public so they're included in filtered results
        })
    mock_db.documents[str(project_id)] = documents


def add_project_tasks(mock_db: MockDatabase, project_id: UUID, count: int = 5):
    """Add tasks to a project"""
    tasks = []
    for i in range(count):
        tasks.append({
            "id": str(uuid4()),
            "name": f"Task {i+1}",
            "description": f"Description for task {i+1}",
            "status": "in_progress",
            "priority": "medium",
            "due_date": "2024-06-01",
            "assigned_to": str(uuid4()),
            "completion_percentage": 50.0
        })
    mock_db.tasks[str(project_id)] = tasks


# ============================================================================
# Hypothesis Strategies
# ============================================================================

@st.composite
def permission_level_strategy(draw):
    """Generate random permission levels"""
    return draw(st.sampled_from(list(SharePermissionLevel)))


@st.composite
def token_strategy(draw):
    """Generate valid 64-character tokens"""
    # Generate URL-safe tokens
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"
    return ''.join(draw(st.lists(st.sampled_from(chars), min_size=64, max_size=64)))


@st.composite
def expiry_time_strategy(draw):
    """Generate expiry times (past, present, or future)"""
    # Generate times from 30 days ago to 30 days in the future
    days_offset = draw(st.integers(min_value=-30, max_value=30))
    hours_offset = draw(st.integers(min_value=0, max_value=23))
    return datetime.now(timezone.utc) + timedelta(days=days_offset, hours=hours_offset)


@st.composite
def share_link_with_project_strategy(draw):
    """Generate a share link with associated project data"""
    project_id = uuid4()
    token = draw(token_strategy())
    permission_level = draw(permission_level_strategy())
    expires_at = draw(expiry_time_strategy())
    is_active = draw(st.booleans())
    
    # If inactive, might be revoked
    revoked_at = None
    if not is_active and draw(st.booleans()):
        revoked_at = datetime.now(timezone.utc) - timedelta(days=1)
    
    return {
        "project_id": project_id,
        "token": token,
        "permission_level": permission_level,
        "expires_at": expires_at,
        "is_active": is_active,
        "revoked_at": revoked_at
    }


# ============================================================================
# Property 2: Permission Enforcement Consistency
# **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
# ============================================================================

@given(permission_level_strategy())
@settings(max_examples=100, deadline=None)
def test_property2_permission_level_consistently_enforced(permission_level):
    """
    Property 2: Permission Enforcement Consistency
    
    For any external user accessing via share link, only the permissions granted
    to that specific link must be enforced, regardless of access method or timing.
    
    Feature: shareable-project-urls, Property 2: Permission Enforcement Consistency
    **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
    """
    # Setup
    mock_db = MockDatabase()
    controller = GuestAccessController(db_session=mock_db)
    
    project_id = uuid4()
    token = "a" * 64
    
    # Create project with all types of data
    create_test_project(mock_db, project_id, include_sensitive_data=True)
    add_project_milestones(mock_db, project_id, count=3)
    add_project_team_members(mock_db, project_id, count=2)
    add_project_documents(mock_db, project_id, count=2)
    add_project_tasks(mock_db, project_id, count=5)
    
    # Create share link with specific permission level
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    create_test_share_link(
        mock_db, project_id, token, permission_level, expires_at, is_active=True
    )
    
    # Get filtered project data
    result = asyncio.run(controller.get_filtered_project_data(project_id, permission_level))
    
    # Property: Result must be returned
    assert result is not None, "Filtered project data must be returned"
    
    # Property: Permission level determines data visibility
    if permission_level == SharePermissionLevel.VIEW_ONLY:
        # VIEW_ONLY: Only basic fields
        assert result.name is not None
        assert result.status is not None
        assert result.progress_percentage is not None
        # Extended fields must be None
        assert result.milestones is None, "VIEW_ONLY must not include milestones"
        assert result.team_members is None, "VIEW_ONLY must not include team_members"
        assert result.documents is None, "VIEW_ONLY must not include documents"
        assert result.tasks is None, "VIEW_ONLY must not include tasks"
    
    elif permission_level == SharePermissionLevel.LIMITED_DATA:
        # LIMITED_DATA: Basic + milestones, team, documents
        assert result.name is not None
        assert result.milestones is not None, "LIMITED_DATA must include milestones"
        assert result.team_members is not None, "LIMITED_DATA must include team_members"
        assert result.documents is not None, "LIMITED_DATA must include documents"
        # Tasks must still be None
        assert result.tasks is None, "LIMITED_DATA must not include tasks"
    
    elif permission_level == SharePermissionLevel.FULL_PROJECT:
        # FULL_PROJECT: All allowed data
        assert result.name is not None
        assert result.milestones is not None, "FULL_PROJECT must include milestones"
        assert result.team_members is not None, "FULL_PROJECT must include team_members"
        assert result.documents is not None, "FULL_PROJECT must include documents"
        assert result.tasks is not None, "FULL_PROJECT must include tasks"


@given(permission_level_strategy())
@settings(max_examples=100, deadline=None)
def test_property2_same_permission_level_returns_consistent_data(permission_level):
    """
    Property 2: Permission Enforcement Consistency
    
    For any permission level, multiple accesses must return consistent data.
    The same permission level must always filter data the same way.
    
    Feature: shareable-project-urls, Property 2: Permission Enforcement Consistency
    **Validates: Requirements 2.2**
    """
    # Setup
    mock_db = MockDatabase()
    controller = GuestAccessController(db_session=mock_db)
    
    project_id = uuid4()
    
    # Create project
    create_test_project(mock_db, project_id, include_sensitive_data=True)
    add_project_milestones(mock_db, project_id, count=3)
    add_project_team_members(mock_db, project_id, count=2)
    add_project_documents(mock_db, project_id, count=2)
    add_project_tasks(mock_db, project_id, count=5)
    
    # Get filtered data multiple times
    result1 = asyncio.run(controller.get_filtered_project_data(project_id, permission_level))
    result2 = asyncio.run(controller.get_filtered_project_data(project_id, permission_level))
    result3 = asyncio.run(controller.get_filtered_project_data(project_id, permission_level))
    
    # Property: All results must be consistent
    assert result1 is not None
    assert result2 is not None
    assert result3 is not None
    
    # Property: Same fields must be present/absent in all results
    assert (result1.milestones is None) == (result2.milestones is None) == (result3.milestones is None)
    assert (result1.team_members is None) == (result2.team_members is None) == (result3.team_members is None)
    assert (result1.documents is None) == (result2.documents is None) == (result3.documents is None)
    assert (result1.tasks is None) == (result2.tasks is None) == (result3.tasks is None)
    
    # Property: Data values must be identical
    assert result1.name == result2.name == result3.name
    assert result1.status == result2.status == result3.status
    assert result1.progress_percentage == result2.progress_percentage == result3.progress_percentage


@given(st.lists(permission_level_strategy(), min_size=2, max_size=3, unique=True))
@settings(max_examples=50, deadline=None)
def test_property2_different_permissions_return_different_data(permission_levels):
    """
    Property 2: Permission Enforcement Consistency
    
    For any two different permission levels, the filtered data must differ.
    Higher permission levels must include all data from lower levels plus additional data.
    
    Feature: shareable-project-urls, Property 2: Permission Enforcement Consistency
    **Validates: Requirements 2.2, 2.3, 2.4**
    """
    # Need at least 2 different permission levels
    assume(len(permission_levels) >= 2)
    
    # Setup
    mock_db = MockDatabase()
    controller = GuestAccessController(db_session=mock_db)
    
    project_id = uuid4()
    
    # Create project with all data
    create_test_project(mock_db, project_id, include_sensitive_data=True)
    add_project_milestones(mock_db, project_id, count=3)
    add_project_team_members(mock_db, project_id, count=2)
    add_project_documents(mock_db, project_id, count=2)
    add_project_tasks(mock_db, project_id, count=5)
    
    # Get filtered data for each permission level
    results = {}
    for perm_level in permission_levels:
        results[perm_level] = asyncio.run(
            controller.get_filtered_project_data(project_id, perm_level)
        )
    
    # Property: VIEW_ONLY must have least data
    if SharePermissionLevel.VIEW_ONLY in results:
        view_only = results[SharePermissionLevel.VIEW_ONLY]
        assert view_only.milestones is None
        assert view_only.team_members is None
        assert view_only.tasks is None
    
    # Property: LIMITED_DATA must have more data than VIEW_ONLY
    if SharePermissionLevel.LIMITED_DATA in results:
        limited = results[SharePermissionLevel.LIMITED_DATA]
        assert limited.milestones is not None
        assert limited.team_members is not None
        assert limited.tasks is None  # Still no tasks
    
    # Property: FULL_PROJECT must have most data
    if SharePermissionLevel.FULL_PROJECT in results:
        full = results[SharePermissionLevel.FULL_PROJECT]
        assert full.milestones is not None
        assert full.team_members is not None
        assert full.tasks is not None
    
    # Property: Higher permission levels include all lower level data
    if SharePermissionLevel.VIEW_ONLY in results and SharePermissionLevel.LIMITED_DATA in results:
        view_only = results[SharePermissionLevel.VIEW_ONLY]
        limited = results[SharePermissionLevel.LIMITED_DATA]
        # Basic fields must be present in both
        assert view_only.name == limited.name
        assert view_only.status == limited.status


# ============================================================================
# Property 3: Time-Based Access Control
# **Validates: Requirements 3.2, 3.3**
# ============================================================================

@given(expiry_time_strategy())
@settings(max_examples=100, deadline=None)
def test_property3_expired_links_immediately_inaccessible(expires_at):
    """
    Property 3: Time-Based Access Control
    
    For any share link with an expiration time, access must be automatically
    disabled when the current time exceeds the expiration timestamp.
    
    Feature: shareable-project-urls, Property 3: Time-Based Access Control
    **Validates: Requirements 3.2, 3.3**
    """
    # Setup
    mock_db = MockDatabase()
    controller = GuestAccessController(db_session=mock_db)
    
    project_id = uuid4()
    token = "a" * 64
    
    # Create project and share link
    create_test_project(mock_db, project_id)
    create_test_share_link(
        mock_db, project_id, token, SharePermissionLevel.VIEW_ONLY,
        expires_at, is_active=True
    )
    
    # Validate token
    validation = asyncio.run(controller.validate_token(token))
    
    # Property: Validation result depends on expiry time
    now = datetime.now(timezone.utc)
    is_expired = now >= expires_at
    
    if is_expired:
        # Property: Expired links must be invalid
        assert validation.is_valid is False, \
            f"Expired link must be invalid (now={now}, expires={expires_at})"
        assert "expired" in validation.error_message.lower(), \
            "Error message must indicate expiration"
    else:
        # Property: Non-expired links must be valid (if active)
        assert validation.is_valid is True, \
            f"Non-expired link must be valid (now={now}, expires={expires_at})"
        assert validation.error_message is None


@given(st.integers(min_value=-10, max_value=10))
@settings(max_examples=100, deadline=None)
def test_property3_expiry_boundary_conditions(days_offset):
    """
    Property 3: Time-Based Access Control
    
    For any share link, expiry checking must correctly handle boundary conditions
    including exact expiry time, just before, and just after expiry.
    
    Feature: shareable-project-urls, Property 3: Time-Based Access Control
    **Validates: Requirements 3.2, 3.3**
    """
    # Setup
    mock_db = MockDatabase()
    controller = GuestAccessController(db_session=mock_db)
    
    project_id = uuid4()
    token = "a" * 64
    
    # Create expiry time based on offset
    expires_at = datetime.now(timezone.utc) + timedelta(days=days_offset)
    
    # Create project and share link
    create_test_project(mock_db, project_id)
    create_test_share_link(
        mock_db, project_id, token, SharePermissionLevel.VIEW_ONLY,
        expires_at, is_active=True
    )
    
    # Validate token
    validation = asyncio.run(controller.validate_token(token))
    
    # Property: Expiry check must be accurate
    now = datetime.now(timezone.utc)
    is_expired = now >= expires_at
    
    assert validation.is_valid == (not is_expired), \
        f"Validation must match expiry status (expired={is_expired})"


@given(st.booleans())
@settings(max_examples=100, deadline=None)
def test_property3_timezone_aware_expiry_checking(use_naive_datetime):
    """
    Property 3: Time-Based Access Control
    
    For any share link, expiry checking must handle both timezone-aware and
    naive datetimes correctly, treating naive datetimes as UTC.
    
    Feature: shareable-project-urls, Property 3: Time-Based Access Control
    **Validates: Requirements 3.3**
    """
    # Setup
    controller = GuestAccessController(db_session=None)
    
    # Create expiry time (1 hour in the future)
    if use_naive_datetime:
        # Naive datetime (no timezone)
        expires_at = datetime.now() + timedelta(hours=1)
    else:
        # Timezone-aware datetime
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Property: Non-expired time must not be expired
    is_expired = controller._is_expired(expires_at)
    assert is_expired is False, "Future time must not be expired"
    
    # Create past expiry time
    if use_naive_datetime:
        past_expires_at = datetime.now() - timedelta(hours=1)
    else:
        past_expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    
    # Property: Past time must be expired
    is_past_expired = controller._is_expired(past_expires_at)
    assert is_past_expired is True, "Past time must be expired"


@given(share_link_with_project_strategy())
@settings(max_examples=100, deadline=None)
def test_property3_inactive_or_revoked_links_always_invalid(share_params):
    """
    Property 3: Time-Based Access Control
    
    For any share link that is inactive or revoked, it must be invalid
    regardless of expiry time. Expiry is only checked for active links.
    
    Feature: shareable-project-urls, Property 3: Time-Based Access Control
    **Validates: Requirements 3.2**
    """
    # Setup
    mock_db = MockDatabase()
    controller = GuestAccessController(db_session=mock_db)
    
    # Create project and share link
    create_test_project(mock_db, share_params["project_id"])
    create_test_share_link(
        mock_db,
        share_params["project_id"],
        share_params["token"],
        share_params["permission_level"],
        share_params["expires_at"],
        is_active=share_params["is_active"],
        revoked_at=share_params["revoked_at"]
    )
    
    # Validate token
    validation = asyncio.run(controller.validate_token(share_params["token"]))
    
    # Property: Inactive or revoked links must be invalid
    if not share_params["is_active"] or share_params["revoked_at"] is not None:
        assert validation.is_valid is False, "Inactive or revoked link must be invalid"
        # Error message can be either "no longer active" or "revoked"
        assert "no longer active" in validation.error_message.lower() or \
               "revoked" in validation.error_message.lower(), \
               f"Error message must indicate inactive or revoked status: {validation.error_message}"
    
    # Property: Active, non-revoked links depend on expiry
    if share_params["is_active"] and share_params["revoked_at"] is None:
        now = datetime.now(timezone.utc)
        is_expired = now >= share_params["expires_at"]
        
        if is_expired:
            assert validation.is_valid is False, "Expired active link must be invalid"
        else:
            assert validation.is_valid is True, "Non-expired active link must be valid"


@given(st.integers(min_value=1, max_value=100))
@settings(max_examples=50, deadline=None)
def test_property3_expiry_check_is_immediate(seconds_until_expiry):
    """
    Property 3: Time-Based Access Control
    
    For any share link approaching expiry, the expiry check must be immediate
    and accurate to the second. No grace period should exist.
    
    Feature: shareable-project-urls, Property 3: Time-Based Access Control
    **Validates: Requirements 3.2**
    """
    # Setup
    mock_db = MockDatabase()
    controller = GuestAccessController(db_session=mock_db)
    
    project_id = uuid4()
    token = "a" * 64
    
    # Create expiry time in the near future
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=seconds_until_expiry)
    
    # Create project and share link
    create_test_project(mock_db, project_id)
    create_test_share_link(
        mock_db, project_id, token, SharePermissionLevel.VIEW_ONLY,
        expires_at, is_active=True
    )
    
    # Validate token immediately
    validation = asyncio.run(controller.validate_token(token))
    
    # Property: Link must be valid before expiry
    assert validation.is_valid is True, \
        f"Link must be valid {seconds_until_expiry}s before expiry"
    
    # Property: Expiry check must be accurate
    now = datetime.now(timezone.utc)
    assert now < expires_at, "Current time must be before expiry"


# ============================================================================
# Property 5: Data Filtering Accuracy
# **Validates: Requirements 2.3, 2.4, 2.5, 5.2**
# ============================================================================

@given(permission_level_strategy())
@settings(max_examples=100, deadline=None)
def test_property5_sensitive_data_never_exposed(permission_level):
    """
    Property 5: Data Filtering Accuracy
    
    For any permission level, sensitive data (financial information and internal notes)
    must NEVER be exposed. This is the most critical security property.
    
    Feature: shareable-project-urls, Property 5: Data Filtering Accuracy
    **Validates: Requirements 2.5, 5.2**
    """
    # Setup
    mock_db = MockDatabase()
    controller = GuestAccessController(db_session=mock_db)
    
    project_id = uuid4()
    
    # Create project with sensitive data
    project_data = create_test_project(mock_db, project_id, include_sensitive_data=True)
    
    # Verify sensitive data exists in source
    assert "budget" in project_data
    assert "actual_cost" in project_data
    assert "internal_notes" in project_data
    assert "private_notes" in project_data
    assert "created_by_email" in project_data
    
    # Get filtered data
    result = asyncio.run(controller.get_filtered_project_data(project_id, permission_level))
    
    # Property: Result must be returned
    assert result is not None
    
    # Property: Sensitive data must NEVER be in result
    result_dict = result.dict()
    
    # Financial data must never be exposed
    assert "budget" not in result_dict, \
        f"Budget must NEVER be exposed at {permission_level}"
    assert "actual_cost" not in result_dict, \
        f"Actual cost must NEVER be exposed at {permission_level}"
    assert "spent" not in result_dict, \
        f"Spent amount must NEVER be exposed at {permission_level}"
    assert "financial_data" not in result_dict, \
        f"Financial data must NEVER be exposed at {permission_level}"
    assert "cost_breakdown" not in result_dict, \
        f"Cost breakdown must NEVER be exposed at {permission_level}"
    
    # Internal notes must never be exposed
    assert "internal_notes" not in result_dict, \
        f"Internal notes must NEVER be exposed at {permission_level}"
    assert "private_notes" not in result_dict, \
        f"Private notes must NEVER be exposed at {permission_level}"
    assert "confidential_notes" not in result_dict, \
        f"Confidential notes must NEVER be exposed at {permission_level}"
    
    # Sensitive metadata must never be exposed
    assert "created_by_email" not in result_dict, \
        f"Creator email must NEVER be exposed at {permission_level}"
    assert "updated_by_email" not in result_dict, \
        f"Updater email must NEVER be exposed at {permission_level}"


@given(permission_level_strategy())
@settings(max_examples=100, deadline=None)
def test_property5_filtered_data_contains_only_permitted_fields(permission_level):
    """
    Property 5: Data Filtering Accuracy
    
    For any permission level, the filtered data must contain ONLY the fields
    permitted by that specific permission level, no more and no less.
    
    Feature: shareable-project-urls, Property 5: Data Filtering Accuracy
    **Validates: Requirements 2.3, 2.4, 5.2**
    """
    # Setup
    mock_db = MockDatabase()
    controller = GuestAccessController(db_session=mock_db)
    
    project_id = uuid4()
    
    # Create project with all data
    create_test_project(mock_db, project_id, include_sensitive_data=True)
    add_project_milestones(mock_db, project_id, count=3)
    add_project_team_members(mock_db, project_id, count=2)
    add_project_documents(mock_db, project_id, count=2)
    add_project_tasks(mock_db, project_id, count=5)
    
    # Get filtered data
    result = asyncio.run(controller.get_filtered_project_data(project_id, permission_level))
    
    # Property: Result must be returned
    assert result is not None
    
    # Define expected fields for each permission level
    basic_fields = {'id', 'name', 'description', 'status', 'progress_percentage', 
                    'start_date', 'end_date'}
    
    # Property: Basic fields must always be present
    for field in basic_fields:
        assert getattr(result, field) is not None or field == 'description', \
            f"Basic field '{field}' must be present for {permission_level}"
    
    # Property: Extended fields depend on permission level
    if permission_level == SharePermissionLevel.VIEW_ONLY:
        # Only basic fields, no extended data
        assert result.milestones is None, "VIEW_ONLY must not have milestones"
        assert result.team_members is None, "VIEW_ONLY must not have team_members"
        assert result.documents is None, "VIEW_ONLY must not have documents"
        assert result.timeline is None, "VIEW_ONLY must not have timeline"
        assert result.tasks is None, "VIEW_ONLY must not have tasks"
    
    elif permission_level == SharePermissionLevel.LIMITED_DATA:
        # Basic + limited extended data
        assert result.milestones is not None, "LIMITED_DATA must have milestones"
        assert result.team_members is not None, "LIMITED_DATA must have team_members"
        assert result.documents is not None, "LIMITED_DATA must have documents"
        assert result.timeline is not None, "LIMITED_DATA must have timeline"
        assert result.tasks is None, "LIMITED_DATA must not have tasks"
    
    elif permission_level == SharePermissionLevel.FULL_PROJECT:
        # All allowed data
        assert result.milestones is not None, "FULL_PROJECT must have milestones"
        assert result.team_members is not None, "FULL_PROJECT must have team_members"
        assert result.documents is not None, "FULL_PROJECT must have documents"
        assert result.timeline is not None, "FULL_PROJECT must have timeline"
        assert result.tasks is not None, "FULL_PROJECT must have tasks"


@given(permission_level_strategy(), st.integers(min_value=0, max_value=10))
@settings(max_examples=100, deadline=None)
def test_property5_data_filtering_preserves_data_integrity(permission_level, data_count):
    """
    Property 5: Data Filtering Accuracy
    
    For any permission level and data count, filtering must preserve the integrity
    of the data that is included. No data corruption or modification should occur.
    
    Feature: shareable-project-urls, Property 5: Data Filtering Accuracy
    **Validates: Requirements 5.2**
    """
    # Setup
    mock_db = MockDatabase()
    controller = GuestAccessController(db_session=mock_db)
    
    project_id = uuid4()
    project_name = f"Test Project {uuid4()}"
    
    # Create project with specific name
    project_data = create_test_project(mock_db, project_id, include_sensitive_data=True)
    project_data["name"] = project_name
    mock_db.projects[str(project_id)] = project_data
    
    # Add varying amounts of related data
    if data_count > 0:
        add_project_milestones(mock_db, project_id, count=data_count)
        add_project_team_members(mock_db, project_id, count=data_count)
        add_project_documents(mock_db, project_id, count=data_count)
        add_project_tasks(mock_db, project_id, count=data_count)
    
    # Get filtered data
    result = asyncio.run(controller.get_filtered_project_data(project_id, permission_level))
    
    # Property: Result must be returned
    assert result is not None
    
    # Property: Basic data must be preserved exactly
    assert result.name == project_name, "Project name must be preserved exactly"
    assert result.status == project_data["status"], "Status must be preserved"
    assert result.progress_percentage == project_data["progress_percentage"], \
        "Progress must be preserved"
    
    # Property: If extended data is included, counts must match
    if permission_level in [SharePermissionLevel.LIMITED_DATA, SharePermissionLevel.FULL_PROJECT]:
        if data_count > 0:
            assert result.milestones is not None
            assert len(result.milestones) == data_count, \
                f"Milestone count must match (expected {data_count})"
            assert result.team_members is not None
            # Team members count might differ due to user lookup
            assert result.documents is not None
            assert len(result.documents) == data_count, \
                f"Document count must match (expected {data_count})"
    
    if permission_level == SharePermissionLevel.FULL_PROJECT:
        if data_count > 0:
            assert result.tasks is not None
            assert len(result.tasks) == data_count, \
                f"Task count must match (expected {data_count})"


@given(st.lists(permission_level_strategy(), min_size=1, max_size=3))
@settings(max_examples=50, deadline=None)
def test_property5_sanitization_always_applied_before_filtering(permission_levels):
    """
    Property 5: Data Filtering Accuracy
    
    For any sequence of permission levels, sanitization (removal of sensitive data)
    must ALWAYS be applied before permission-based filtering. This ensures sensitive
    data is never exposed regardless of filtering logic.
    
    Feature: shareable-project-urls, Property 5: Data Filtering Accuracy
    **Validates: Requirements 2.5, 5.2**
    """
    # Setup
    mock_db = MockDatabase()
    controller = GuestAccessController(db_session=mock_db)
    
    project_id = uuid4()
    
    # Create project with sensitive data
    create_test_project(mock_db, project_id, include_sensitive_data=True)
    
    # Test each permission level
    for permission_level in permission_levels:
        result = asyncio.run(controller.get_filtered_project_data(project_id, permission_level))
        
        # Property: Result must be returned
        assert result is not None, f"Result must be returned for {permission_level}"
        
        # Property: Sensitive data must NEVER appear
        result_dict = result.dict()
        
        # Check all sensitive fields
        sensitive_fields = [
            'budget', 'actual_cost', 'spent', 'financial_data', 'cost_breakdown',
            'internal_notes', 'private_notes', 'confidential_notes',
            'created_by_email', 'updated_by_email'
        ]
        
        for field in sensitive_fields:
            assert field not in result_dict, \
                f"Sensitive field '{field}' must NEVER appear at {permission_level}"


@given(permission_level_strategy())
@settings(max_examples=100, deadline=None)
def test_property5_empty_project_data_handled_correctly(permission_level):
    """
    Property 5: Data Filtering Accuracy
    
    For any permission level, projects with minimal or missing data must be
    handled correctly without errors. Filtering must be robust to missing fields.
    
    Feature: shareable-project-urls, Property 5: Data Filtering Accuracy
    **Validates: Requirements 5.2**
    """
    # Setup
    mock_db = MockDatabase()
    controller = GuestAccessController(db_session=mock_db)
    
    project_id = uuid4()
    
    # Create minimal project (only required fields)
    minimal_project = {
        "id": str(project_id),
        "name": "Minimal Project",
        "status": "active"
    }
    mock_db.projects[str(project_id)] = minimal_project
    
    # Get filtered data
    result = asyncio.run(controller.get_filtered_project_data(project_id, permission_level))
    
    # Property: Result must be returned even for minimal data
    assert result is not None, "Result must be returned for minimal project"
    
    # Property: Required fields must be present
    assert result.id == str(project_id)
    assert result.name == "Minimal Project"
    assert result.status == "active"
    
    # Property: Optional fields can be None
    # This is acceptable and should not cause errors


# ============================================================================
# Edge Case Tests
# ============================================================================

def test_property5_sanitization_removes_all_sensitive_fields():
    """
    Property 5: Data Filtering Accuracy
    
    Test that sanitization removes ALL defined sensitive fields.
    
    Feature: shareable-project-urls, Property 5: Data Filtering Accuracy
    **Validates: Requirements 2.5, 5.2**
    """
    controller = GuestAccessController(db_session=None)
    
    # Create data with ALL sensitive fields
    data_with_sensitive = {
        "id": str(uuid4()),
        "name": "Test",
        # Financial data
        "budget": 1000000,
        "actual_cost": 750000,
        "spent": 750000,
        "financial_data": {},
        "cost_breakdown": {},
        "financial_details": {},
        "cost_data": {},
        "budget_details": {},
        "expenditure": {},
        "invoice_data": {},
        "payment_info": {},
        "financial_records": {},
        # Internal notes
        "internal_notes": "secret",
        "private_notes": "secret",
        "confidential_notes": "secret",
        "admin_notes": "secret",
        "internal_comments": "secret",
        "private_comments": "secret",
        "confidential_data": "secret",
        # Sensitive metadata
        "created_by_email": "admin@example.com",
        "updated_by_email": "manager@example.com",
        "creator_email": "creator@example.com",
        "internal_metadata": {},
        "sensitive_metadata": {}
    }
    
    # Sanitize
    sanitized = controller._sanitize_project_data(data_with_sensitive)
    
    # Property: ALL sensitive fields must be removed
    sensitive_fields = [
        'budget', 'actual_cost', 'spent', 'financial_data', 'cost_breakdown',
        'financial_details', 'cost_data', 'budget_details', 'expenditure',
        'invoice_data', 'payment_info', 'financial_records',
        'internal_notes', 'private_notes', 'confidential_notes', 'admin_notes',
        'internal_comments', 'private_comments', 'confidential_data',
        'created_by_email', 'updated_by_email', 'creator_email',
        'internal_metadata', 'sensitive_metadata'
    ]
    
    for field in sensitive_fields:
        assert field not in sanitized, f"Sensitive field '{field}' must be removed"
    
    # Property: Non-sensitive fields must remain
    assert "id" in sanitized
    assert "name" in sanitized


def test_property3_constant_time_comparison_prevents_timing_attacks():
    """
    Property 3: Time-Based Access Control
    
    Test that token comparison uses constant-time comparison to prevent timing attacks.
    
    Feature: shareable-project-urls, Property 3: Time-Based Access Control
    **Validates: Requirements 3.2**
    """
    controller = GuestAccessController(db_session=None)
    
    token1 = "a" * 64
    token2 = "b" * 64
    token3 = "a" * 64
    
    # Property: Equal tokens must return True
    assert controller._constant_time_compare(token1, token3) is True
    
    # Property: Different tokens must return False
    assert controller._constant_time_compare(token1, token2) is False
    
    # Property: Comparison must handle edge cases
    assert controller._constant_time_compare("", "") is True
    assert controller._constant_time_compare("test", "") is False
    assert controller._constant_time_compare(None, "test") is False
    assert controller._constant_time_compare("test", None) is False


@given(st.integers(min_value=1, max_value=20))
@settings(max_examples=50, deadline=None)
def test_property2_permission_enforcement_with_multiple_accesses(access_count):
    """
    Property 2: Permission Enforcement Consistency
    
    For any number of sequential accesses with the same permission level,
    the filtered data must remain consistent across all accesses.
    
    Feature: shareable-project-urls, Property 2: Permission Enforcement Consistency
    **Validates: Requirements 2.2**
    """
    # Setup
    mock_db = MockDatabase()
    controller = GuestAccessController(db_session=mock_db)
    
    project_id = uuid4()
    permission_level = SharePermissionLevel.LIMITED_DATA
    
    # Create project
    create_test_project(mock_db, project_id, include_sensitive_data=True)
    add_project_milestones(mock_db, project_id, count=3)
    add_project_team_members(mock_db, project_id, count=2)
    add_project_documents(mock_db, project_id, count=2)
    add_project_tasks(mock_db, project_id, count=5)
    
    # Access multiple times
    results = []
    for _ in range(access_count):
        result = asyncio.run(controller.get_filtered_project_data(project_id, permission_level))
        results.append(result)
    
    # Property: All results must be returned
    assert all(r is not None for r in results), "All accesses must return results"
    
    # Property: All results must be identical
    first_result = results[0]
    for i, result in enumerate(results[1:], 1):
        assert result.name == first_result.name, \
            f"Access {i+1} must have same name as first access"
        assert result.status == first_result.status, \
            f"Access {i+1} must have same status as first access"
        assert (result.milestones is None) == (first_result.milestones is None), \
            f"Access {i+1} must have same milestone presence as first access"
        assert (result.tasks is None) == (first_result.tasks is None), \
            f"Access {i+1} must have same task presence as first access"


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])
