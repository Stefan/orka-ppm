"""
Seed Management for Deterministic Property-Based Testing

This module provides utilities for managing seeds in property-based tests
to enable deterministic, reproducible test execution.

Task: 2.2 Add test failure debugging and CI/CD support
**Validates: Requirements 1.4**
"""

import hashlib
import os
import random
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union
from functools import wraps
import json
import logging

from hypothesis import settings, seed as hypothesis_seed, reproduce_failure
from hypothesis.database import DirectoryBasedExampleDatabase

# Configure logging
logger = logging.getLogger(__name__)

T = TypeVar('T')


# Environment variable names for seed configuration
ENV_HYPOTHESIS_SEED = 'HYPOTHESIS_SEED'
ENV_PBT_SEED = 'PBT_SEED'
ENV_RANDOM_SEED = 'RANDOM_SEED'


@dataclass
class SeedConfig:
    """
    Configuration for seed management in property-based tests.
    
    **Validates: Requirements 1.4**
    """
    # Primary seed for Hypothesis
    hypothesis_seed: Optional[int] = None
    
    # Seed for Python's random module
    random_seed: Optional[int] = None
    
    # Whether to use deterministic mode
    deterministic: bool = False
    
    # Whether to save seeds for reproduction
    save_seeds: bool = True
    
    # Path to save seed information
    seed_file_path: Optional[str] = None
    
    # Timestamp when seed was set
    timestamp: Optional[str] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now(timezone.utc).isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            'hypothesis_seed': self.hypothesis_seed,
            'random_seed': self.random_seed,
            'deterministic': self.deterministic,
            'save_seeds': self.save_seeds,
            'seed_file_path': self.seed_file_path,
            'timestamp': self.timestamp
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SeedConfig':
        """Create from dictionary."""
        return cls(**data)
    
    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), indent=2)
    
    @classmethod
    def from_json(cls, json_str: str) -> 'SeedConfig':
        """Create from JSON string."""
        return cls.from_dict(json.loads(json_str))


def get_seed_from_environment() -> Optional[int]:
    """
    Get seed value from environment variables.
    
    Checks the following environment variables in order:
    1. HYPOTHESIS_SEED
    2. PBT_SEED
    3. RANDOM_SEED
    
    Returns:
        Seed value if found, None otherwise
    
    **Validates: Requirements 1.4**
    """
    for env_var in [ENV_HYPOTHESIS_SEED, ENV_PBT_SEED, ENV_RANDOM_SEED]:
        seed_str = os.getenv(env_var)
        if seed_str:
            try:
                seed = int(seed_str)
                logger.info(f"Using seed {seed} from {env_var}")
                return seed
            except ValueError:
                logger.warning(f"Invalid seed value in {env_var}: {seed_str}")
    
    return None


def generate_deterministic_seed(
    test_name: Optional[str] = None,
    include_timestamp: bool = False
) -> int:
    """
    Generate a deterministic seed based on test name and optional timestamp.
    
    Args:
        test_name: Name of the test (used for consistent seed generation)
        include_timestamp: If True, include current date in seed generation
    
    Returns:
        Deterministic seed value
    
    **Validates: Requirements 1.4**
    """
    seed_input = test_name or "default_test"
    
    if include_timestamp:
        # Include date (not time) for daily reproducibility
        date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        seed_input = f"{seed_input}_{date_str}"
    
    # Generate hash-based seed
    hash_bytes = hashlib.sha256(seed_input.encode()).digest()
    seed = int.from_bytes(hash_bytes[:8], byteorder='big') % (2**31)
    
    logger.debug(f"Generated deterministic seed {seed} for '{seed_input}'")
    return seed


def generate_random_seed() -> int:
    """
    Generate a random seed for non-deterministic test runs.
    
    Returns:
        Random seed value
    
    **Validates: Requirements 1.4**
    """
    # Use system entropy for truly random seed
    seed = int.from_bytes(os.urandom(8), byteorder='big') % (2**31)
    logger.debug(f"Generated random seed: {seed}")
    return seed


def set_global_seed(seed: int) -> None:
    """
    Set the global seed for all random number generators.
    
    Sets seed for:
    - Python's random module
    - Environment variable for Hypothesis
    
    Args:
        seed: Seed value to set
    
    **Validates: Requirements 1.4**
    """
    # Set Python random seed
    random.seed(seed)
    
    # Set environment variable for Hypothesis
    os.environ[ENV_HYPOTHESIS_SEED] = str(seed)
    
    logger.info(f"Global seed set to {seed}")


