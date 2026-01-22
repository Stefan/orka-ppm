"""
Property-based tests for WBS Code Uniqueness.

These tests validate Property 4: WBS Code Uniqueness from the
Integrated Master Schedule System design document.

**Property 4: WBS Code Uniqueness**
For any WBS structure within a project scope, WBS codes should be unique
and follow standard numbering conventions.

**Validates: Requirements 2.4**
"""

import sys
import os
import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Dict, Any, Optional, Set, Tuple
from uuid import uuid4, UUID
import re

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


class WBSCodeValidator:
    """
    Pure implementation of WBS code validation for property testing.
    
    This mirrors the logic in WBSManager but is isolated for testing
    without database dependencies.
    """
    
    # Standard WBS code patterns
    WBS_CODE_PATTERN = re.compile(r'^(\d+)(\.(\d+))*$')
    
    @staticmethod
    def is_valid_wbs_code(code: str) -> bool:
        """
        Validate that a WBS code follows standard numbering conventions.
        
        Valid WBS codes:
        - "1", "2", "10" (root level)
        - "1.1", "1.2", "2.1" (second level)
        - "1.1.1", "1.2.3", "10.5.2" (third level and beyond)
        
        Args:
            code: WBS code to validate
            
        Returns:
            bool: True if valid, False otherwise
        """
        if not code or not isinstance(code, str):
            return False
        
        # Check against pattern
        if not WBSCodeValidator.WBS_CODE_PATTERN.match(code):
            return False
        
        # Check that no segment is empty or starts with 0 (except "0" itself)
        segments = code.split('.')
        for segment in segments:
            if not segment:
                return False
            # Allow "0" as a valid segment but not "01", "001", etc.
            if len(segment) > 1 and segment.startswith('0'):
                return False
        
        return True
    
    @staticmethod
    def generate_wbs_code(parent_code: Optional[str], position: int) -> str:
        """
        Generate a WBS code based on parent code and position.
        
        Args:
            parent_code: WBS code of the parent element (None for root)
            position: Position within the parent's children (1-based)
            
        Returns:
            str: Generated WBS code
        """
        if position < 1:
            raise ValueError("Position must be >= 1")
        
        if parent_code is None:
            return str(position)
        else:
            return f"{parent_code}.{position}"
    
    @staticmethod
    def get_parent_code(wbs_code: str) -> Optional[str]:
        """
        Extract the parent WBS code from a given code.
        
        Args:
            wbs_code: WBS code to extract parent from
            
        Returns:
            Optional[str]: Parent code or None if root level
        """
        if not wbs_code or '.' not in wbs_code:
            return None
        
        return '.'.join(wbs_code.split('.')[:-1])
    
    @staticmethod
    def get_level(wbs_code: str) -> int:
        """
        Get the hierarchy level of a WBS code.
        
        Args:
            wbs_code: WBS code to check
            
        Returns:
            int: Level number (1 for root, 2 for first children, etc.)
        """
        if not wbs_code:
            return 0
        
        return len(wbs_code.split('.'))
    
    @staticmethod
    def are_codes_unique(codes: List[str]) -> bool:
        """
        Check if all WBS codes in a list are unique.
        
        Args:
            codes: List of WBS codes
            
        Returns:
            bool: True if all codes are unique
        """
        return len(codes) == len(set(codes))
    
    @staticmethod
    def is_valid_hierarchy(codes: List[str]) -> Tuple[bool, List[str]]:
        """
        Validate that WBS codes form a valid hierarchy.
        
        Rules:
        - All codes must be valid
        - All codes must be unique
        - Child codes must have existing parent codes (except root)
        
        Args:
            codes: List of WBS codes
            
        Returns:
            Tuple[bool, List[str]]: (is_valid, list of errors)
        """
        errors = []
        
        # Check all codes are valid
        for code in codes:
            if not WBSCodeValidator.is_valid_wbs_code(code):
                errors.append(f"Invalid WBS code format: {code}")
        
        # Check uniqueness
        if not WBSCodeValidator.are_codes_unique(codes):
            duplicates = [c for c in codes if codes.count(c) > 1]
            errors.append(f"Duplicate WBS codes found: {set(duplicates)}")
        
        # Check hierarchy integrity
        code_set = set(codes)
        for code in codes:
            parent = WBSCodeValidator.get_parent_code(code)
            if parent and parent not in code_set:
                errors.append(f"WBS code {code} has missing parent {parent}")
        
        return len(errors) == 0, errors


