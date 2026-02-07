"""
Smoke test: ensure main application and core dependencies can be imported.
Catches missing runtime deps (e.g. PyJWT) when only requirements-test.txt was installed.
Should be run after installing requirements.txt (e.g. in CI).
"""

import sys
import os

# Run from backend/
if os.path.basename(os.getcwd()) != "backend":
    backend_dir = os.path.join(os.path.dirname(__file__), "..")
    os.chdir(backend_dir)
    sys.path.insert(0, backend_dir)


def test_import_main_app():
    """Importing main must succeed and expose the FastAPI app (transitive deps like jwt loaded)."""
    from main import app

    assert app is not None
    assert hasattr(app, "routes")
