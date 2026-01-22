"""
Test Configuration for Property-Based Testing

This module provides configuration settings for property-based tests
including iteration counts, seed management, and CI/CD integration.

Task: 2.2 Add test failure debugging and CI/CD support
**Validates: Requirements 1.1, 1.2, 1.3, 1.4**
"""

from dataclasses import dataclass, field
from typing import Optional, List, Any
from hypothesis import settings, Verbosity, Phase
from hypothesis.database import DirectoryBasedExampleDatabase
import os
import logging

# Configure logging
logger = logging.getLogger(__name__)


# Environment variable names
ENV_HYPOTHESIS_SEED = 'HYPOTHESIS_SEED'
ENV_HYPOTHESIS_PROFILE = 'HYPOTHESIS_PROFILE'
ENV_HYPOTHESIS_MAX_EXAMPLES = 'HYPOTHESIS_MAX_EXAMPLES'


@dataclass
class PBTTestConfig:
    """
    Configuration class for property-based testing.
    
    Provides configurable settings for test execution including:
    - Minimum iterations per property (default: 100)
    - Deterministic seed values for reproducibility
    - CI/CD integration settings
    - Deadline and timeout configurations
    - Shrinking configuration for minimal failing examples
    
    **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
    """
    
    # Minimum iterations per property test (Requirement 1.2)
    min_iterations: int = 100
    
    # Maximum iterations for thorough testing
    max_iterations: int = 1000
    
    # Seed for deterministic execution (Requirement 1.4)
    seed: Optional[int] = None
    
    # Deadline in milliseconds (None = no deadline)
    deadline_ms: Optional[int] = 60000  # 60 seconds default
    
    # Verbosity level (use field with default_factory for enum)
    verbosity: Verbosity = field(default_factory=lambda: Verbosity.normal)
    
    # Phases to run (includes shrink for minimal examples - Requirement 1.3)
    phases: List[Phase] = field(default_factory=lambda: [
        Phase.explicit,
        Phase.reuse,
        Phase.generate,
        Phase.target,
        Phase.shrink  # Always include shrink for minimal failing examples
    ])
    
    # Suppress health checks (for specific test scenarios)
    suppress_health_check: List[Any] = field(default_factory=list)
    
    # Database configuration for integration tests
    database_url: Optional[str] = None
    
    # Supabase configuration
    supabase_url: Optional[str] = None
    supabase_key: Optional[str] = None
    
    # CI/CD mode flag
    ci_mode: bool = False
    
    # Profile name
    profile_name: str = "default"
    
    # Example database path for reproducibility (Requirement 1.4)
    example_database_path: Optional[str] = None
    
    # Whether to use deterministic mode (Requirement 1.4)
    deterministic: bool = False
    
    # Whether to print reproduction blob on failure (Requirement 1.3)
    print_blob: bool = True
    
    # Whether to report multiple bugs (Requirement 1.3)
    report_multiple_bugs: bool = True
    
    def __post_init__(self):
        """Initialize configuration from environment variables if not set."""
        if self.database_url is None:
            self.database_url = os.getenv('DATABASE_URL')
        
        if self.supabase_url is None:
            self.supabase_url = os.getenv('SUPABASE_URL')
        
        if self.supabase_key is None:
            self.supabase_key = os.getenv('SUPABASE_KEY')
        
        # Check for seed from environment (Requirement 1.4)
        if self.seed is None:
            seed_str = os.getenv(ENV_HYPOTHESIS_SEED)
            if seed_str:
                try:
                    self.seed = int(seed_str)
                    self.deterministic = True
                    logger.info(f"Using seed from environment: {self.seed}")
                except ValueError:
                    logger.warning(f"Invalid seed value in {ENV_HYPOTHESIS_SEED}: {seed_str}")
        
        # Check for max examples override from environment
        max_examples_str = os.getenv(ENV_HYPOTHESIS_MAX_EXAMPLES)
        if max_examples_str:
            try:
                self.min_iterations = int(max_examples_str)
                logger.info(f"Using max_examples from environment: {self.min_iterations}")
            except ValueError:
                logger.warning(f"Invalid max_examples in {ENV_HYPOTHESIS_MAX_EXAMPLES}: {max_examples_str}")
        
        # Check for CI environment
        if os.getenv('CI') or os.getenv('GITHUB_ACTIONS'):
            self.ci_mode = True
            if self.profile_name == "default":
                self.profile_name = "ci"
            logger.info("CI environment detected")
    
    def to_hypothesis_settings(self) -> settings:
        """
        Convert configuration to Hypothesis settings object.
        
        Returns:
            settings: Hypothesis settings configured for property testing
            
        **Validates: Requirements 1.2, 1.3, 1.4**
        """
        # Note: derandomize=True implies database=None
        # So we only set database when not in deterministic mode
        if self.deterministic:
            return settings(
                max_examples=self.min_iterations,
                verbosity=self.verbosity,
                phases=self.phases,
                deadline=self.deadline_ms,
                suppress_health_check=self.suppress_health_check,
                derandomize=True,
                print_blob=self.print_blob,
                report_multiple_bugs=self.report_multiple_bugs
            )
        else:
            # Setup example database for reproducibility
            database = None
            if self.example_database_path:
                database = DirectoryBasedExampleDatabase(self.example_database_path)
            
            return settings(
                max_examples=self.min_iterations,
                verbosity=self.verbosity,
                phases=self.phases,
                deadline=self.deadline_ms,
                suppress_health_check=self.suppress_health_check,
                database=database,
                print_blob=self.print_blob,
                report_multiple_bugs=self.report_multiple_bugs
            )
    
    def get_profile_settings(self) -> dict:
        """
        Get settings dictionary for the current profile.
        
        Returns:
            dict: Settings dictionary for Hypothesis profile registration
        """
        return {
            'max_examples': self.min_iterations,
            'verbosity': self.verbosity,
            'deadline': self.deadline_ms,
            'phases': self.phases,
            'suppress_health_check': self.suppress_health_check,
            'derandomize': self.deterministic,
            'print_blob': self.print_blob,
            'report_multiple_bugs': self.report_multiple_bugs
        }
    
    def with_seed(self, seed: int) -> 'PBTTestConfig':
        """
        Create a new config with a specific seed.
        
        Args:
            seed: Seed value for deterministic execution
            
        Returns:
            New PBTTestConfig with the specified seed
            
        **Validates: Requirements 1.4**
        """
        return PBTTestConfig(
            min_iterations=self.min_iterations,
            max_iterations=self.max_iterations,
            seed=seed,
            deadline_ms=self.deadline_ms,
            verbosity=self.verbosity,
            phases=self.phases.copy(),
            suppress_health_check=self.suppress_health_check.copy(),
            database_url=self.database_url,
            supabase_url=self.supabase_url,
            supabase_key=self.supabase_key,
            ci_mode=self.ci_mode,
            profile_name=self.profile_name,
            example_database_path=self.example_database_path,
            deterministic=True,
            print_blob=self.print_blob,
            report_multiple_bugs=self.report_multiple_bugs
        )
    
    def for_debugging(self) -> 'PBTTestConfig':
        """
        Create a config optimized for debugging failing tests.
        
        Returns:
            New PBTTestConfig optimized for debugging
            
        **Validates: Requirements 1.3**
        """
        return PBTTestConfig(
            min_iterations=self.min_iterations,
            max_iterations=self.max_iterations,
            seed=self.seed,
            deadline_ms=None,  # No deadline for debugging
            verbosity=Verbosity.verbose,
            phases=[Phase.explicit, Phase.reuse, Phase.generate, Phase.target, Phase.shrink],
            suppress_health_check=self.suppress_health_check.copy(),
            database_url=self.database_url,
            supabase_url=self.supabase_url,
            supabase_key=self.supabase_key,
            ci_mode=False,
            profile_name="debug",
            example_database_path=self.example_database_path or '.hypothesis/debug_examples',
            deterministic=self.seed is not None,
            print_blob=True,
            report_multiple_bugs=True
        )