def get_seed_config(
    seed: Optional[int] = None,
    deterministic: bool = False,
    test_name: Optional[str] = None
) -> SeedConfig:
    """
    Get a complete seed configuration.
    
    Priority for seed selection:
    1. Explicitly provided seed
    2. Environment variable seed
    3. Deterministic seed (if deterministic=True)
    4. Random seed
    
    Args:
        seed: Explicit seed value (highest priority)
        deterministic: Whether to use deterministic mode
        test_name: Test name for deterministic seed generation
    
    Returns:
        Complete seed configuration
    
    **Validates: Requirements 1.4**
    """
    # Determine the seed to use
    if seed is not None:
        final_seed = seed
        logger.info(f"Using explicitly provided seed: {final_seed}")
    else:
        env_seed = get_seed_from_environment()
        if env_seed is not None:
            final_seed = env_seed
        elif deterministic:
            final_seed = generate_deterministic_seed(test_name)
        else:
            final_seed = generate_random_seed()
    
    return SeedConfig(
        hypothesis_seed=final_seed,
        random_seed=final_seed,
        deterministic=deterministic or (seed is not None) or (get_seed_from_environment() is not None)
    )


def with_seed(seed: Optional[int] = None, deterministic: bool = False) -> Callable:
    """
    Decorator to run a test with a specific seed.
    
    Args:
        seed: Seed value to use (None for auto-selection)
        deterministic: Whether to use deterministic mode
    
    Returns:
        Decorator function
    
    **Validates: Requirements 1.4**
    
    Example:
        ```python
        @with_seed(12345)
        @given(st.integers())
        def test_example(x):
            assert x >= 0
        ```
    """
    def decorator(test_func: Callable[..., T]) -> Callable[..., T]:
        @wraps(test_func)
        def wrapped(*args, **kwargs):
            config = get_seed_config(
                seed=seed,
                deterministic=deterministic,
                test_name=test_func.__name__
            )
            
            # Set the seed
            if config.hypothesis_seed is not None:
                set_global_seed(config.hypothesis_seed)
            
            # Log seed for reproduction
            logger.info(
                f"Running {test_func.__name__} with seed {config.hypothesis_seed}"
            )
            
            return test_func(*args, **kwargs)
        
        return wrapped
    
    return decorator


def deterministic_test(test_func: Callable[..., T]) -> Callable[..., T]:
    """
    Decorator to make a test deterministic based on its name.
    
    The seed is derived from the test function name, ensuring
    consistent results across runs.
    
    **Validates: Requirements 1.4**
    
    Example:
        ```python
        @deterministic_test
        @given(st.integers())
        def test_example(x):
            # Will always use the same seed
            assert x >= 0
        ```
    """
    return with_seed(deterministic=True)(test_func)


