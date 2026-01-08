"""
Module entry point for pre-startup testing system.

This allows running the pre-startup tests using:
    python -m pre_startup_testing

All CLI options are supported.
"""

import asyncio
from .cli import main

if __name__ == "__main__":
    asyncio.run(main())