def get_test_settings(profile: str = "default") -> PBTTestConfig:
    """
    Get test configuration for a specific profile.
    
    Profiles:
    - "default": Standard testing with 100 iterations
    - "ci": CI/CD testing with 1000 iterations and verbose output
    - "ci-fast": Quick CI validation with 100 iterations
    - "ci-thorough": Comprehensive CI testing with 2000 iterations
    - "dev": Development testing with 10 iterations for quick feedback
    - "thorough": Comprehensive testing with maximum iterations
    - "debug": Debugging mode with verbose output and no deadline
    
    Args:
        profile: Profile name to load
        
    Returns:
        PBTTestConfig: Configuration for the specified profile
        
    **Validates: Requirements 1.2, 1.3, 1.4**
    """
    profiles = {
        "default": PBTTestConfig(
            min_iterations=100,
            verbosity=Verbosity.normal,
            profile_name="default",
            example_database_path='.hypothesis/examples'
        ),
        "ci": PBTTestConfig(
            min_iterations=1000,
            verbosity=Verbosity.verbose,
            ci_mode=True,
            profile_name="ci",
            example_database_path='.hypothesis/ci_examples',
            deterministic=True,
            deadline_ms=120000  # 2 minutes for CI
        ),
        "ci-fast": PBTTestConfig(
            min_iterations=100,
            verbosity=Verbosity.normal,
            ci_mode=True,
            profile_name="ci-fast",
            example_database_path='.hypothesis/ci_examples',
            deterministic=True,
            deadline_ms=60000  # 1 minute
        ),
        "ci-thorough": PBTTestConfig(
            min_iterations=2000,
            verbosity=Verbosity.verbose,
            ci_mode=True,
            profile_name="ci-thorough",
            example_database_path='.hypothesis/ci_examples',
            deterministic=True,
            deadline_ms=300000  # 5 minutes
        ),
        "dev": PBTTestConfig(
            min_iterations=10,
            verbosity=Verbosity.normal,
            deadline_ms=10000,  # 10 seconds
            profile_name="dev",
            example_database_path='.hypothesis/dev_examples'
        ),
        "fast": PBTTestConfig(
            min_iterations=5,
            verbosity=Verbosity.normal,
            deadline_ms=5000,  # 5 seconds
            profile_name="fast",
            example_database_path='.hypothesis/fast_examples'
        ),
        "thorough": PBTTestConfig(
            min_iterations=500,
            max_iterations=2000,
            verbosity=Verbosity.verbose,
            profile_name="thorough",
            example_database_path='.hypothesis/thorough_examples'
        ),
        "debug": PBTTestConfig(
            min_iterations=100,
            verbosity=Verbosity.verbose,
            deadline_ms=None,  # No deadline for debugging
            profile_name="debug",
            example_database_path='.hypothesis/debug_examples',
            print_blob=True,
            report_multiple_bugs=True
        )
    }
    
    # Check for profile override from environment
    env_profile = os.getenv(ENV_HYPOTHESIS_PROFILE)
    if env_profile and env_profile in profiles:
        profile = env_profile
        logger.info(f"Using profile from environment: {profile}")
    
    return profiles.get(profile, profiles["default"])


