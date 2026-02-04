#!/usr/bin/env python3
"""
Run performance tests for project controls and change orders.
"""

import subprocess
import sys
from pathlib import Path

backend = Path(__file__).resolve().parent
tests = backend / "tests"


def main():
    print("Running performance tests...")
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            str(tests / "test_project_controls_performance.py"),
            str(tests / "test_change_orders_performance.py"),
            "-v",
            "--override-ini=addopts=",
        ],
        cwd=str(backend),
    )
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
