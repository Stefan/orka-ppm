#!/usr/bin/env python3
"""
Standalone script for running pre-startup tests.

This script can be run independently to validate system configuration
before starting the server. It supports all CLI options and provides
both human-readable and machine-readable output formats.

Usage:
    python run_pre_startup_tests.py                    # Run all tests
    python run_pre_startup_tests.py --critical-only    # Run only critical tests
    python run_pre_startup_tests.py --json             # Output in JSON format
    python run_pre_startup_tests.py --skip-tests       # Skip tests (for urgent debugging)
    python run_pre_startup_tests.py --help             # Show all options
"""

import asyncio
import sys
import os

# Add the current directory to Python path so we can import pre_startup_testing
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pre_startup_testing.cli import main

if __name__ == "__main__":
    asyncio.run(main())