class WBSStructureGenerator:
    """
    Generates valid WBS structures for property testing.
    """
    
    @staticmethod
    def generate_valid_hierarchy(
        max_depth: int = 4,
        max_children_per_level: int = 5
    ) -> List[str]:
        """
        Generate a valid WBS hierarchy.
        
        Args:
            max_depth: Maximum depth of the hierarchy
            max_children_per_level: Maximum children per parent
            
        Returns:
            List[str]: List of valid WBS codes
        """
        import random
        
        codes = []
        
        # Generate root level elements
        num_roots = random.randint(1, max_children_per_level)
        for i in range(1, num_roots + 1):
            codes.append(str(i))
        
        # Generate children for each level
        current_level_codes = codes.copy()
        
        for depth in range(2, max_depth + 1):
            next_level_codes = []
            
            for parent_code in current_level_codes:
                # Randomly decide how many children this parent has
                num_children = random.randint(0, max_children_per_level)
                
                for i in range(1, num_children + 1):
                    child_code = f"{parent_code}.{i}"
                    codes.append(child_code)
                    next_level_codes.append(child_code)
            
            if not next_level_codes:
                break
            
            current_level_codes = next_level_codes
        
        return codes


# Hypothesis strategies for generating test data
@st.composite
def valid_wbs_code_strategy(draw):
    """Generate a valid WBS code."""
    depth = draw(st.integers(min_value=1, max_value=6))
    segments = []
    
    for _ in range(depth):
        segment = draw(st.integers(min_value=1, max_value=99))
        segments.append(str(segment))
    
    return '.'.join(segments)


@st.composite
def wbs_code_segments_strategy(draw, min_depth=1, max_depth=5):
    """Generate WBS code segments as a list of integers."""
    depth = draw(st.integers(min_value=min_depth, max_value=max_depth))
    return [draw(st.integers(min_value=1, max_value=20)) for _ in range(depth)]


@st.composite
def valid_wbs_hierarchy_strategy(draw, max_elements=20):
    """Generate a valid WBS hierarchy."""
    num_roots = draw(st.integers(min_value=1, max_value=5))
    codes = [str(i) for i in range(1, num_roots + 1)]
    
    # Add children to some elements
    remaining = max_elements - num_roots
    current_codes = codes.copy()
    
    while remaining > 0 and current_codes:
        parent = draw(st.sampled_from(current_codes))
        num_children = draw(st.integers(min_value=0, max_value=min(3, remaining)))
        
        if num_children > 0:
            # Find existing children of this parent
            existing_children = [c for c in codes if WBSCodeValidator.get_parent_code(c) == parent]
            next_position = len(existing_children) + 1
            
            new_children = []
            for i in range(num_children):
                child_code = f"{parent}.{next_position + i}"
                codes.append(child_code)
                new_children.append(child_code)
                remaining -= 1
            
            current_codes.extend(new_children)
        
        # Remove parent from consideration to avoid infinite loops
        if parent in current_codes:
            current_codes.remove(parent)
    
    return codes


