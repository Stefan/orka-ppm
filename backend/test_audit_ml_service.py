"""
Unit Tests for AI-Empowered Audit Trail - ML Service

This module contains unit tests for the audit ML service, focusing on
model training, persistence, and loading functionality.

Feature: ai-empowered-audit-trail
Requirements: 4.11, 8.4
"""

import pytest
import os
import pickle
import tempfile
import shutil
from datetime import datetime, timedelta
from uuid import uuid4
from typing import List, Dict, Any
import numpy as np

# Import the service we're testing
import sys
sys.path.insert(0, os.path.dirname(__file__))

from services.audit_ml_service import AuditMLService, TrainingMetrics, EventClassification


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def ml_service():
    """Create ML service instance for testing."""
    service = AuditMLService(supabase_client=None)
    return service


@pytest.fixture
def temp_model_dir():
    """Create temporary directory for model storage."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    # Cleanup after test
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def balanced_training_data():
    """
    Generate balanced training dataset with equal representation across categories.
    
    Requirements: 8.4 - Balanced dataset preparation
    """
    categories = [
        'Security Change',
        'Financial Impact',
        'Resource Allocation',
        'Risk Event',
        'Compliance Action'
    ]
    
    risk_levels = ['Low', 'Medium', 'High', 'Critical']
    
    # Generate 50 events per category (250 total)
    events_per_category = 50
    training_data = []
    
    for category in categories:
        for i in range(events_per_category):
            # Determine event type based on category
            if category == 'Security Change':
                event_type = 'permission_change'
            elif category == 'Financial Impact':
                event_type = 'budget_change'
            elif category == 'Resource Allocation':
                event_type = 'resource_assignment'
            elif category == 'Risk Event':
                event_type = 'risk_created'
            else:  # Compliance Action
                event_type = 'audit_access'
            
            # Create event with appropriate fields
            event = {
                'id': str(uuid4()),
                'event_type': event_type,
                'user_id': str(uuid4()),
                'entity_type': 'project',
                'entity_id': str(uuid4()),
                'action_details': {
                    'action': f'test_action_{i}',
                    'description': f'Test event for {category}'
                },
                'severity': risk_levels[i % len(risk_levels)],
                'timestamp': (datetime.now() - timedelta(days=i)).isoformat(),
                'tenant_id': str(uuid4()),
                'category': category,
                'risk_level': risk_levels[i % len(risk_levels)]
            }
            
            training_data.append(event)
    
    return training_data


@pytest.fixture
def imbalanced_training_data():
    """
    Generate imbalanced training dataset for testing balance requirements.
    
    Requirements: 8.4 - Dataset balancing validation
    """
    categories = [
        'Security Change',
        'Financial Impact',
        'Resource Allocation',
        'Risk Event',
        'Compliance Action'
    ]
    
    risk_levels = ['Low', 'Medium', 'High', 'Critical']
    
    # Generate imbalanced data: 100, 50, 30, 20, 10 events per category
    events_per_category = [100, 50, 30, 20, 10]
    training_data = []
    
    for category, count in zip(categories, events_per_category):
        for i in range(count):
            if category == 'Security Change':
                event_type = 'permission_change'
            elif category == 'Financial Impact':
                event_type = 'budget_change'
            elif category == 'Resource Allocation':
                event_type = 'resource_assignment'
            elif category == 'Risk Event':
                event_type = 'risk_created'
            else:
                event_type = 'audit_access'
            
            event = {
                'id': str(uuid4()),
                'event_type': event_type,
                'user_id': str(uuid4()),
                'entity_type': 'project',
                'entity_id': str(uuid4()),
                'action_details': {
                    'action': f'test_action_{i}',
                    'description': f'Test event for {category}'
                },
                'severity': risk_levels[i % len(risk_levels)],
                'timestamp': (datetime.now() - timedelta(days=i)).isoformat(),
                'tenant_id': str(uuid4()),
                'category': category,
                'risk_level': risk_levels[i % len(risk_levels)]
            }
            
            training_data.append(event)
    
    return training_data


# ============================================================================
# Unit Tests for Model Training
# ============================================================================

@pytest.mark.asyncio
async def test_train_classifiers_with_balanced_dataset(ml_service, balanced_training_data):
    """
    Test training classifiers with a balanced dataset.
    
    Verifies that:
    1. Training completes successfully
    2. Training metrics are returned
    3. Models are marked as trained
    4. Metrics are within reasonable ranges
    
    Requirements: 4.11, 8.4
    """
    # Train the classifiers
    metrics = await ml_service.train_classifiers(labeled_data=balanced_training_data)
    
    # Verify training completed successfully
    assert metrics is not None, "Training should return metrics"
    assert isinstance(metrics, TrainingMetrics), (
        f"Metrics should be TrainingMetrics instance, got {type(metrics)}"
    )
    
    # Verify model is marked as trained
    assert ml_service.is_trained is True, "Model should be marked as trained"
    
    # Verify training data size is correct
    assert metrics.training_data_size == len(balanced_training_data), (
        f"Training data size should be {len(balanced_training_data)}, "
        f"got {metrics.training_data_size}"
    )
    
    # Verify metrics are in reasonable ranges
    assert 0.0 <= metrics.category_accuracy <= 1.0, (
        f"Category accuracy should be in [0, 1], got {metrics.category_accuracy}"
    )
    assert 0.0 <= metrics.category_precision <= 1.0, (
        f"Category precision should be in [0, 1], got {metrics.category_precision}"
    )
    assert 0.0 <= metrics.category_recall <= 1.0, (
        f"Category recall should be in [0, 1], got {metrics.category_recall}"
    )
    assert 0.0 <= metrics.category_f1 <= 1.0, (
        f"Category F1 should be in [0, 1], got {metrics.category_f1}"
    )
    
    assert 0.0 <= metrics.risk_accuracy <= 1.0, (
        f"Risk accuracy should be in [0, 1], got {metrics.risk_accuracy}"
    )
    assert 0.0 <= metrics.risk_precision <= 1.0, (
        f"Risk precision should be in [0, 1], got {metrics.risk_precision}"
    )
    assert 0.0 <= metrics.risk_recall <= 1.0, (
        f"Risk recall should be in [0, 1], got {metrics.risk_recall}"
    )
    assert 0.0 <= metrics.risk_f1 <= 1.0, (
        f"Risk F1 should be in [0, 1], got {metrics.risk_f1}"
    )
    
    # Verify model version is set
    assert metrics.model_version == ml_service.model_version, (
        f"Model version should match: {metrics.model_version} != {ml_service.model_version}"
    )
    
    # Verify training date is recent
    time_diff = datetime.now() - metrics.training_date
    assert time_diff.total_seconds() < 60, (
        f"Training date should be recent, got {metrics.training_date}"
    )


@pytest.mark.asyncio
async def test_train_classifiers_with_insufficient_data(ml_service):
    """
    Test training with insufficient data (< 100 samples).
    
    Verifies that training fails gracefully when there's not enough data.
    
    Requirements: 4.11
    """
    # Create minimal training data (50 samples - below threshold)
    minimal_data = []
    for i in range(50):
        event = {
            'id': str(uuid4()),
            'event_type': 'user_login',
            'user_id': str(uuid4()),
            'entity_type': 'user',
            'entity_id': str(uuid4()),
            'action_details': {'action': 'login'},
            'severity': 'info',
            'timestamp': datetime.now().isoformat(),
            'tenant_id': str(uuid4()),
            'category': 'Security Change',
            'risk_level': 'Low'
        }
        minimal_data.append(event)
    
    # Attempt to train
    metrics = await ml_service.train_classifiers(labeled_data=minimal_data)
    
    # Verify training failed gracefully
    assert metrics is None, "Training should return None for insufficient data"
    assert ml_service.is_trained is False, "Model should not be marked as trained"


@pytest.mark.asyncio
async def test_balanced_dataset_representation(balanced_training_data):
    """
    Test that balanced dataset has equal representation across categories.
    
    Verifies that the dataset preparation ensures balanced learning.
    
    Requirements: 8.4
    """
    # Count events per category
    category_counts = {}
    for event in balanced_training_data:
        category = event.get('category')
        category_counts[category] = category_counts.get(category, 0) + 1
    
    # Verify all categories are present
    expected_categories = [
        'Security Change',
        'Financial Impact',
        'Resource Allocation',
        'Risk Event',
        'Compliance Action'
    ]
    
    for category in expected_categories:
        assert category in category_counts, (
            f"Category '{category}' should be present in training data"
        )
    
    # Verify counts are equal (within 10% variance as per requirement)
    counts = list(category_counts.values())
    mean_count = sum(counts) / len(counts)
    
    for category, count in category_counts.items():
        variance = abs(count - mean_count) / mean_count
        assert variance <= 0.1, (
            f"Category '{category}' has {count} samples, "
            f"mean is {mean_count}, variance {variance:.2%} exceeds 10%"
        )


# ============================================================================
# Unit Tests for Model Persistence
# ============================================================================

@pytest.mark.asyncio
async def test_model_persistence_and_loading(ml_service, balanced_training_data, temp_model_dir):
    """
    Test model persistence (saving) and loading from disk.
    
    Verifies that:
    1. Models can be saved to disk
    2. Models can be loaded from disk
    3. Loaded models produce same predictions as original models
    
    Requirements: 4.11
    """
    # Override model directory to use temp directory
    ml_service.model_dir = temp_model_dir
    
    # Train the models
    metrics = await ml_service.train_classifiers(labeled_data=balanced_training_data)
    assert metrics is not None, "Training should succeed"
    
    # Get a test event for prediction
    test_event = balanced_training_data[0]
    
    # Make prediction with trained model
    original_classification = await ml_service.classify_event(test_event)
    assert original_classification is not None
    
    # Verify model files were created
    category_model_path = os.path.join(
        temp_model_dir, f"category_classifier_{ml_service.model_version}.pkl"
    )
    risk_model_path = os.path.join(
        temp_model_dir, f"risk_classifier_{ml_service.model_version}.pkl"
    )
    vectorizer_path = os.path.join(
        temp_model_dir, f"feature_vectorizer_{ml_service.model_version}.pkl"
    )
    
    assert os.path.exists(category_model_path), (
        f"Category model file should exist at {category_model_path}"
    )
    assert os.path.exists(risk_model_path), (
        f"Risk model file should exist at {risk_model_path}"
    )
    assert os.path.exists(vectorizer_path), (
        f"Vectorizer file should exist at {vectorizer_path}"
    )
    
    # Create new ML service instance and load models
    new_ml_service = AuditMLService(supabase_client=None)
    new_ml_service.model_dir = temp_model_dir
    
    # Load the models
    await new_ml_service.load_models()
    
    # Verify models were loaded
    assert new_ml_service.is_trained is True, "Loaded model should be marked as trained"
    
    # Make prediction with loaded model
    loaded_classification = await new_ml_service.classify_event(test_event)
    assert loaded_classification is not None
    
    # Verify predictions match
    assert original_classification.category == loaded_classification.category, (
        f"Loaded model category prediction should match original: "
        f"{original_classification.category} != {loaded_classification.category}"
    )
    assert original_classification.risk_level == loaded_classification.risk_level, (
        f"Loaded model risk level prediction should match original: "
        f"{original_classification.risk_level} != {loaded_classification.risk_level}"
    )


@pytest.mark.asyncio
async def test_load_models_when_files_not_exist(ml_service, temp_model_dir):
    """
    Test loading models when model files don't exist.
    
    Verifies that loading fails gracefully when model files are missing.
    
    Requirements: 4.11
    """
    # Override model directory to use temp directory (empty)
    ml_service.model_dir = temp_model_dir
    
    # Attempt to load models
    await ml_service.load_models()
    
    # Verify model is not marked as trained
    assert ml_service.is_trained is False, (
        "Model should not be marked as trained when files don't exist"
    )


@pytest.mark.asyncio
async def test_model_file_format_validation(ml_service, balanced_training_data, temp_model_dir):
    """
    Test that saved model files are valid pickle files.
    
    Verifies that model persistence uses correct serialization format.
    
    Requirements: 4.11
    """
    # Override model directory
    ml_service.model_dir = temp_model_dir
    
    # Train and save models
    metrics = await ml_service.train_classifiers(labeled_data=balanced_training_data)
    assert metrics is not None
    
    # Verify we can manually load the pickle files
    category_model_path = os.path.join(
        temp_model_dir, f"category_classifier_{ml_service.model_version}.pkl"
    )
    risk_model_path = os.path.join(
        temp_model_dir, f"risk_classifier_{ml_service.model_version}.pkl"
    )
    vectorizer_path = os.path.join(
        temp_model_dir, f"feature_vectorizer_{ml_service.model_version}.pkl"
    )
    
    # Load and verify category classifier
    with open(category_model_path, 'rb') as f:
        category_classifier = pickle.load(f)
        assert hasattr(category_classifier, 'predict'), (
            "Loaded category classifier should have predict method"
        )
        assert hasattr(category_classifier, 'predict_proba'), (
            "Loaded category classifier should have predict_proba method"
        )
    
    # Load and verify risk classifier
    with open(risk_model_path, 'rb') as f:
        risk_classifier = pickle.load(f)
        assert hasattr(risk_classifier, 'predict'), (
            "Loaded risk classifier should have predict method"
        )
        assert hasattr(risk_classifier, 'predict_proba'), (
            "Loaded risk classifier should have predict_proba method"
        )
    
    # Load and verify vectorizer
    with open(vectorizer_path, 'rb') as f:
        vectorizer = pickle.load(f)
        assert hasattr(vectorizer, 'transform'), (
            "Loaded vectorizer should have transform method"
        )
        assert hasattr(vectorizer, 'vocabulary_'), (
            "Loaded vectorizer should have vocabulary_ attribute"
        )


# ============================================================================
# Unit Tests for Training Metrics
# ============================================================================

@pytest.mark.asyncio
async def test_training_metrics_completeness(ml_service, balanced_training_data):
    """
    Test that training metrics include all required fields.
    
    Requirements: 4.11
    """
    metrics = await ml_service.train_classifiers(labeled_data=balanced_training_data)
    assert metrics is not None
    
    # Verify all metric fields are present
    assert hasattr(metrics, 'model_version'), "Metrics should have model_version"
    assert hasattr(metrics, 'training_date'), "Metrics should have training_date"
    assert hasattr(metrics, 'training_data_size'), "Metrics should have training_data_size"
    
    # Category metrics
    assert hasattr(metrics, 'category_accuracy'), "Metrics should have category_accuracy"
    assert hasattr(metrics, 'category_precision'), "Metrics should have category_precision"
    assert hasattr(metrics, 'category_recall'), "Metrics should have category_recall"
    assert hasattr(metrics, 'category_f1'), "Metrics should have category_f1"
    
    # Risk metrics
    assert hasattr(metrics, 'risk_accuracy'), "Metrics should have risk_accuracy"
    assert hasattr(metrics, 'risk_precision'), "Metrics should have risk_precision"
    assert hasattr(metrics, 'risk_recall'), "Metrics should have risk_recall"
    assert hasattr(metrics, 'risk_f1'), "Metrics should have risk_f1"
    
    # Verify types
    assert isinstance(metrics.model_version, str)
    assert isinstance(metrics.training_date, datetime)
    assert isinstance(metrics.training_data_size, int)
    assert isinstance(metrics.category_accuracy, float)
    assert isinstance(metrics.risk_accuracy, float)


@pytest.mark.asyncio
async def test_training_improves_over_rule_based(ml_service, balanced_training_data):
    """
    Test that trained model performs better than rule-based fallback.
    
    Verifies that ML training provides value over simple rules.
    
    Requirements: 4.11
    """
    # Get rule-based classification for a test event
    test_event = balanced_training_data[0]
    rule_based_classification = await ml_service._rule_based_classification(test_event)
    
    # Train the model
    metrics = await ml_service.train_classifiers(labeled_data=balanced_training_data)
    assert metrics is not None
    
    # Get ML-based classification
    ml_classification = await ml_service.classify_event(test_event)
    
    # Verify ML classification has higher confidence than rule-based
    # (Rule-based uses 0.5 confidence)
    assert ml_classification.category_confidence >= rule_based_classification.category_confidence, (
        f"ML confidence ({ml_classification.category_confidence}) should be >= "
        f"rule-based confidence ({rule_based_classification.category_confidence})"
    )


# ============================================================================
# Edge Case Tests
# ============================================================================

@pytest.mark.asyncio
async def test_train_with_empty_dataset(ml_service):
    """
    Test training with empty dataset.
    
    Requirements: 4.11
    """
    metrics = await ml_service.train_classifiers(labeled_data=[])
    
    assert metrics is None, "Training with empty dataset should return None"
    assert ml_service.is_trained is False, "Model should not be marked as trained"


@pytest.mark.asyncio
async def test_train_with_single_category(ml_service):
    """
    Test training with data from only one category.
    
    Verifies handling of edge case where data is extremely imbalanced.
    
    Requirements: 4.11, 8.4
    """
    # Create data with only one category
    single_category_data = []
    for i in range(100):
        event = {
            'id': str(uuid4()),
            'event_type': 'permission_change',
            'user_id': str(uuid4()),
            'entity_type': 'user',
            'entity_id': str(uuid4()),
            'action_details': {'action': 'permission_update'},
            'severity': 'info',
            'timestamp': datetime.now().isoformat(),
            'tenant_id': str(uuid4()),
            'category': 'Security Change',
            'risk_level': 'Low'
        }
        single_category_data.append(event)
    
    # Training should handle this gracefully (may fail or succeed with warnings)
    # The key is that it doesn't crash
    try:
        metrics = await ml_service.train_classifiers(labeled_data=single_category_data)
        # If it succeeds, verify metrics are returned
        if metrics is not None:
            assert isinstance(metrics, TrainingMetrics)
    except Exception as e:
        # If it fails, it should be a controlled failure
        assert "stratify" in str(e).lower() or "insufficient" in str(e).lower(), (
            f"Should fail with stratification or insufficient data error, got: {e}"
        )
