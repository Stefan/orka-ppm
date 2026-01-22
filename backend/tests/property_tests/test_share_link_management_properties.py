"""
Property-Based Tests for Shareable Project URLs - Link Management

This module contains property-based tests using Hypothesis to validate
the link management operations for the shareable project URLs system.

Feature: shareable-project-urls
Property 6: Link Management State Consistency
**Validates: Requirements 6.2, 6.3**
"""

import pytest
from hypothesis import given, settings, strategies as st, assume
from datetime import datetime, timedelta
from uuid import uuid4, UUID
import asyncio
import sys
import os
from typing import List, Dict, Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from services.share_link_generator import ShareLinkGenerator
from models.shareable_urls import SharePermissionLevel


# ============================================================================
# Mock Database for Testing
# ============================================================================

class MockDatabase:
    """Mock database for testing share link operations without real DB"""
    
    def __init__(self):
        self.shares = {}  # share_id -> share_data
        self.shares_by_token = {}  # token -> share_id
        
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
        self.filter_column = column
        self.filter_value = value
        return self
        
    def order(self, column: str, desc: bool = False):
        """Mock order operation"""
        return self
        
    def insert(self, data: Dict[str, Any]):
        """Mock insert operation"""
        self.insert_data = data
        return self
        
    def update(self, data: Dict[str, Any]):
        """Mock update operation"""
        self.update_data = data
        return self
        
    def execute(self):
        """Mock execute operation"""
        if hasattr(self, 'insert_data'):
            # Insert operation
            share_id = str(uuid4())
            share_data = {
                "id": share_id,
                **self.insert_data
            }
            self.shares[share_id] = share_data
            self.shares_by_token[self.insert_data["token"]] = share_id
            result_data = [share_data]
            
            # Clear insert data
            delattr(self, 'insert_data')
            
        elif hasattr(self, 'update_data'):
            # Update operation
            if hasattr(self, 'filter_column') and hasattr(self, 'filter_value'):
                if self.filter_column == "id":
                    share_id = self.filter_value
                    if share_id in self.shares:
                        self.shares[share_id].update(self.update_data)
                        result_data = [self.shares[share_id]]
                    else:
                        result_data = []
                elif self.filter_column == "token":
                    token = self.filter_value
                    if token in self.shares_by_token:
                        share_id = self.shares_by_token[token]
                        self.shares[share_id].update(self.update_data)
                        result_data = [self.shares[share_id]]
                    else:
                        result_data = []
                else:
                    result_data = []
            else:
                result_data = []
            
            # Clear update data
            delattr(self, 'update_data')
            
        else:
            # Select operation
            if hasattr(self, 'filter_column') and hasattr(self, 'filter_value'):
                if self.filter_column == "id":
                    share_id = self.filter_value
                    result_data = [self.shares[share_id]] if share_id in self.shares else []
                elif self.filter_column == "token":
                    token = self.filter_value
                    if token in self.shares_by_token:
                        share_id = self.shares_by_token[token]
                        result_data = [self.shares[share_id]]
                    else:
                        result_data = []
                elif self.filter_column == "project_id":
                    project_id = self.filter_value
                    result_data = [
                        share for share in self.shares.values()
                        if share.get("project_id") == project_id
                    ]
                else:
                    result_data = list(self.shares.values())
            else:
                result_data = list(self.shares.values())
        
        # Return mock result
        result = type('obj', (object,), {'data': result_data})()
        return result


# ============================================================================
# Test Fixtures and Helpers
# ============================================================================

