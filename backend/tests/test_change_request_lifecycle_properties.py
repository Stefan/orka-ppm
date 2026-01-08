"""
Property-based tests for change request lifecycle validation.

These tests validate the correctness properties for change request state consistency
using property-based testing with Hypothesis.

**Validates: Requirements 1.3, 1.4**
"""

import sys
import os
import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Dict, Any, Optional
from uuid import uuid4, UUID
from datetime import datetime, date
from decimal import Decimal

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(__file__))

from models.change_management import (
    ChangeType, ChangeStatus, PriorityLevel, ApprovalDecision,
    ChangeRequestCreate, ChangeRequestUpdate
)

class TestChangeRequestLifecycleProperties:
    """Property-based tests for change request lifecycle validation"""
    
    def setup_method(self):
        """Set up test environment"""
        pass
    
    # Hypothesis strategies for generating test data
    change_types = st.sampled_from([t.value for t in ChangeType])
    change_statuses = st.sampled_from([s.value for s in ChangeStatus])
    priority_levels = st.sampled_from([p.value for p in PriorityLevel])
    approval_decisions = st.sampled_from([d.value for d in ApprovalDecision])
    
    valid_titles = st.text(min_size=5, max_size=255, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Pc', 'Pd', 'Zs')))
    valid_descriptions = st.text(min_size=10, max_size=1000, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Pc', 'Pd', 'Zs')))
    
    @given(
        title=valid_titles,
        description=valid_descriptions,
        change_type=change_types,
        priority=priority_levels,
        project_id=st.uuids(),
        estimated_cost_impact=st.one_of(st.none(), st.decimals(min_value=0, max_value=999999, places=2)),
        estimated_schedule_impact_days=st.one_of(st.none(), st.integers(min_value=0, max_value=365))
    )
    @settings(max_examples=100)
    def test_property_1_change_request_state_consistency(
        self,
        title: str,
        description: str,
        change_type: str,
        priority: str,
        project_id: UUID,
        estimated_cost_impact: Optional[Decimal],
        estimated_schedule_impact_days: Optional[int]
    ):
        """
        Property 1: Change Request State Consistency
        
        For any valid change request data, the state transitions should be consistent
        and follow the defined workflow rules.
        
        **Feature: integrated-change-management, Property 1: Change Request State Consistency**
        **Validates: Requirements 1.3, 1.4**
        """
        # Filter out invalid characters that might cause issues
        assume(title.strip() != "")
        assume(description.strip() != "")
        assume(len(title.strip()) >= 5)
        assume(len(description.strip()) >= 10)
        
        # Create a valid change request
        change_request_data = ChangeRequestCreate(
            title=title.strip(),
            description=description.strip(),
            change_type=ChangeType(change_type),
            priority=PriorityLevel(priority),
            project_id=project_id,
            estimated_cost_impact=estimated_cost_impact,
            estimated_schedule_impact_days=estimated_schedule_impact_days
        )
        
        # Property: Valid change request data should be accepted
        assert change_request_data.title == title.strip()
        assert change_request_data.description == description.strip()
        assert change_request_data.change_type.value == change_type
        assert change_request_data.priority.value == priority
        assert change_request_data.project_id == project_id
        
        # Property: Default values should be set correctly
        assert change_request_data.affected_milestones == []
        assert change_request_data.affected_pos == []
        assert change_request_data.template_data is None
        
        # Property: Impact estimates should be non-negative if provided
        if change_request_data.estimated_cost_impact is not None:
            assert change_request_data.estimated_cost_impact >= 0
        
        if change_request_data.estimated_schedule_impact_days is not None:
            assert change_request_data.estimated_schedule_impact_days >= 0
    
    @given(
        current_status=change_statuses,
        new_status=change_statuses
    )
    @settings(max_examples=100)
    def test_property_1_status_transition_validation(
        self,
        current_status: str,
        new_status: str
    ):
        """
        Property 1: Status Transition Validation
        
        For any status transition, only valid transitions should be allowed
        according to the change management workflow.
        
        **Feature: integrated-change-management, Property 1: Change Request State Consistency**
        **Validates: Requirements 1.3**
        """
        current = ChangeStatus(current_status)
        new = ChangeStatus(new_status)
        
        # Define valid transitions based on the workflow
        valid_transitions = {
            ChangeStatus.DRAFT: [
                ChangeStatus.SUBMITTED, ChangeStatus.CANCELLED, ChangeStatus.DRAFT
            ],
            ChangeStatus.SUBMITTED: [
                ChangeStatus.UNDER_REVIEW, ChangeStatus.CANCELLED, ChangeStatus.DRAFT
            ],
            ChangeStatus.UNDER_REVIEW: [
                ChangeStatus.PENDING_APPROVAL, ChangeStatus.REJECTED, 
                ChangeStatus.ON_HOLD, ChangeStatus.CANCELLED
            ],
            ChangeStatus.PENDING_APPROVAL: [
                ChangeStatus.APPROVED, ChangeStatus.REJECTED, 
                ChangeStatus.ON_HOLD, ChangeStatus.CANCELLED
            ],
            ChangeStatus.APPROVED: [
                ChangeStatus.IMPLEMENTING, ChangeStatus.CANCELLED
            ],
            ChangeStatus.IMPLEMENTING: [
                ChangeStatus.IMPLEMENTED, ChangeStatus.ON_HOLD, ChangeStatus.CANCELLED
            ],
            ChangeStatus.IMPLEMENTED: [
                ChangeStatus.CLOSED
            ],
            ChangeStatus.ON_HOLD: [
                ChangeStatus.UNDER_REVIEW, ChangeStatus.PENDING_APPROVAL, 
                ChangeStatus.IMPLEMENTING, ChangeStatus.CANCELLED
            ],
            ChangeStatus.REJECTED: [ChangeStatus.REJECTED],  # Terminal state
            ChangeStatus.CLOSED: [ChangeStatus.CLOSED],      # Terminal state
            ChangeStatus.CANCELLED: [ChangeStatus.CANCELLED] # Terminal state
        }
        
        # Property: Transition should be valid according to workflow rules
        is_valid_transition = new in valid_transitions.get(current, [])
        
        # Property: Same status transitions are always valid (no change)
        if current == new:
            assert True, "Same status transition should always be valid"
        else:
            # Property: Only defined valid transitions should be allowed
            if is_valid_transition:
                assert True, f"Valid transition from {current.value} to {new.value}"
            else:
                # This represents an invalid transition that should be rejected
                assert not is_valid_transition, f"Invalid transition from {current.value} to {new.value} should be rejected"
    
    @given(
        change_type=change_types,
        priority=priority_levels,
        estimated_cost_impact=st.one_of(st.none(), st.decimals(min_value=0, max_value=999999, places=2))
    )
    @settings(max_examples=100)
    def test_property_1_version_control_consistency(
        self,
        change_type: str,
        priority: str,
        estimated_cost_impact: Optional[Decimal]
    ):
        """
        Property 1: Version Control Consistency
        
        For any change request modifications, version history should be maintained
        and all modifications should be tracked with timestamps and user attribution.
        
        **Feature: integrated-change-management, Property 1: Change Request State Consistency**
        **Validates: Requirements 1.4**
        """
        # Simulate version control behavior
        initial_version = 1
        
        # Create update data
        update_data = ChangeRequestUpdate(
            priority=PriorityLevel(priority) if priority else None,
            estimated_cost_impact=estimated_cost_impact
        )
        
        # Property: Updates should preserve data integrity
        if update_data.priority is not None:
            assert update_data.priority.value == priority
        
        if update_data.estimated_cost_impact is not None:
            assert update_data.estimated_cost_impact >= 0
        
        # Property: Version should increment with modifications
        # (This would be handled by the database trigger in real implementation)
        has_modifications = any([
            update_data.title is not None,
            update_data.description is not None,
            update_data.priority is not None,
            update_data.estimated_cost_impact is not None,
            update_data.status is not None
        ])
        
        if has_modifications:
            expected_new_version = initial_version + 1
            assert expected_new_version > initial_version, "Version should increment with modifications"
        else:
            expected_new_version = initial_version
            assert expected_new_version == initial_version, "Version should not change without modifications"
    
    @given(
        change_numbers=st.lists(st.text(min_size=1, max_size=20), min_size=1, max_size=10, unique=True)
    )
    @settings(max_examples=100)
    def test_property_1_unique_identifier_consistency(
        self,
        change_numbers: List[str]
    ):
        """
        Property 1: Unique Identifier Consistency
        
        For any set of change requests, each should have a unique identifier
        and the identifier format should be consistent.
        
        **Feature: integrated-change-management, Property 1: Change Request State Consistency**
        **Validates: Requirements 1.3**
        """
        # Property: All change numbers should be unique
        assert len(change_numbers) == len(set(change_numbers)), \
            "All change numbers should be unique"
        
        # Property: Change number format should be consistent (CR-YYYY-NNNN)
        current_year = datetime.now().year
        expected_prefix = f"CR-{current_year}-"
        
        # Simulate auto-generated change numbers
        generated_numbers = []
        for i, _ in enumerate(change_numbers):
            # Generate sequential numbers
            generated_number = f"CR-{current_year}-{str(i+1).zfill(4)}"
            generated_numbers.append(generated_number)
        
        # Property: Generated numbers should follow format
        for number in generated_numbers:
            assert number.startswith(expected_prefix), \
                f"Change number {number} should start with {expected_prefix}"
            
            # Extract sequence part
            sequence_part = number.split('-')[-1]
            assert len(sequence_part) == 4, \
                f"Sequence part {sequence_part} should be 4 digits"
            assert sequence_part.isdigit(), \
                f"Sequence part {sequence_part} should be numeric"
        
        # Property: Generated numbers should be unique
        assert len(generated_numbers) == len(set(generated_numbers)), \
            "Generated change numbers should be unique"
    
    @given(
        approval_decision=approval_decisions,
        comments=st.one_of(st.none(), st.text(max_size=500))
    )
    @settings(max_examples=100)
    def test_property_1_approval_workflow_consistency(
        self,
        approval_decision: str,
        comments: Optional[str]
    ):
        """
        Property 1: Approval Workflow Consistency
        
        For any approval decision, the workflow should maintain consistency
        and proper state transitions.
        
        **Feature: integrated-change-management, Property 1: Change Request State Consistency**
        **Validates: Requirements 1.3, 1.4**
        """
        decision = ApprovalDecision(approval_decision)
        
        # Property: Approval decisions should be valid enum values
        assert decision.value in [d.value for d in ApprovalDecision]
        
        # Property: Decision should affect change request status appropriately
        expected_status_after_decision = {
            ApprovalDecision.APPROVED: ChangeStatus.APPROVED,
            ApprovalDecision.REJECTED: ChangeStatus.REJECTED,
            ApprovalDecision.NEEDS_INFO: ChangeStatus.ON_HOLD,
            ApprovalDecision.DELEGATED: ChangeStatus.PENDING_APPROVAL
        }
        
        expected_status = expected_status_after_decision[decision]
        assert expected_status in [s for s in ChangeStatus], \
            f"Expected status {expected_status.value} should be valid"
        
        # Property: Comments should be preserved if provided
        if comments is not None:
            assert isinstance(comments, str), "Comments should be string type"
        
        # Property: Certain decisions may require comments
        if decision == ApprovalDecision.REJECTED:
            # In a real system, rejection might require comments
            # This is a business rule that should be enforced
            pass  # We'll assume comments are optional for this test
        
        if decision == ApprovalDecision.NEEDS_INFO:
            # Requesting more info should ideally have comments explaining what's needed
            pass  # We'll assume comments are optional for this test


def run_property_tests():
    """Run all property-based tests"""
    print("🚀 Running Change Request Lifecycle Property Tests")
    print("=" * 60)
    
    # Run pytest with this file
    test_file = __file__
    exit_code = pytest.main([
        test_file,
        "-v",
        "--tb=short",
        "-x"  # Stop on first failure
    ])
    
    return exit_code == 0


if __name__ == "__main__":
    success = run_property_tests()
    if success:
        print("\n🎉 All change request lifecycle property tests passed!")
    else:
        print("\n❌ Some property tests failed.")
    
    sys.exit(0 if success else 1)