def register_hypothesis_profiles():
    """
    Register all Hypothesis profiles for property-based testing.
    
    This function should be called during test setup to ensure
    all profiles are available for use.
    
    **Validates: Requirements 1.2, 1.3, 1.4**
    """
    # Default profile - 100 iterations
    settings.register_profile(
        "default",
        max_examples=100,
        verbosity=Verbosity.normal,
        deadline=60000,
        print_blob=True,
        database=DirectoryBasedExampleDatabase('.hypothesis/examples')
    )
    
    # CI profile - 1000 iterations for thorough testing
    # Note: derandomize=True implies database=None
    settings.register_profile(
        "ci",
        max_examples=1000,
        verbosity=Verbosity.verbose,
        deadline=120000,  # 2 minutes for CI
        derandomize=True,
        print_blob=True,
        report_multiple_bugs=True
    )
    
    # CI-fast profile - 100 iterations for quick validation
    settings.register_profile(
        "ci-fast",
        max_examples=100,
        verbosity=Verbosity.normal,
        deadline=60000,
        derandomize=True,
        print_blob=True
    )
    
    # CI-thorough profile - 2000 iterations for comprehensive testing
    settings.register_profile(
        "ci-thorough",
        max_examples=2000,
        verbosity=Verbosity.verbose,
        deadline=300000,  # 5 minutes
        derandomize=True,
        print_blob=True,
        report_multiple_bugs=True
    )
    
    # Development profile - 10 iterations for quick feedback
    settings.register_profile(
        "dev",
        max_examples=10,
        verbosity=Verbosity.normal,
        deadline=10000,  # 10 seconds for quick tests
        print_blob=True,
        database=DirectoryBasedExampleDatabase('.hypothesis/dev_examples')
    )
    
    # Fast validation profile - 5 iterations for checkpoint validation
    settings.register_profile(
        "fast",
        max_examples=5,
        verbosity=Verbosity.normal,
        deadline=5000,  # 5 seconds
        print_blob=False,
        database=DirectoryBasedExampleDatabase('.hypothesis/fast_examples')
    )
    
    # Thorough profile - 500 iterations for comprehensive testing
    settings.register_profile(
        "thorough",
        max_examples=500,
        verbosity=Verbosity.verbose,
        deadline=180000,  # 3 minutes
        print_blob=True,
        database=DirectoryBasedExampleDatabase('.hypothesis/thorough_examples')
    )
    
    # Debug profile - optimized for debugging failures
    settings.register_profile(
        "debug",
        max_examples=100,
        verbosity=Verbosity.verbose,
        deadline=None,  # No deadline for debugging
        print_blob=True,
        report_multiple_bugs=True,
        phases=[Phase.explicit, Phase.reuse, Phase.generate, Phase.target, Phase.shrink],
        database=DirectoryBasedExampleDatabase('.hypothesis/debug_examples')
    )
    
    # Load profile from environment or default
    profile_name = os.getenv(ENV_HYPOTHESIS_PROFILE, 'default')
    settings.load_profile(profile_name)
    logger.info(f"Loaded Hypothesis profile: {profile_name}")


# Register profiles on module import
register_hypothesis_profiles()