def create_test_share_link(
    mock_db: MockDatabase,
    project_id: UUID,
    creator_id: UUID,
    permission_level: SharePermissionLevel = SharePermissionLevel.VIEW_ONLY,
    expiry_days: int = 7,
    is_active: bool = True
) -> Dict[str, Any]:
    """Helper to create a test share link"""
    generator = ShareLinkGenerator(db_session=mock_db)
    token = generator.generate_secure_token()
    
    expires_at = datetime.now() + timedelta(days=expiry_days)
    
    share_data = {
        "project_id": str(project_id),
        "token": token,
        "created_by": str(creator_id),
        "permission_level": permission_level.value,
        "expires_at": expires_at.isoformat(),
        "is_active": is_active,
        "custom_message": None,
        "access_count": 0,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    
    result = mock_db.table("project_shares").insert(share_data).execute()
    return result.data[0]


async def validate_share_link_state(
    mock_db: MockDatabase,
    share_id: str,
    expected_is_active: bool,
    expected_revoked: bool = False
) -> bool:
    """Validate that a share link has the expected state"""
    result = mock_db.table("project_shares").select("*").eq("id", share_id).execute()
    
    if not result.data or len(result.data) == 0:
        return False
    
    share = result.data[0]
    
    # Check is_active state
    if share["is_active"] != expected_is_active:
        return False
    
    # Check revocation state
    if expected_revoked:
        if share.get("revoked_at") is None or share.get("revoked_by") is None:
            return False
    
    return True


# ============================================================================
# Hypothesis Strategies
# ============================================================================

@st.composite
def share_link_strategy(draw):
    """Generate random share link parameters"""
    project_id = uuid4()
    creator_id = uuid4()
    permission_level = draw(st.sampled_from(list(SharePermissionLevel)))
    expiry_days = draw(st.integers(min_value=1, max_value=365))
    
    return {
        "project_id": project_id,
        "creator_id": creator_id,
        "permission_level": permission_level,
        "expiry_days": expiry_days
    }


@st.composite
def multiple_share_links_strategy(draw):
    """Generate multiple share links for bulk operations"""
    count = draw(st.integers(min_value=2, max_value=10))
    project_id = uuid4()
    creator_id = uuid4()
    
    links = []
    for _ in range(count):
        permission_level = draw(st.sampled_from(list(SharePermissionLevel)))
        expiry_days = draw(st.integers(min_value=1, max_value=365))
        links.append({
            "project_id": project_id,
            "creator_id": creator_id,
            "permission_level": permission_level,
            "expiry_days": expiry_days
        })
    
    return links



# ============================================================================
# Property 6: Link Management State Consistency
# **Validates: Requirements 6.2, 6.3**
# ============================================================================

@given(share_link_strategy())
@settings(max_examples=100, deadline=None)
def test_property6_revocation_immediately_disables_access(share_params):
    """
    Property 6: Link Management State Consistency
    
    For any share link, when it is revoked, it must be immediately inaccessible.
    The is_active flag must be set to False and revocation metadata must be recorded.
    
    Feature: shareable-project-urls, Property 6: Link Management State Consistency
    **Validates: Requirements 6.2, 6.3**
    """
    # Setup
    mock_db = MockDatabase()
    generator = ShareLinkGenerator(db_session=mock_db)
    
    # Create a share link
    share = create_test_share_link(
        mock_db,
        share_params["project_id"],
        share_params["creator_id"],
        share_params["permission_level"],
        share_params["expiry_days"]
    )
    
    share_id = UUID(share["id"])
    revoker_id = uuid4()
    revocation_reason = "Test revocation"
    
    # Revoke the share link
    result = asyncio.run(generator.revoke_share_link(
        share_id,
        revoker_id,
        revocation_reason
    ))
    
    # Property: Revocation must succeed
    assert result is True, "Revocation operation must succeed"
    
    # Property: Share link must be immediately inactive
    is_valid = asyncio.run(validate_share_link_state(
        mock_db,
        str(share_id),
        expected_is_active=False,
        expected_revoked=True
    ))
    assert is_valid, "Share link must be immediately inactive after revocation"
    
    # Property: Revocation metadata must be recorded
    db_result = mock_db.table("project_shares").select("*").eq("id", str(share_id)).execute()
    revoked_share = db_result.data[0]
    
    assert revoked_share["is_active"] is False, "is_active must be False"
    assert revoked_share.get("revoked_at") is not None, "revoked_at must be set"
    assert revoked_share.get("revoked_by") == str(revoker_id), "revoked_by must be set correctly"
    assert revoked_share.get("revocation_reason") == revocation_reason, "revocation_reason must be recorded"


@given(share_link_strategy(), st.integers(min_value=1, max_value=365))
@settings(max_examples=100, deadline=None)
def test_property6_expiry_extension_maintains_consistency(share_params, additional_days):
    """
    Property 6: Link Management State Consistency
    
    For any share link, when expiry is extended, the new expiry must be consistently applied
    and the link must remain accessible until the new expiry time.
    
    Feature: shareable-project-urls, Property 6: Link Management State Consistency
    **Validates: Requirements 6.2, 6.3**
    """
    # Setup
    mock_db = MockDatabase()
    generator = ShareLinkGenerator(db_session=mock_db)
    
    # Create a share link
    share = create_test_share_link(
        mock_db,
        share_params["project_id"],
        share_params["creator_id"],
        share_params["permission_level"],
        share_params["expiry_days"]
    )
    
    share_id = UUID(share["id"])
    original_expires_at = datetime.fromisoformat(share["expires_at"])
    
    # Extend the expiry
    result = asyncio.run(generator.extend_expiry(share_id, additional_days))
    
    # Property: Extension must succeed for active links
    assert result is not None, "Expiry extension must succeed for active links"
    
    # Property: New expiry must be correctly calculated
    expected_new_expiry = original_expires_at + timedelta(days=additional_days)
    actual_new_expiry = result.expires_at
    
    # Allow small time difference due to processing time
    time_diff = abs((actual_new_expiry - expected_new_expiry).total_seconds())
    assert time_diff < 2, f"New expiry must be correctly calculated (diff: {time_diff}s)"
    
    # Property: Link must remain active
    assert result.is_active is True, "Link must remain active after expiry extension"
    
    # Property: Database must reflect the new expiry
    db_result = mock_db.table("project_shares").select("*").eq("id", str(share_id)).execute()
    updated_share = db_result.data[0]
    
    db_expires_at = datetime.fromisoformat(updated_share["expires_at"])
    db_time_diff = abs((db_expires_at - expected_new_expiry).total_seconds())
    assert db_time_diff < 2, "Database must reflect the new expiry time"


@given(share_link_strategy())
@settings(max_examples=100, deadline=None)
def test_property6_revoked_links_cannot_be_extended(share_params):
    """
    Property 6: Link Management State Consistency
    
    For any revoked share link, attempts to extend expiry must fail.
    This ensures state consistency - revoked links cannot be reactivated through extension.
    
    Feature: shareable-project-urls, Property 6: Link Management State Consistency
    **Validates: Requirements 6.2, 6.3**
    """
    # Setup
    mock_db = MockDatabase()
    generator = ShareLinkGenerator(db_session=mock_db)
    
    # Create and revoke a share link
    share = create_test_share_link(
        mock_db,
        share_params["project_id"],
        share_params["creator_id"],
        share_params["permission_level"],
        share_params["expiry_days"]
    )
    
    share_id = UUID(share["id"])
    
    # Revoke the link
    asyncio.run(generator.revoke_share_link(
        share_id,
        uuid4(),
        "Test revocation"
    ))
    
    # Attempt to extend expiry
    result = asyncio.run(generator.extend_expiry(share_id, 7))
    
    # Property: Extension must fail for revoked links
    assert result is None, "Expiry extension must fail for revoked links"
    
    # Property: Link must remain inactive
    is_valid = asyncio.run(validate_share_link_state(
        mock_db,
        str(share_id),
        expected_is_active=False,
        expected_revoked=True
    ))
    assert is_valid, "Revoked link must remain inactive"



@given(multiple_share_links_strategy())
@settings(max_examples=50, deadline=None)
def test_property6_bulk_revoke_maintains_atomicity_per_link(share_links):
    """
    Property 6: Link Management State Consistency
    
    For any bulk revocation operation, each link must be processed atomically.
    Successful revocations must be recorded, and failures must not affect other links.
    
    Feature: shareable-project-urls, Property 6: Link Management State Consistency
    **Validates: Requirements 6.2, 6.3**
    """
    # Setup
    mock_db = MockDatabase()
    generator = ShareLinkGenerator(db_session=mock_db)
    
    # Create multiple share links
    share_ids = []
    for link_params in share_links:
        share = create_test_share_link(
            mock_db,
            link_params["project_id"],
            link_params["creator_id"],
            link_params["permission_level"],
            link_params["expiry_days"]
        )
        share_ids.append(UUID(share["id"]))
    
    revoker_id = share_links[0]["creator_id"]  # Use creator as revoker
    revocation_reason = "Bulk test revocation"
    
    # Perform bulk revocation
    result = asyncio.run(generator.bulk_revoke_share_links(
        share_ids,
        revoker_id,
        revocation_reason
    ))
    
    # Property: Bulk operation must return results
    assert result is not None, "Bulk revocation must return results"
    assert "successful" in result, "Result must contain successful list"
    assert "failed" in result, "Result must contain failed list"
    assert "total_processed" in result, "Result must contain total_processed count"
    
    # Property: Total processed must equal input count
    assert result["total_processed"] == len(share_ids), \
        "Total processed must equal number of share links"
    
    # Property: Success + failure count must equal total
    assert result["success_count"] + result["failure_count"] == len(share_ids), \
        "Success and failure counts must sum to total"
    
    # Property: Each successfully revoked link must be inactive
    for share_id_str in result["successful"]:
        is_valid = asyncio.run(validate_share_link_state(
            mock_db,
            share_id_str,
            expected_is_active=False,
            expected_revoked=True
        ))
        assert is_valid, f"Successfully revoked link {share_id_str} must be inactive"
    
    # Property: All links must be in either successful or failed list
    all_processed = set(result["successful"]) | {f["share_id"] for f in result["failed"]}
    expected_ids = {str(sid) for sid in share_ids}
    assert all_processed == expected_ids, "All links must be accounted for in results"


@given(multiple_share_links_strategy(), st.integers(min_value=1, max_value=365))
@settings(max_examples=50, deadline=None)
def test_property6_bulk_extend_maintains_atomicity_per_link(share_links, additional_days):
    """
    Property 6: Link Management State Consistency
    
    For any bulk expiry extension operation, each link must be processed atomically.
    Successful extensions must update expiry times, and failures must not affect other links.
    
    Feature: shareable-project-urls, Property 6: Link Management State Consistency
    **Validates: Requirements 6.2, 6.3**
    """
    # Setup
    mock_db = MockDatabase()
    generator = ShareLinkGenerator(db_session=mock_db)
    
    # Create multiple share links and track original expiry times
    share_ids = []
    original_expiries = {}
    
    for link_params in share_links:
        share = create_test_share_link(
            mock_db,
            link_params["project_id"],
            link_params["creator_id"],
            link_params["permission_level"],
            link_params["expiry_days"]
        )
        share_id = UUID(share["id"])
        share_ids.append(share_id)
        original_expiries[str(share_id)] = datetime.fromisoformat(share["expires_at"])
    
    user_id = share_links[0]["creator_id"]  # Use creator as user
    
    # Perform bulk expiry extension
    result = asyncio.run(generator.bulk_extend_expiry(
        share_ids,
        additional_days,
        user_id
    ))
    
    # Property: Bulk operation must return results
    assert result is not None, "Bulk extend must return results"
    assert "successful" in result, "Result must contain successful list"
    assert "failed" in result, "Result must contain failed list"
    
    # Property: Each successfully extended link must have updated expiry
    for share_id_str in result["successful"]:
        db_result = mock_db.table("project_shares").select("*").eq("id", share_id_str).execute()
        updated_share = db_result.data[0]
        
        new_expiry = datetime.fromisoformat(updated_share["expires_at"])
        expected_expiry = original_expiries[share_id_str] + timedelta(days=additional_days)
        
        # Allow small time difference
        time_diff = abs((new_expiry - expected_expiry).total_seconds())
        assert time_diff < 2, \
            f"Extended link {share_id_str} must have correct new expiry (diff: {time_diff}s)"
        
        # Property: Link must remain active
        assert updated_share["is_active"] is True, \
            f"Extended link {share_id_str} must remain active"


@given(share_link_strategy())
@settings(max_examples=100, deadline=None)
def test_property6_state_changes_are_immediately_visible(share_params):
    """
    Property 6: Link Management State Consistency
    
    For any state change operation (revoke, extend), the changes must be immediately
    visible in subsequent queries. No stale data should be returned.
    
    Feature: shareable-project-urls, Property 6: Link Management State Consistency
    **Validates: Requirements 6.2, 6.3**
    """
    # Setup
    mock_db = MockDatabase()
    generator = ShareLinkGenerator(db_session=mock_db)
    
    # Create a share link
    share = create_test_share_link(
        mock_db,
        share_params["project_id"],
        share_params["creator_id"],
        share_params["permission_level"],
        share_params["expiry_days"]
    )
    
    share_id = UUID(share["id"])
    
    # Query initial state
    initial_result = mock_db.table("project_shares").select("*").eq("id", str(share_id)).execute()
    initial_state = initial_result.data[0]
    
    # Property: Initial state must be active
    assert initial_state["is_active"] is True, "Initial state must be active"
    
    # Revoke the link
    asyncio.run(generator.revoke_share_link(
        share_id,
        uuid4(),
        "Test revocation"
    ))
    
    # Query state immediately after revocation
    after_revoke_result = mock_db.table("project_shares").select("*").eq("id", str(share_id)).execute()
    after_revoke_state = after_revoke_result.data[0]
    
    # Property: State change must be immediately visible
    assert after_revoke_state["is_active"] is False, \
        "Revocation must be immediately visible"
    assert after_revoke_state.get("revoked_at") is not None, \
        "Revocation timestamp must be immediately visible"


@given(share_link_strategy())
@settings(max_examples=100, deadline=None)
def test_property6_concurrent_operations_maintain_consistency(share_params):
    """
    Property 6: Link Management State Consistency
    
    For any share link, multiple operations should maintain consistency.
    The final state should reflect the last operation performed.
    
    Feature: shareable-project-urls, Property 6: Link Management State Consistency
    **Validates: Requirements 6.2, 6.3**
    """
    # Setup
    mock_db = MockDatabase()
    generator = ShareLinkGenerator(db_session=mock_db)
    
    # Create a share link
    share = create_test_share_link(
        mock_db,
        share_params["project_id"],
        share_params["creator_id"],
        share_params["permission_level"],
        share_params["expiry_days"]
    )
    
    share_id = UUID(share["id"])
    
    # Perform multiple operations
    # 1. Extend expiry
    extend_result = asyncio.run(generator.extend_expiry(share_id, 7))
    assert extend_result is not None, "First extension must succeed"
    
    # 2. Extend again
    extend_result2 = asyncio.run(generator.extend_expiry(share_id, 14))
    assert extend_result2 is not None, "Second extension must succeed"
    
    # 3. Revoke
    revoke_result = asyncio.run(generator.revoke_share_link(
        share_id,
        uuid4(),
        "Final revocation"
    ))
    assert revoke_result is True, "Revocation must succeed"
    
    # Property: Final state must be revoked (inactive)
    final_result = mock_db.table("project_shares").select("*").eq("id", str(share_id)).execute()
    final_state = final_result.data[0]
    
    assert final_state["is_active"] is False, \
        "Final state must reflect revocation"
    assert final_state.get("revoked_at") is not None, \
        "Revocation must be recorded"
    
    # 4. Attempt to extend after revocation
    extend_after_revoke = asyncio.run(generator.extend_expiry(share_id, 7))
    
    # Property: Extension after revocation must fail
    assert extend_after_revoke is None, \
        "Extension after revocation must fail"
    
    # Property: State must remain revoked
    still_revoked = asyncio.run(validate_share_link_state(
        mock_db,
        str(share_id),
        expected_is_active=False,
        expected_revoked=True
    ))
    assert still_revoked, "State must remain revoked after failed extension"



@given(share_link_strategy())
@settings(max_examples=100, deadline=None)
def test_property6_revocation_updates_all_metadata_fields(share_params):
    """
    Property 6: Link Management State Consistency
    
    For any share link revocation, all required metadata fields must be updated:
    - is_active set to False
    - revoked_at timestamp set
    - revoked_by user ID set
    - revocation_reason recorded
    - updated_at timestamp updated
    
    Feature: shareable-project-urls, Property 6: Link Management State Consistency
    **Validates: Requirements 6.2, 6.3**
    """
    # Setup
    mock_db = MockDatabase()
    generator = ShareLinkGenerator(db_session=mock_db)
    
    # Create a share link
    share = create_test_share_link(
        mock_db,
        share_params["project_id"],
        share_params["creator_id"],
        share_params["permission_level"],
        share_params["expiry_days"]
    )
    
    share_id = UUID(share["id"])
    revoker_id = uuid4()
    revocation_reason = "Comprehensive metadata test"
    original_updated_at = share["updated_at"]
    
    # Revoke the link
    asyncio.run(generator.revoke_share_link(
        share_id,
        revoker_id,
        revocation_reason
    ))
    
    # Query the revoked link
    result = mock_db.table("project_shares").select("*").eq("id", str(share_id)).execute()
    revoked_share = result.data[0]
    
    # Property: is_active must be False
    assert revoked_share["is_active"] is False, \
        "is_active must be set to False"
    
    # Property: revoked_at must be set
    assert revoked_share.get("revoked_at") is not None, \
        "revoked_at timestamp must be set"
    
    # Property: revoked_at must be a valid ISO timestamp
    try:
        revoked_at = datetime.fromisoformat(revoked_share["revoked_at"])
        assert revoked_at <= datetime.now(), \
            "revoked_at must not be in the future"
    except (ValueError, TypeError):
        pytest.fail("revoked_at must be a valid ISO timestamp")
    
    # Property: revoked_by must be set correctly
    assert revoked_share.get("revoked_by") == str(revoker_id), \
        "revoked_by must be set to the revoker's user ID"
    
    # Property: revocation_reason must be recorded
    assert revoked_share.get("revocation_reason") == revocation_reason, \
        "revocation_reason must be recorded correctly"
    
    # Property: updated_at must be updated
    assert revoked_share["updated_at"] != original_updated_at, \
        "updated_at timestamp must be updated"


@given(share_link_strategy(), st.integers(min_value=1, max_value=365))
@settings(max_examples=100, deadline=None)
def test_property6_expiry_extension_updates_timestamps(share_params, additional_days):
    """
    Property 6: Link Management State Consistency
    
    For any expiry extension, the expires_at and updated_at timestamps must be updated.
    The extension must add exactly the specified number of days to the current expiry.
    
    Feature: shareable-project-urls, Property 6: Link Management State Consistency
    **Validates: Requirements 6.2, 6.3**
    """
    # Setup
    mock_db = MockDatabase()
    generator = ShareLinkGenerator(db_session=mock_db)
    
    # Create a share link
    share = create_test_share_link(
        mock_db,
        share_params["project_id"],
        share_params["creator_id"],
        share_params["permission_level"],
        share_params["expiry_days"]
    )
    
    share_id = UUID(share["id"])
    original_expires_at = datetime.fromisoformat(share["expires_at"])
    original_updated_at = share["updated_at"]
    
    # Extend expiry
    result = asyncio.run(generator.extend_expiry(share_id, additional_days))
    
    # Property: Extension must succeed
    assert result is not None, "Extension must succeed"
    
    # Query the extended link
    db_result = mock_db.table("project_shares").select("*").eq("id", str(share_id)).execute()
    extended_share = db_result.data[0]
    
    # Property: expires_at must be updated
    new_expires_at = datetime.fromisoformat(extended_share["expires_at"])
    expected_expires_at = original_expires_at + timedelta(days=additional_days)
    
    time_diff = abs((new_expires_at - expected_expires_at).total_seconds())
    assert time_diff < 2, \
        f"expires_at must be extended by exactly {additional_days} days (diff: {time_diff}s)"
    
    # Property: updated_at must be updated
    assert extended_share["updated_at"] != original_updated_at, \
        "updated_at timestamp must be updated"
    
    # Property: Other fields must remain unchanged
    assert extended_share["is_active"] == share["is_active"], \
        "is_active must not change during extension"
    assert extended_share["token"] == share["token"], \
        "token must not change during extension"
    assert extended_share["permission_level"] == share["permission_level"], \
        "permission_level must not change during extension"


@given(st.lists(share_link_strategy(), min_size=1, max_size=50))
@settings(max_examples=30, deadline=None)
def test_property6_bulk_operations_respect_max_limit(share_links_list):
    """
    Property 6: Link Management State Consistency
    
    For any bulk operation, the system must respect the maximum limit of 50 links.
    Operations with more than 50 links should process only the first 50.
    
    Feature: shareable-project-urls, Property 6: Link Management State Consistency
    **Validates: Requirements 6.2, 6.3**
    """
    # Setup
    mock_db = MockDatabase()
    generator = ShareLinkGenerator(db_session=mock_db)
    
    # Create share links
    share_ids = []
    for link_params in share_links_list:
        share = create_test_share_link(
            mock_db,
            link_params["project_id"],
            link_params["creator_id"],
            link_params["permission_level"],
            link_params["expiry_days"]
        )
        share_ids.append(UUID(share["id"]))
    
    user_id = share_links_list[0]["creator_id"]
    
    # Perform bulk revocation
    result = asyncio.run(generator.bulk_revoke_share_links(
        share_ids,
        user_id,
        "Bulk limit test"
    ))
    
    # Property: Total processed must not exceed 50
    assert result["total_processed"] <= 50, \
        "Bulk operations must not process more than 50 links"
    
    # Property: If input > 50, only first 50 should be processed
    if len(share_ids) > 50:
        assert result["total_processed"] == 50, \
            "When input exceeds 50, exactly 50 links should be processed"
    else:
        assert result["total_processed"] == len(share_ids), \
            "When input <= 50, all links should be processed"


# ============================================================================
# Edge Case Tests
# ============================================================================

def test_property6_empty_bulk_operations_return_empty_results():
    """
    Property 6: Link Management State Consistency
    
    Bulk operations with empty input should return empty results without errors.
    
    Feature: shareable-project-urls, Property 6: Link Management State Consistency
    **Validates: Requirements 6.2, 6.3**
    """
    mock_db = MockDatabase()
    generator = ShareLinkGenerator(db_session=mock_db)
    
    # Test bulk revoke with empty list
    result = asyncio.run(generator.bulk_revoke_share_links(
        [],
        uuid4(),
        "Empty test"
    ))
    
    assert result["total_processed"] == 0, "Empty input should process 0 links"
    assert result["success_count"] == 0, "Empty input should have 0 successes"
    assert result["failure_count"] == 0, "Empty input should have 0 failures"
    assert len(result["successful"]) == 0, "Successful list should be empty"
    assert len(result["failed"]) == 0, "Failed list should be empty"


def test_property6_invalid_expiry_days_rejected():
    """
    Property 6: Link Management State Consistency
    
    Expiry extension with invalid days (< 1 or > 365) should be rejected.
    
    Feature: shareable-project-urls, Property 6: Link Management State Consistency
    **Validates: Requirements 6.2, 6.3**
    """
    mock_db = MockDatabase()
    generator = ShareLinkGenerator(db_session=mock_db)
    
    # Create a share link
    share = create_test_share_link(
        mock_db,
        uuid4(),
        uuid4(),
        SharePermissionLevel.VIEW_ONLY,
        7
    )
    
    share_id = UUID(share["id"])
    
    # Test invalid days (0)
    result_zero = asyncio.run(generator.extend_expiry(share_id, 0))
    assert result_zero is None, "Extension with 0 days must be rejected"
    
    # Test invalid days (366)
    result_too_many = asyncio.run(generator.extend_expiry(share_id, 366))
    assert result_too_many is None, "Extension with > 365 days must be rejected"
    
    # Test negative days
    result_negative = asyncio.run(generator.extend_expiry(share_id, -1))
    assert result_negative is None, "Extension with negative days must be rejected"


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])