class TestWBSCodeUniquenessProperties:
    """Property-based tests for WBS code uniqueness."""
    
    def setup_method(self):
        """Set up test environment."""
        self.validator = WBSCodeValidator()
    
    @given(valid_wbs_code_strategy())
    @settings(max_examples=100)
    def test_property_4_valid_code_format(self, wbs_code: str):
        """
        Property 4.1: Valid Code Format
        
        All generated WBS codes should follow the standard numbering convention
        (dot-separated positive integers).
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        assert self.validator.is_valid_wbs_code(wbs_code), \
            f"Generated WBS code '{wbs_code}' should be valid"
    
    @given(wbs_code_segments_strategy())
    @settings(max_examples=100)
    def test_property_4_code_generation_produces_valid_codes(self, segments: List[int]):
        """
        Property 4.2: Code Generation Produces Valid Codes
        
        The WBS code generation function should always produce valid codes
        when given valid inputs.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        # Build code incrementally using generate_wbs_code
        parent_code = None
        
        for position in segments:
            generated_code = self.validator.generate_wbs_code(parent_code, position)
            
            assert self.validator.is_valid_wbs_code(generated_code), \
                f"Generated code '{generated_code}' should be valid"
            
            parent_code = generated_code
    
    @given(valid_wbs_hierarchy_strategy(max_elements=30))
    @settings(max_examples=100)
    def test_property_4_hierarchy_codes_are_unique(self, codes: List[str]):
        """
        Property 4.3: Hierarchy Codes Are Unique
        
        Within any valid WBS hierarchy, all codes must be unique.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        assert self.validator.are_codes_unique(codes), \
            f"WBS codes should be unique within hierarchy: {codes}"
    
    @given(
        st.text(min_size=0, max_size=20, alphabet=st.characters(whitelist_categories=('L', 'N', 'P')))
    )
    @settings(max_examples=100)
    def test_property_4_invalid_codes_rejected(self, invalid_code: str):
        """
        Property 4.4: Invalid Codes Rejected
        
        Codes that don't follow the standard numbering convention should be
        rejected by validation.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        # Skip if the random string happens to be a valid WBS code
        assume(not re.match(r'^(\d+)(\.(\d+))*$', invalid_code))
        
        assert not self.validator.is_valid_wbs_code(invalid_code), \
            f"Invalid code '{invalid_code}' should be rejected"
    
    @given(
        st.lists(valid_wbs_code_strategy(), min_size=2, max_size=10, unique=False)
    )
    @settings(max_examples=100)
    def test_property_4_duplicate_detection(self, codes: List[str]):
        """
        Property 4.5: Duplicate Detection
        
        The uniqueness check should correctly identify when duplicate codes exist.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        has_duplicates = len(codes) != len(set(codes))
        uniqueness_check = self.validator.are_codes_unique(codes)
        
        assert uniqueness_check != has_duplicates, \
            f"Uniqueness check should correctly identify duplicates in {codes}"
    
    @given(valid_wbs_code_strategy())
    @settings(max_examples=100)
    def test_property_4_parent_code_extraction(self, wbs_code: str):
        """
        Property 4.6: Parent Code Extraction
        
        For any valid WBS code, extracting the parent code should produce
        either None (for root) or another valid WBS code.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        parent_code = self.validator.get_parent_code(wbs_code)
        
        if parent_code is not None:
            assert self.validator.is_valid_wbs_code(parent_code), \
                f"Parent code '{parent_code}' of '{wbs_code}' should be valid"
            
            # Parent should be shorter than child
            assert len(parent_code) < len(wbs_code), \
                f"Parent '{parent_code}' should be shorter than child '{wbs_code}'"
    
    @given(
        st.one_of(st.none(), valid_wbs_code_strategy()),
        st.integers(min_value=1, max_value=100)
    )
    @settings(max_examples=100)
    def test_property_4_code_generation_deterministic(
        self, 
        parent_code: Optional[str], 
        position: int
    ):
        """
        Property 4.7: Code Generation Is Deterministic
        
        Given the same parent code and position, code generation should
        always produce the same result.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        result1 = self.validator.generate_wbs_code(parent_code, position)
        result2 = self.validator.generate_wbs_code(parent_code, position)
        result3 = self.validator.generate_wbs_code(parent_code, position)
        
        assert result1 == result2 == result3, \
            f"Code generation should be deterministic: {result1}, {result2}, {result3}"
    
    @given(valid_wbs_code_strategy())
    @settings(max_examples=100)
    def test_property_4_level_calculation_consistency(self, wbs_code: str):
        """
        Property 4.8: Level Calculation Consistency
        
        The level of a WBS code should equal the number of segments
        (dot-separated parts).
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        level = self.validator.get_level(wbs_code)
        expected_level = len(wbs_code.split('.'))
        
        assert level == expected_level, \
            f"Level {level} should equal segment count {expected_level} for '{wbs_code}'"
    
    @given(
        st.one_of(st.none(), valid_wbs_code_strategy()),
        st.integers(min_value=1, max_value=50)
    )
    @settings(max_examples=100)
    def test_property_4_child_level_is_parent_plus_one(
        self, 
        parent_code: Optional[str], 
        position: int
    ):
        """
        Property 4.9: Child Level Is Parent Plus One
        
        A generated child code should have a level exactly one greater
        than its parent.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        child_code = self.validator.generate_wbs_code(parent_code, position)
        
        parent_level = self.validator.get_level(parent_code) if parent_code else 0
        child_level = self.validator.get_level(child_code)
        
        assert child_level == parent_level + 1, \
            f"Child level {child_level} should be parent level {parent_level} + 1"
    
    @given(valid_wbs_hierarchy_strategy(max_elements=20))
    @settings(max_examples=100)
    def test_property_4_hierarchy_validation(self, codes: List[str]):
        """
        Property 4.10: Hierarchy Validation
        
        A valid WBS hierarchy should pass all validation checks.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        is_valid, errors = self.validator.is_valid_hierarchy(codes)
        
        assert is_valid, \
            f"Valid hierarchy should pass validation. Errors: {errors}"
    
    @given(
        st.lists(st.integers(min_value=1, max_value=10), min_size=1, max_size=5)
    )
    @settings(max_examples=100)
    def test_property_4_sibling_codes_are_unique(self, positions: List[int]):
        """
        Property 4.11: Sibling Codes Are Unique
        
        When generating codes for siblings (same parent, different positions),
        all codes should be unique.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        parent_code = "1.2"  # Fixed parent for testing
        
        # Generate sibling codes
        sibling_codes = [
            self.validator.generate_wbs_code(parent_code, pos) 
            for pos in positions
        ]
        
        # Unique positions should produce unique codes
        unique_positions = list(set(positions))
        unique_codes = list(set(sibling_codes))
        
        assert len(unique_positions) == len(unique_codes), \
            f"Unique positions should produce unique codes: {sibling_codes}"


class TestWBSCodeEdgeCases:
    """Edge case tests for WBS code validation."""
    
    def setup_method(self):
        """Set up test environment."""
        self.validator = WBSCodeValidator()
    
    def test_empty_code_invalid(self):
        """
        Empty string should be invalid.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        assert not self.validator.is_valid_wbs_code("")
        assert not self.validator.is_valid_wbs_code(None)
    
    def test_leading_zeros_invalid(self):
        """
        Codes with leading zeros in segments should be invalid.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        assert not self.validator.is_valid_wbs_code("01")
        assert not self.validator.is_valid_wbs_code("1.01")
        assert not self.validator.is_valid_wbs_code("1.2.03")
    
    def test_zero_segment_valid(self):
        """
        Single zero as a segment should be valid.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        assert self.validator.is_valid_wbs_code("0")
        assert self.validator.is_valid_wbs_code("1.0")
        assert self.validator.is_valid_wbs_code("1.2.0")
    
    def test_special_characters_invalid(self):
        """
        Codes with special characters should be invalid.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        assert not self.validator.is_valid_wbs_code("1-2")
        assert not self.validator.is_valid_wbs_code("1_2")
        assert not self.validator.is_valid_wbs_code("1/2")
        assert not self.validator.is_valid_wbs_code("1 2")
        assert not self.validator.is_valid_wbs_code("1.2.a")
    
    def test_trailing_dot_invalid(self):
        """
        Codes with trailing dots should be invalid.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        assert not self.validator.is_valid_wbs_code("1.")
        assert not self.validator.is_valid_wbs_code("1.2.")
    
    def test_leading_dot_invalid(self):
        """
        Codes with leading dots should be invalid.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        assert not self.validator.is_valid_wbs_code(".1")
        assert not self.validator.is_valid_wbs_code(".1.2")
    
    def test_double_dots_invalid(self):
        """
        Codes with consecutive dots should be invalid.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        assert not self.validator.is_valid_wbs_code("1..2")
        assert not self.validator.is_valid_wbs_code("1.2..3")
    
    def test_position_zero_raises_error(self):
        """
        Position 0 or negative should raise an error.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        with pytest.raises(ValueError):
            self.validator.generate_wbs_code("1", 0)
        
        with pytest.raises(ValueError):
            self.validator.generate_wbs_code("1", -1)
    
    def test_deep_hierarchy_valid(self):
        """
        Deep hierarchies should be valid.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        deep_code = "1.2.3.4.5.6.7.8.9.10"
        assert self.validator.is_valid_wbs_code(deep_code)
        assert self.validator.get_level(deep_code) == 10
    
    def test_large_numbers_valid(self):
        """
        Large segment numbers should be valid.
        
        **Feature: integrated-master-schedule, Property 4: WBS Code Uniqueness**
        **Validates: Requirements 2.4**
        """
        assert self.validator.is_valid_wbs_code("999")
        assert self.validator.is_valid_wbs_code("1.999.999")
        assert self.validator.is_valid_wbs_code("12345.67890")


def run_property_tests():
    """Run all property-based tests."""
    print("🚀 Running WBS Code Uniqueness Property Tests")
    print("=" * 60)
    print("Property 4: WBS Code Uniqueness")
    print("Validates: Requirements 2.4")
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
        print("\n🎉 All WBS code uniqueness property tests passed!")
    else:
        print("\n❌ Some property tests failed.")
    
    sys.exit(0 if success else 1)