class SeedManager:
    """
    Manager for seed configuration and tracking across test sessions.
    
    Provides:
    - Centralized seed management
    - Seed history tracking
    - Reproduction helpers
    
    **Validates: Requirements 1.4**
    """
    
    def __init__(
        self,
        seed_file_path: Optional[Union[str, Path]] = None,
        auto_save: bool = True
    ):
        """
        Initialize the seed manager.
        
        Args:
            seed_file_path: Path to save seed history
            auto_save: Whether to automatically save seeds
        """
        self.seed_file_path = Path(seed_file_path) if seed_file_path else Path('.hypothesis/seeds.json')
        self.auto_save = auto_save
        self._seed_history: List[Dict[str, Any]] = []
        self._current_config: Optional[SeedConfig] = None
        
        # Load existing seed history
        self._load_history()
    
    def _load_history(self) -> None:
        """Load seed history from file."""
        if self.seed_file_path.exists():
            try:
                with open(self.seed_file_path, 'r') as f:
                    self._seed_history = json.load(f)
                logger.debug(f"Loaded {len(self._seed_history)} seed records")
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"Could not load seed history: {e}")
                self._seed_history = []
    
    def _save_history(self) -> None:
        """Save seed history to file."""
        if self.auto_save:
            self.seed_file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.seed_file_path, 'w') as f:
                json.dump(self._seed_history, f, indent=2)
            logger.debug(f"Saved {len(self._seed_history)} seed records")
    
    def configure(
        self,
        seed: Optional[int] = None,
        deterministic: bool = False,
        test_name: Optional[str] = None
    ) -> SeedConfig:
        """
        Configure seeds for a test run.
        
        Args:
            seed: Explicit seed value
            deterministic: Whether to use deterministic mode
            test_name: Test name for deterministic seed generation
        
        Returns:
            Seed configuration
        
        **Validates: Requirements 1.4**
        """
        config = get_seed_config(
            seed=seed,
            deterministic=deterministic,
            test_name=test_name
        )
        
        self._current_config = config
        
        # Apply the seed
        if config.hypothesis_seed is not None:
            set_global_seed(config.hypothesis_seed)
        
        # Record in history
        record = {
            **config.to_dict(),
            'test_name': test_name
        }
        self._seed_history.append(record)
        self._save_history()
        
        return config
    
    def get_current_config(self) -> Optional[SeedConfig]:
        """Get the current seed configuration."""
        return self._current_config
    
    def get_history(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get seed history.
        
        Args:
            limit: Maximum number of records to return (most recent first)
        
        Returns:
            List of seed configuration records
        """
        history = list(reversed(self._seed_history))
        if limit:
            history = history[:limit]
        return history
    
    def get_last_seed(self, test_name: Optional[str] = None) -> Optional[int]:
        """
        Get the last seed used for a test.
        
        Args:
            test_name: Filter by test name (None for any test)
        
        Returns:
            Last seed value, or None if not found
        """
        for record in reversed(self._seed_history):
            if test_name is None or record.get('test_name') == test_name:
                return record.get('hypothesis_seed')
        return None
    
    def replay_seed(self, seed: int) -> SeedConfig:
        """
        Replay a specific seed.
        
        Args:
            seed: Seed value to replay
        
        Returns:
            Seed configuration
        
        **Validates: Requirements 1.4**
        """
        return self.configure(seed=seed, deterministic=True)
    
    def clear_history(self) -> None:
        """Clear seed history."""
        self._seed_history.clear()
        self._save_history()


def create_reproducible_settings(
    seed: Optional[int] = None,
    max_examples: int = 100,
    database_path: Optional[str] = None
) -> settings:
    """
    Create Hypothesis settings for reproducible test execution.
    
    Args:
        seed: Seed for deterministic execution
        max_examples: Number of examples to generate
        database_path: Path for example database (only used when seed is None)
    
    Returns:
        Configured Hypothesis settings
    
    **Validates: Requirements 1.4**
    """
    # If seed is provided, set it in environment and use derandomize
    if seed is not None:
        os.environ[ENV_HYPOTHESIS_SEED] = str(seed)
        # Note: derandomize=True implies database=None
        return settings(
            max_examples=max_examples,
            derandomize=True,
            print_blob=True
        )
    else:
        # Without seed, use database for example storage
        db_path = database_path or '.hypothesis/examples'
        database = DirectoryBasedExampleDatabase(db_path)
        return settings(
            max_examples=max_examples,
            database=database,
            print_blob=True
        )


def get_reproduction_command(
    test_module: str,
    test_name: str,
    seed: int
) -> str:
    """
    Generate a command to reproduce a test with a specific seed.
    
    Args:
        test_module: Module containing the test
        test_name: Name of the test function
        seed: Seed to use for reproduction
    
    Returns:
        Command string for reproduction
    
    **Validates: Requirements 1.4**
    """
    return f"HYPOTHESIS_SEED={seed} pytest {test_module}::{test_name} -v"


def save_seed_for_ci(
    seed: int,
    test_name: str,
    output_path: Optional[Union[str, Path]] = None
) -> Path:
    """
    Save seed information for CI/CD artifact storage.
    
    Args:
        seed: Seed value
        test_name: Name of the test
        output_path: Path to save seed info (default: .hypothesis/ci_seeds/)
    
    Returns:
        Path to saved file
    
    **Validates: Requirements 1.4**
    """
    output_dir = Path(output_path) if output_path else Path('.hypothesis/ci_seeds')
    output_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"seed_{test_name}_{timestamp}.json"
    filepath = output_dir / filename
    
    seed_info = {
        'seed': seed,
        'test_name': test_name,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'reproduction_command': get_reproduction_command(
            test_module='tests.property_tests',
            test_name=test_name,
            seed=seed
        )
    }
    
    with open(filepath, 'w') as f:
        json.dump(seed_info, f, indent=2)
    
    logger.info(f"Saved seed info to {filepath}")
    return filepath


# Global seed manager instance
_global_seed_manager: Optional[SeedManager] = None


def get_seed_manager() -> SeedManager:
    """Get or create the global seed manager instance."""
    global _global_seed_manager
    if _global_seed_manager is None:
        _global_seed_manager = SeedManager()
    return _global_seed_manager
